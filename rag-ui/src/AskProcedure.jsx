import { useState } from "react";
import { askProcedure } from "./api";

export default function AskProcedure() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!question.trim()) {
      setError("Question is required");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await askProcedure(question.trim());

      if (response.error) {
        setError(response.error);
      } else {
        setResult(response);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to ask procedure");
    }

    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Ask Procedure</h3>
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.field}>
          <label style={styles.label}>Question</label>
          <input
            type="text"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            style={styles.input}
            placeholder="Ask which procedure to follow..."
            disabled={loading}
          />
        </div>

        <button type="submit" style={styles.submitButton} disabled={loading}>
          {loading ? "Searching..." : "Ask Procedure"}
        </button>
      </form>

      {error && <div style={{ ...styles.message, ...styles.errorMessage }}>{error}</div>}

      {result && (
        <div style={{ ...styles.message, ...styles.successMessage }}>
          <div style={styles.resultTitle}>{result.name}</div>
          <ol style={styles.stepsList}>
            {Array.isArray(result.steps) && result.steps.map((step, index) => (
              <li key={`${index}-${step}`}>{step}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    border: "1px solid #ddd",
    borderRadius: "8px",
    padding: "20px",
    background: "#fafafa"
  },

  title: {
    marginTop: 0,
    marginBottom: "15px",
    fontSize: "18px",
    fontWeight: "bold"
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: "15px"
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: "5px"
  },

  label: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#333"
  },

  input: {
    padding: "8px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    fontSize: "14px"
  },

  submitButton: {
    padding: "10px",
    background: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "bold"
  },

  message: {
    marginTop: "15px",
    padding: "10px",
    borderRadius: "4px",
    fontSize: "14px"
  },

  resultTitle: {
    fontWeight: "bold",
    marginBottom: "8px"
  },

  stepsList: {
    margin: 0,
    paddingLeft: "20px"
  },

  successMessage: {
    background: "#d4edda",
    color: "#155724",
    border: "1px solid #c3e6cb"
  },

  errorMessage: {
    background: "#f8d7da",
    color: "#721c24",
    border: "1px solid #f5c6cb"
  }
};
