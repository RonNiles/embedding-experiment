import { useState, useEffect } from "react";
import { askQuestion, getStatus } from "./api";
import UploadPDF from "./UploadPDF";
import UploadProcedure from "./UploadProcedure";
import AskProcedure from "./AskProcedure";
import BrowseRequests from "./BrowseRequests";

const sessionId = crypto.randomUUID();
const appJsxModifiedAt = import.meta.env.VITE_APP_JSX_MTIME || "unknown";

export default function App() {

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);

  async function fetchStatus() {
    setStatusLoading(true);
    try {
      const result = await getStatus();
      setStatus(result);
    } catch (err) {
      console.error("Error fetching status:", err);
      setStatus({ error: "Failed to fetch status" });
    }
    setStatusLoading(false);
  }

  useEffect(() => {
    fetchStatus();
  }, []);

  async function sendMessage() {

    if (!input.trim()) return;

    const userMessage = { role: "user", text: input };

    setMessages(m => [...m, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const result = await askQuestion(input, sessionId);

      const botMessage = {
        role: "assistant",
        text: result.answer
      };

      setMessages(m => [...m, botMessage]);

    } catch (err) {
      setMessages(m => [...m, {
        role: "assistant",
        text: "Error contacting server."
      }]);
    }

    setLoading(false);
  }

  return (
    <div style={styles.container}>

      <h2>Local RAG Assistant</h2>
  
      <div style={styles.statusBar}>
        <div style={styles.statusContent}>
          {statusLoading ? (
            <span>Loading status...</span>
          ) : status?.error ? (
            <span style={styles.error}>{status.error}</span>
          ) : status ? (
            <>
              <span style={styles.statusItem}>Status: <strong>{status.status}</strong></span>
              <span style={styles.statusItem}>App.jsx Modified: <strong>{appJsxModifiedAt}</strong></span>
              <span style={styles.statusItem}>Messages: <strong>{status.tables?.message || 0}</strong></span>
              <span style={styles.statusItem}>Documents: <strong>{status.tables?.document || 0}</strong></span>
              <span style={styles.statusItem}>Embeddings: <strong>{status.tables?.embeddings || 0}</strong></span>
              <span style={styles.statusItem}>Requests: <strong>{status.tables?.requests || 0}</strong></span>
              <span style={styles.statusItem}>Procedures: <strong>{status.tables?.procedures || 0}</strong></span>
            </>
          ) : (
            <span>No status available</span>
          )}
        </div>
        <button style={styles.refreshButton} onClick={fetchStatus} disabled={statusLoading}>
          ↻ Refresh
        </button>
      </div>

      <div style={styles.dashboardGrid}>
        <div style={styles.column}>
          <div style={styles.sectionTitle}>Procedures</div>
          <div style={styles.uploadSection}>
            <UploadProcedure onSuccess={fetchStatus} />
          </div>
          <div style={styles.uploadSection}>
            <AskProcedure />
          </div>
        </div>

        <div style={styles.column}>
          <div style={styles.sectionTitle}>Chat & Documents</div>
          <div style={styles.chat}>

            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  ...styles.message,
                  ...(msg.role === "user"
                    ? styles.user
                    : styles.bot)
                }}
              >
                {msg.text}
              </div>
            ))}

            {loading && <div style={styles.bot}>Thinking...</div>}

          </div>

          <div style={styles.inputRow}>
            <input
              style={styles.input}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about your documents..."
              onKeyDown={e => e.key === "Enter" && sendMessage()}
            />

            <button style={styles.button} onClick={sendMessage}>
              Send
            </button>
          </div>

          <div style={styles.uploadSection}>
            <UploadPDF />
          </div>
        </div>
      </div>

      <div style={styles.browseSection}>
        <BrowseRequests />
      </div>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "Arial",
    width: "1200px",
    maxWidth: "95vw",
    margin: "40px auto"
  },

  dashboardGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
    alignItems: "start"
  },

  column: {
    display: "flex",
    flexDirection: "column"
  },

  sectionTitle: {
    fontSize: "16px",
    fontWeight: "bold",
    marginBottom: "8px",
    color: "#333"
  },

  statusBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px",
    background: "#f5f5f5",
    border: "1px solid #ddd",
    borderRadius: "8px",
    marginBottom: "10px",
    fontSize: "14px"
  },

  statusContent: {
    display: "flex",
    gap: "15px",
    flexWrap: "wrap"
  },

  statusItem: {
    color: "#333"
  },

  refreshButton: {
    padding: "6px 12px",
    background: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px"
  },

  error: {
    color: "#d9534f"
  },

  chat: {
    border: "1px solid #ddd",
    borderRadius: "8px",
    padding: "10px",
    height: "400px",
    overflowY: "auto",
    marginBottom: "10px"
  },

  message: {
    padding: "8px 12px",
    borderRadius: "6px",
    marginBottom: "8px",
    maxWidth: "80%"
  },

  user: {
    background: "#daf1ff",
    marginLeft: "auto"
  },

  bot: {
    background: "#eee"
  },

  inputRow: {
    display: "flex"
  },

  input: {
    flex: 1,
    padding: "8px"
  },

  button: {
    padding: "8px 16px"
  },

  uploadSection: {
    marginTop: "20px"
  },

  browseSection: {
    marginTop: "30px"
  }
};
