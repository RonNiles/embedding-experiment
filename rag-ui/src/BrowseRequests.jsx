import { useState, useEffect } from "react";
import { getRequests } from "./api";

export default function BrowseRequests() {
  const [requests, setRequests] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function fetchRequests() {
    setLoading(true);
    setError(null);
    try {
      const result = await getRequests();
      setRequests(result.requests || []);
      setCurrentIndex(0);
    } catch (err) {
      console.error("Error fetching requests:", err);
      setError("Failed to fetch requests");
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchRequests();
  }, []);

  function goToNext() {
    if (currentIndex < requests.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }

  function goToPrevious() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }

  function goToFirst() {
    setCurrentIndex(0);
  }

  function goToLast() {
    setCurrentIndex(requests.length - 1);
  }

  const currentRequest = requests[currentIndex];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Browse Requests</h3>
        <button style={styles.refreshButton} onClick={fetchRequests} disabled={loading}>
          {loading ? "Loading..." : "↻ Refresh"}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {!loading && requests.length === 0 && (
        <div style={styles.empty}>No requests found</div>
      )}

      {requests.length > 0 && currentRequest && (
        <div>
          <div style={styles.navigation}>
            <div style={styles.navigationButtons}>
              <button 
                style={styles.navButton} 
                onClick={goToFirst} 
                disabled={currentIndex === 0}
              >
                ⟪ First
              </button>
              <button 
                style={styles.navButton} 
                onClick={goToPrevious} 
                disabled={currentIndex === 0}
              >
                ← Previous
              </button>
              <span style={styles.counter}>
                {currentIndex + 1} of {requests.length}
              </span>
              <button 
                style={styles.navButton} 
                onClick={goToNext} 
                disabled={currentIndex === requests.length - 1}
              >
                Next →
              </button>
              <button 
                style={styles.navButton} 
                onClick={goToLast} 
                disabled={currentIndex === requests.length - 1}
              >
                Last ⟫
              </button>
            </div>
          </div>

          <div style={styles.requestCard}>
            <div style={styles.row}>
              <span style={styles.label}>ID:</span>
              <span style={styles.value}>{currentRequest.id}</span>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Type:</span>
              <span style={{...styles.value, ...styles.typeBadge}}>
                {currentRequest.type}
              </span>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Timestamp:</span>
              <span style={styles.value}>
                {currentRequest.timestamp 
                  ? new Date(currentRequest.timestamp).toLocaleString() 
                  : "N/A"}
              </span>
            </div>
            <div style={styles.objectSection}>
              <div style={styles.label}>Request Object:</div>
              <pre style={styles.jsonDisplay}>
                {JSON.stringify(currentRequest.object, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    border: "1px solid #ddd",
    borderRadius: "8px",
    padding: "16px",
    background: "#fff"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px"
  },
  title: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "bold"
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
    color: "#d9534f",
    padding: "10px",
    background: "#f8d7da",
    borderRadius: "4px",
    marginBottom: "10px"
  },
  empty: {
    textAlign: "center",
    padding: "20px",
    color: "#666"
  },
  navigation: {
    marginBottom: "16px"
  },
  navigationButtons: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px"
  },
  navButton: {
    padding: "8px 12px",
    background: "#f0f0f0",
    border: "1px solid #ccc",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px"
  },
  counter: {
    padding: "0 12px",
    fontWeight: "bold",
    fontSize: "14px"
  },
  requestCard: {
    border: "1px solid #e0e0e0",
    borderRadius: "6px",
    padding: "16px",
    background: "#f9f9f9"
  },
  row: {
    display: "flex",
    marginBottom: "12px",
    alignItems: "center"
  },
  label: {
    fontWeight: "bold",
    marginRight: "8px",
    minWidth: "100px",
    color: "#555"
  },
  value: {
    color: "#333"
  },
  typeBadge: {
    background: "#007bff",
    color: "white",
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: "bold"
  },
  objectSection: {
    marginTop: "16px"
  },
  jsonDisplay: {
    background: "#2d2d2d",
    color: "#f8f8f2",
    padding: "12px",
    borderRadius: "4px",
    overflowX: "auto",
    fontSize: "12px",
    maxHeight: "400px",
    overflowY: "auto"
  }
};
