import os
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from pgvector.sqlalchemy import Vector
from openai import OpenAI
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTTextContainer

app = Flask(__name__)

app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@db:5432/appdb"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Use 1536 for text-embedding-3-small
EMBEDDING_DIM = 1536


class Document(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    source = db.Column(db.String(255))  # PDF filename
    page_number = db.Column(db.Integer)
    content = db.Column(db.Text, nullable=False)
    embedding = db.Column(Vector(EMBEDDING_DIM))

def chunk_text(text, chunk_size=500, overlap=50):
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks

# -------------------------
# Initialize DB
# -------------------------
@app.before_request
def setup():
    # The following line will remove this handler, making it
    # only run on the first request
    app.before_request_funcs[None].remove(setup)
    db.session.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    db.session.commit()
    db.create_all()
    db.session.execute(text("ALTER TABLE document ADD COLUMN IF NOT EXISTS page_number INTEGER"))
    db.session.commit()


def get_embedding(text_input):
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text_input
    )
    return response.data[0].embedding


def extract_text_by_page(pdf_path):
    pages = []
    for page_number, page_layout in enumerate(extract_pages(pdf_path), start=1):
        page_text_parts = [
            element.get_text()
            for element in page_layout
            if isinstance(element, LTTextContainer)
        ]
        page_text = "".join(page_text_parts).strip()
        if page_text:
            pages.append((page_number, page_text))
    return pages

@app.route("/upload-pdf", methods=["POST"])
def upload_pdf():
    if "file" not in request.files:
        return {"error": "No file uploaded"}, 400

    file = request.files["file"]
    filename = file.filename

    # Save temporarily
    filepath = f"/tmp/{filename}"
    file.save(filepath)

    # Extract text by page
    pages = extract_text_by_page(filepath)

    if not pages:
        return {"error": "No extractable text found"}, 400

    total_chunks = 0
    for page_number, page_text in pages:
        page_chunks = chunk_text(page_text)
        for chunk in page_chunks:
            embedding = get_embedding(chunk)
            doc = Document(
                source=filename,
                page_number=page_number,
                content=chunk,
                embedding=embedding
            )
            db.session.add(doc)
            total_chunks += 1

    db.session.commit()

    return {"status": "indexed", "chunks": total_chunks, "pages": len(pages)}


@app.route("/documents", methods=["POST"])
def add_document():
    data = request.json
    content = data["content"]

    embedding = get_embedding(content)
    source = data.get("source", "")  # Get the source if provided
    page_number = data.get("page_number")

    doc = Document(content=content, embedding=embedding, source=source, page_number=page_number)
    db.session.add(doc)
    db.session.commit()

    return jsonify({"id": doc.id})

@app.route("/ask", methods=["POST"])
def ask():
    data = request.json
    question = data["question"]
    top_k = data.get("top_k", 5)

    # 1️⃣ Embed question
    query_embedding = get_embedding(question)

    # 2️⃣ Retrieve similar chunks
    results = db.session.execute(
        text("""
        SELECT content,
               1 - (embedding <=> (:query_embedding)::vector) AS similarity
        FROM document
        ORDER BY embedding <=> (:query_embedding)::vector
        LIMIT :top_k
        """),
        {"query_embedding": query_embedding, "top_k": top_k}
    )

    context_chunks = [row.content for row in results]
    context = "\n\n---\n\n".join(context_chunks)

    # 3️⃣ Send to LLM
    completion = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": "Answer the question using ONLY the provided context. If the answer is not in the context, say you don't know."
            },
            {
                "role": "user",
                "content": f"Context:\n{context}\n\nQuestion:\n{question}"
            }
        ]
    )

    answer = completion.choices[0].message.content

    return jsonify({
        "answer": answer,
        "sources_used": len(context_chunks)
    })

@app.route("/search", methods=["POST"])
def search():
    data = request.json
    query = data["query"]
    top_k = data.get("top_k", 3)

    query_embedding = get_embedding(query)

    results = db.session.execute(
        text(f"""
        SELECT id, source, page_number, content,
               1 - (embedding <=> (:query_embedding)::vector) AS similarity
        FROM document
        ORDER BY embedding <=> (:query_embedding)::vector
        LIMIT :top_k
        """),
        {"query_embedding": query_embedding, "top_k": top_k}
    )

    matches = [
        {
            "id": row.id,
            "source": row.source,
            "page_number": row.page_number,
            "content": row.content,
            "similarity": float(row.similarity)
        }
        for row in results
    ]

    return jsonify(matches)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

