# Flask Semantic Search API

A powerful semantic search API built with Flask, PostgreSQL (pgvector), and OpenAI embeddings. This application enables intelligent document search and question-answering capabilities using vector embeddings and retrieval-augmented generation (RAG).

## 🚀 Features

- **PDF Document Processing**: Upload and automatically process PDF files with page-by-page extraction
- **Semantic Search**: Find relevant content using natural language queries with cosine similarity
- **RAG Question Answering**: Get contextual answers powered by GPT-4 using retrieved document chunks
- **Vector Embeddings**: Generate embeddings using OpenAI's text-embedding-3-small model
- **Chunking Strategy**: Intelligent text chunking with configurable overlap for better context preservation
- **PostgreSQL + pgvector**: High-performance vector similarity search with native PostgreSQL support
- **Docker Support**: Fully containerized application for easy deployment

## 🛠️ Technologies

- **Backend**: Flask, Flask-SQLAlchemy
- **Database**: PostgreSQL 15 with pgvector extension
- **AI/ML**: OpenAI API (text-embedding-3-small, GPT-4)
- **PDF Processing**: pdfminer.six
- **Containerization**: Docker, Docker Compose

## 📋 Prerequisites

- Docker and Docker Compose
- OpenAI API key

## 🔧 Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd flask-semantic-search
```

### 2. Set Up Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit the `.env` file and add your OpenAI API key:

```env
OPENAI_API_KEY=your-actual-api-key-here
```

### 3. Start the Application

```bash
docker-compose up --build
```

The API will be available at `http://localhost:5000`

## 📚 API Endpoints

### 1. Upload PDF Document

Upload and index a PDF file with automatic text extraction and chunking.

**Endpoint**: `POST /upload-pdf`

**Request**:
```bash
curl -X POST http://localhost:5000/upload-pdf \
  -F "file=@document.pdf"
```

**Response**:
```json
{
  "status": "indexed",
  "chunks": 42,
  "pages": 12
}
```

### 2. Add Text Document

Manually add a text document to the database.

**Endpoint**: `POST /documents`

**Request**:
```bash
curl -X POST http://localhost:5000/documents \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Your document content here",
    "source": "document-name.txt",
    "page_number": 1
  }'
```

**Response**:
```json
{
  "id": 123
}
```

### 3. Semantic Search

Search for similar content using natural language queries.

**Endpoint**: `POST /search`

**Request**:
```bash
curl -X POST http://localhost:5000/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is machine learning?",
    "top_k": 3
  }'
```

**Response**:
```json
[
  {
    "id": 45,
    "source": "ml-guide.pdf",
    "page_number": 3,
    "content": "Machine learning is a subset of artificial intelligence...",
    "similarity": 0.8542
  }
]
```

### 4. Ask Questions (RAG)

Ask questions and get AI-generated answers based on your indexed documents.

**Endpoint**: `POST /ask`

**Request**:
```bash
curl -X POST http://localhost:5000/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are the main benefits of semantic search?",
    "top_k": 5
  }'
```

**Response**:
```json
{
  "answer": "Based on the context, the main benefits of semantic search include...",
  "sources_used": 5
}
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@db:5432/appdb` |
| `OPENAI_API_KEY` | Your OpenAI API key | Required |

### Customizable Parameters

- **Embedding Dimension**: Default is 1536 (text-embedding-3-small)
- **Chunk Size**: Default is 500 characters
- **Chunk Overlap**: Default is 50 characters
- **Top K Results**: Configurable per request (default: 3-5)

## 🏗️ Project Structure

```
flask-semantic-search/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── Dockerfile            # Docker configuration for the API
├── docker-compose.yml    # Multi-container setup (PostgreSQL + API)
├── .env                  # Environment variables (not in version control)
├── .env.example          # Example environment variables template
├── .gitignore            # Git ignore rules
└── README.md            # Project documentation
```

## 🔍 How It Works

1. **Document Ingestion**: PDFs or text documents are uploaded and split into chunks
2. **Embedding Generation**: Each chunk is converted to a 1536-dimensional vector using OpenAI's embedding model
3. **Storage**: Vectors are stored in PostgreSQL with pgvector extension for efficient similarity search
4. **Query Processing**: User queries are embedded using the same model
5. **Similarity Search**: Cosine similarity is used to find the most relevant chunks
6. **Answer Generation**: For `/ask` endpoint, relevant chunks are sent to GPT-4 as context to generate accurate answers

## 🚢 Deployment

### Local Development

```bash
# Start services
docker-compose up

# Stop services
docker-compose down

# View logs
docker-compose logs -f api
```

### Production Considerations

- Use environment variable files instead of hardcoding API keys
- Set up proper database backups
- Implement rate limiting
- Add authentication/authorization
- Configure CORS for frontend integration
- Use a production-grade WSGI server (e.g., Gunicorn)

## 📝 Example Workflow

```bash
# 1. Upload a PDF
curl -X POST http://localhost:5000/upload-pdf \
  -F "file=@research-paper.pdf"

# 2. Search for relevant content
curl -X POST http://localhost:5000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "neural networks", "top_k": 3}'

# 3. Ask a question
curl -X POST http://localhost:5000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "How do neural networks learn?", "top_k": 5}'
```

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## 📄 License

This project is provided as-is for educational and development purposes.

## ⚠️ Security Note

Remember to:
- Never commit API keys to version control
- Use environment variables or secrets management
- Rotate API keys regularly
- Implement proper access controls in production