import { useState } from "react";
import { uploadProcedure } from "./api";

export default function UploadProcedure({ onSuccess }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState(["", ""]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const handleAddStep = () => {
    setSteps([...steps, ""]);
  };

  const handleRemoveStep = (index) => {
    if (steps.length > 2) {
      setSteps(steps.filter((_, i) => i !== index));
    }
  };

  const handleStepChange = (index, value) => {
    const newSteps = [...steps];
    newSteps[index] = value;
    setSteps(newSteps);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setMessage("Procedure name is required");
      return;
    }

    const validSteps = steps.filter(s => s.trim() !== "");
    if (validSteps.length < 2) {
      setMessage("At least two steps are required");
      return;
    }

    setUploading(true);
    setMessage("");

    try {
      const result = await uploadProcedure(name.trim(), description.trim(), validSteps);
      
      if (result.error) {
        setMessage(`Error: ${result.error}`);
      } else {
        setMessage("Procedure uploaded successfully!");
        setName("");
        setDescription("");
        setSteps(["", ""]);
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      console.error(err);
      setMessage("Upload failed");
    }

    setUploading(false);
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Upload Procedure</h3>
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.field}>
          <label style={styles.label}>
            Procedure Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={styles.input}
            placeholder="Enter procedure name"
            disabled={uploading}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...styles.input, ...styles.textarea }}
            placeholder="Enter procedure description"
            disabled={uploading}
            rows={3}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>
            Steps * (minimum 2)
          </label>
          {steps.map((step, index) => (
            <div key={index} style={styles.stepRow}>
              <input
                type="text"
                value={step}
                onChange={(e) => handleStepChange(index, e.target.value)}
                style={{ ...styles.input, flex: 1 }}
                placeholder={`Step ${index + 1}`}
                disabled={uploading}
              />
              {steps.length > 2 && (
                <button
                  type="button"
                  onClick={() => handleRemoveStep(index)}
                  style={styles.removeButton}
                  disabled={uploading}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddStep}
            style={styles.addButton}
            disabled={uploading}
          >
            + Add Step
          </button>
        </div>

        <button
          type="submit"
          style={styles.submitButton}
          disabled={uploading}
        >
          {uploading ? "Uploading..." : "Upload Procedure"}
        </button>

        {message && (
          <div style={{
            ...styles.message,
            ...(message.includes("Error") || message.includes("failed") 
              ? styles.errorMessage 
              : styles.successMessage)
          }}>
            {message}
          </div>
        )}
      </form>
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

  textarea: {
    resize: "vertical",
    fontFamily: "Arial, sans-serif"
  },

  stepRow: {
    display: "flex",
    gap: "8px",
    marginBottom: "8px",
    alignItems: "center"
  },

  removeButton: {
    padding: "8px 12px",
    background: "#dc3545",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px"
  },

  addButton: {
    padding: "8px 12px",
    background: "#28a745",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
    alignSelf: "flex-start"
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
    padding: "10px",
    borderRadius: "4px",
    fontSize: "14px"
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
