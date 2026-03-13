from datetime import datetime, timezone
import hashlib
import logging
import os
from uuid import uuid4
from distro import name
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import TSVECTOR
from pgvector.sqlalchemy import Vector
from openai import OpenAI

from PyPDF2 import PdfReader 
from pdfplumber import pdf
from langchain_text_splitters import RecursiveCharacterTextSplitter as RecursiveTextCharacterSplitter

from sentence_transformers import SentenceTransformer
from torch import cosine_similarity


app = Flask(__name__)
CORS(app)

logging.basicConfig(
    filename=os.getenv("LOG_FILE", "app.log"),
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    filemode='a'
)

app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@db:5432/appdb"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Use 1536 for text-embedding-3-small
EMBEDDING_DIM = 1536


def preview_text(text_value, max_chars=200):
    if text_value is None:
        return ""
    cleaned = " ".join(str(text_value).split())
    if len(cleaned) <= max_chars:
        return cleaned
    return f"{cleaned[:max_chars]}..."

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(64))
    role = db.Column(db.String(10))  # user / assistant
    content = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

class Embedding(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    hash = db.Column(db.String(64), unique=True, index=True)
    content = db.Column(db.Text, nullable=False)
    embedding = db.Column(Vector(EMBEDDING_DIM))
    tsv = db.Column(TSVECTOR)

class PDFDocument(db.Model):
    __tablename__ = "documents"
    id = db.Column(db.Integer, primary_key=True)
    hash = db.Column(db.String(64), unique=True, index=True)

class Document(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    source = db.Column(db.String(255))  # PDF filename
    page_number = db.Column(db.Integer)
    embedding_id = db.Column(db.Integer, db.ForeignKey("embedding.id"))
    doc_id = db.Column(db.Integer, db.ForeignKey("documents.id"), nullable=True)


class Requests(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    object = db.Column(db.JSON, nullable=False)
    type = db.Column(db.String(20), nullable=False)  # embedding / messages / response
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

class Procedures(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    steps = db.Column(db.JSON)  # List of steps with details
    embedding = db.Column(Vector(384))

def chunk_text(text, chunk_size=1000, overlap=50):
    if not text:
        return []

    splitter = RecursiveTextCharacterSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        length_function=len,
    )
    split = splitter.split_text(text);
    paragraphs = []
    for text in split:
        paragraphs.extend(text.split("\n"))

    return [p for p in paragraphs if p.strip()]

def save_message(session_id, role, content):
    msg = Message(session_id=session_id, role=role, content=content)
    db.session.add(msg)
    db.session.commit()

def load_history(session_id, limit=10):
    messages = (
        Message.query
        .filter_by(session_id=session_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
        .all()
    )

    messages.reverse()

    return [{"role": m.role, "content": m.content} for m in messages]


def save_request_object(payload_type, payload_object):
    req = Requests(type=payload_type, object=payload_object)
    db.session.add(req)
    db.session.commit()


def compute_content_hash(content):
    if content is None:
        return None
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def find_embedding_by_hash(content_hash):
    if not content_hash:
        return None
    return Embedding.query.filter_by(hash=content_hash).first()

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

    # One-time migration: if document still has the old schema (hash column
    # present), migrate content/hash/embedding/tsv into the embedding table
    # and replace them with an embedding_id FK.
    db.session.execute(text("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'document' AND column_name = 'hash'
            ) THEN
                -- backfill hashes for any rows that are still missing one
                UPDATE document
                SET hash = md5(content)
                WHERE hash IS NULL AND content IS NOT NULL;

                -- populate embedding table from old document rows
                INSERT INTO embedding (hash, content, embedding, tsv)
                SELECT DISTINCT ON (hash) hash, content, embedding,
                       to_tsvector('english', content)
                FROM document
                WHERE hash IS NOT NULL
                ON CONFLICT (hash) DO NOTHING;

                -- link documents to their embedding rows
                ALTER TABLE document
                    ADD COLUMN IF NOT EXISTS embedding_id INTEGER;

                UPDATE document d
                SET embedding_id = e.id
                FROM embedding e
                WHERE e.hash = d.hash AND d.embedding_id IS NULL;

                -- drop the now-redundant columns
                ALTER TABLE document DROP COLUMN IF EXISTS content;
                ALTER TABLE document DROP COLUMN IF EXISTS hash;
                ALTER TABLE document DROP COLUMN IF EXISTS embedding;
                ALTER TABLE document DROP COLUMN IF EXISTS tsv;
            END IF;
            -- add doc_id if it doesn't exist yet (existing rows left NULL)
            ALTER TABLE document ADD COLUMN IF NOT EXISTS doc_id INTEGER REFERENCES documents(id);
        END $$;
    """))
    db.session.commit()


@app.before_request
def attach_request_id():
    g.request_id = request.headers.get("X-Request-ID") or str(uuid4())


@app.after_request
def add_request_id_header(response):
    response.headers["X-Request-ID"] = getattr(g, "request_id", "")
    return response


def get_embedding(text_input, source="unknown"):
    embedding_payload = {
        "model": "text-embedding-3-small",
        "input": text_input
    }
    save_request_object("embedding", embedding_payload)

    app.logger.info(
        "embedding.request request_id=%s source=%s chars=%s preview=%s",
        getattr(g, "request_id", "n/a"),
        source,
        len(text_input or ""),
        preview_text(text_input)
    )
    response = client.embeddings.create(
        **embedding_payload
    )
    app.logger.info(
        "embedding.response request_id=%s source=%s dims=%s",
        getattr(g, "request_id", "n/a"),
        source,
        len(response.data[0].embedding)
    )
    return response.data[0].embedding


def extract_text_by_page(pdf_path):
    pages = []
    with open(pdf_path, "rb") as pdf_file:
        reader = PdfReader(pdf_file)
        for page_number, page in enumerate(reader.pages, start=1):
            page_text = (page.extract_text() or "").strip()
            if page_text:
                pages.append((page_number, page_text))
    return pages

@app.route("/upload-procedure", methods=["POST"])
def upload_procedure():
    data = request.json
    name = data.get("name")
    description = data.get("description")
    steps = data.get("steps", [])
    if not name or not steps or len(steps) < 2:
        return {"error": "Name and at least two steps are required"}, 400
    model = SentenceTransformer("all-MiniLM-L6-v2")
    embedding = model.encode(description).tolist()

    procedure = Procedures(name=name, description=description, steps=steps, embedding=embedding)
    db.session.add(procedure)
    db.session.commit()

    return {"status": "success", "id": procedure.id}

@app.route("/ask-procedure", methods=["POST"])
def ask_procedure():
    data = request.json
    question = data["question"]

    app.logger.info(
        "procedure.request request_id=%s question_chars=%s question_preview=%s",
        getattr(g, "request_id", "n/a"),
        len(question or ""),
        preview_text(question)
    )
    model = SentenceTransformer("all-MiniLM-L6-v2")
    question_embedding = model.encode(question).tolist()
    command = text("""
    SELECT name, steps
    FROM procedures
    ORDER BY embedding <=> (:question_embedding)::vector
    LIMIT 1
    """)
    try:
        result = db.session.execute(command, {"question_embedding": question_embedding}).fetchone()
    except Exception as e:
        app.logger.error(
            "procedure.error request_id=%s error=%s",
            getattr(g, "request_id", "n/a"),
            str(e)
        )
        return {"error": "An error occurred while processing the request"}, 500

    if not result:
        return {"error": "No procedures found"}, 404
    return {
        "name": result.name,
        "steps": result.steps
    }

@app.route("/upload-pdf", methods=["POST"])
def upload_pdf():
    if "file" not in request.files:
        return {"error": "No file uploaded"}, 400

    file = request.files["file"]
    filename = file.filename

    # Save temporarily
    filepath = f"/tmp/{filename}"
    file.save(filepath)

    # Hash the entire file to detect duplicate uploads
    with open(filepath, "rb") as f:
        file_hash = hashlib.sha256(f.read()).hexdigest()

    existing_pdf_doc = PDFDocument.query.filter_by(hash=file_hash).first()
    if existing_pdf_doc:
        return {
            "status": "duplicate",
            "message": "This file has already been processed.",
            "doc_id": existing_pdf_doc.id
        }, 200

    # Register the file in the documents table
    pdf_doc = PDFDocument(hash=file_hash)
    db.session.add(pdf_doc)
    db.session.flush()  # get pdf_doc.id before chunk inserts

    # Extract text by page
    pages = extract_text_by_page(filepath)

    if not pages:
        db.session.rollback()
        return {"error": "No extractable text found"}, 400

    total_chunks = 0
    deduped_chunks = 0

    for page_number, page_text in pages:
        page_chunks = chunk_text(page_text)
        for chunk in page_chunks:
            content_hash = compute_content_hash(chunk)
            existing_emb = find_embedding_by_hash(content_hash)
            if existing_emb:
                emb_id = existing_emb.id
                deduped_chunks += 1
            else:
                vector = get_embedding(chunk, source="upload_pdf")
                emb_result = db.session.execute(
                    text("""
                    INSERT INTO embedding (hash, content, embedding, tsv)
                    VALUES (:hash, :content, :embedding, to_tsvector('english', :content))
                    RETURNING id
                    """),
                    {"hash": content_hash, "content": chunk, "embedding": str(vector)}
                )
                emb_id = emb_result.scalar()
                total_chunks += 1
            db.session.execute(
                text("""
                INSERT INTO document (source, page_number, embedding_id, doc_id)
                VALUES (:source, :page_number, :embedding_id, :doc_id)
                """),
                {"source": filename, "page_number": page_number, "embedding_id": emb_id, "doc_id": pdf_doc.id}
            )
    db.session.commit()

    return {
        "status": "indexed",
        "chunks": total_chunks,
        "pages": len(pages),
        "deduped_chunks": deduped_chunks,
        "doc_id": pdf_doc.id
    }


@app.route("/documents", methods=["POST"])
def add_document():
    data = request.json
    content = data["content"]

    content_hash = compute_content_hash(content)
    existing_emb = find_embedding_by_hash(content_hash)
    if existing_emb:
        doc = Document.query.filter_by(embedding_id=existing_emb.id).first()
        return jsonify({"id": doc.id if doc else None, "deduped": True})

    vector = get_embedding(content, source="documents")
    source = data.get("source", "")  # Get the source if provided
    page_number = data.get("page_number")

    emb_result = db.session.execute(
        text("""
        INSERT INTO embedding (hash, content, embedding, tsv)
        VALUES (:hash, :content, :embedding, to_tsvector('english', :content))
        RETURNING id
        """),
        {
            "hash": content_hash,
            "content": content,
            "embedding": str(vector)
        }
    )
    emb_id = emb_result.scalar()

    doc_result = db.session.execute(
        text("""
        INSERT INTO document (source, page_number, embedding_id)
        VALUES (:source, :page_number, :embedding_id)
        RETURNING id
        """),
        {
            "source": source,
            "page_number": page_number,
            "embedding_id": emb_id
        }
    )
    db.session.commit()
    doc_id = doc_result.scalar()

    return jsonify({"id": doc_id})

@app.route("/ask", methods=["POST"])
def ask():

    data = request.json
    question = data["question"]
    session_id = data["session_id"]

    app.logger.info(
        "chat.request request_id=%s session_id=%s question_chars=%s question_preview=%s",
        getattr(g, "request_id", "n/a"),
        session_id,
        len(question or ""),
        preview_text(question)
    )

    # 1️⃣ load conversation memory
    history = load_history(session_id)

    # 2️⃣ embed question
    query_embedding = get_embedding(question, source="ask")

    # 3️⃣ retrieve RAG context
    results = get_hybrid_search_results(query_embedding, question, top_k=5)

    context_chunks = [row.content for row in results]
    context = "\n\n".join(context_chunks)

    # 4️⃣ build messages
    messages = [
        {
            "role": "system",
            "content": "Answer using the provided context when possible."
        }
    ]

    messages.extend(history)

    messages.append({
        "role": "user",
        "content": f"Context:\n{context}\n\nQuestion:\n{question}"
    })

    # 5️⃣ call LLM
    chat_payload = {
        "model": "gpt-4o",
        "messages": messages
    }
    save_request_object("messages", chat_payload)

    response = client.chat.completions.create(
        **chat_payload
    )

    answer = response.choices[0].message.content

    save_request_object("response", response.model_dump())

    app.logger.info(
        "chat.response request_id=%s session_id=%s answer_chars=%s answer_preview=%s",
        getattr(g, "request_id", "n/a"),
        session_id,
        len(answer or ""),
        preview_text(answer)
    )

    # 6️⃣ save conversation
    save_message(session_id, "user", question)
    save_message(session_id, "assistant", answer)

    return {"answer": answer}

def get_hybrid_search_results(query_embedding, query, top_k=5):
    """Helper function to perform hybrid search and return matches."""
    results = db.session.execute(
        text("""
        SELECT
            d.id,
            d.source,
            e.content,

            1 - (e.embedding <=> (:embedding)::vector) AS semantic_score,

            ts_rank(e.tsv, plainto_tsquery(:query)) AS keyword_score,

            (1 - (e.embedding <=> (:embedding)::vector)) +
            ts_rank(e.tsv, plainto_tsquery(:query)) AS hybrid_score

        FROM document d
        JOIN embedding e ON e.id = d.embedding_id

        WHERE
            e.tsv @@ plainto_tsquery(:query)
            OR e.embedding <=> (:embedding)::vector < 0.8

        ORDER BY hybrid_score DESC

        LIMIT :top_k
        """),
        {
            "embedding": query_embedding,
            "query": query,
            "top_k": top_k
        }
    )
    return results


@app.route("/search", methods=["POST"])
def hybrid_search():

    data = request.json
    query = data["query"]
    top_k = data.get("top_k", 5)

    query_embedding = get_embedding(query)
    results = get_hybrid_search_results(query_embedding, query, top_k)
    matches = [
        {
            "source": r.source,
            "content": r.content,
            "score": float(r.hybrid_score)
        }
        for r in results
    ]
    return {"results": matches}

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "version": "1.0.0",
        "service": "flask-semantic-search"
    }), 200


@app.route("/status", methods=["GET"])
def status():
    message_count = db.session.execute(text("SELECT COUNT(*) FROM message")).scalar()
    document_count = db.session.execute(text("SELECT COUNT(DISTINCT source) FROM document")).scalar()
    embeddings_count = db.session.execute(text("SELECT COUNT(*) FROM embedding")).scalar()
    requests_count = db.session.execute(text("SELECT COUNT(*) FROM requests")).scalar()
    procedures_count = db.session.execute(text("SELECT COUNT(*) FROM procedures")).scalar()

    return jsonify({
        "status": "ok",
        "tables": {
            "message": message_count,
            "document": document_count,
            "embeddings": embeddings_count,
            "requests": requests_count,
            "procedures": procedures_count
        }
    }), 200

@app.route("/requests", methods=["GET"])
def get_requests():
    """Get paginated requests ordered by timestamp descending."""
    try:
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 50))
    except ValueError:
        return jsonify({"error": "page and per_page must be integers"}), 400

    if page < 1:
        return jsonify({"error": "page must be greater than or equal to 1"}), 400

    if per_page < 1 or per_page > 200:
        return jsonify({"error": "per_page must be between 1 and 200"}), 400

    pagination = Requests.query.order_by(Requests.timestamp.desc()).paginate(
        page=page,
        per_page=per_page,
        error_out=False 
    )

    requests_data = pagination.items

    return jsonify({
        "requests": [
            {
                "id": req.id,
                "type": req.type,
                "object": req.object,
                "timestamp": req.timestamp.isoformat() if req.timestamp else None
            }
            for req in requests_data
        ],
        "total": pagination.total,
        "page": pagination.page,
        "per_page": pagination.per_page,
        "total_pages": pagination.pages,
        "has_next": pagination.has_next,
        "has_prev": pagination.has_prev
    }), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

