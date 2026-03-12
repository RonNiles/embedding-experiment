import { useState, useEffect } from "react";
import { getRequests } from "./api";

export default function BrowseRequests() {
  const [requests, setRequests] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function fetchRequests(pageToFetch = currentPage) {
    setLoading(true);
    setError(null);
    try {
      const result = await getRequests(pageToFetch, perPage);
      setRequests(result.requests || []);
      setCurrentIndex(0);
      setCurrentPage(result.page || pageToFetch);
      setTotal(result.total || 0);
      setTotalPages(result.total_pages || 0);
      setHasNextPage(Boolean(result.has_next));
      setHasPreviousPage(Boolean(result.has_prev));
    } catch (err) {
      console.error("Error fetching requests:", err);
      setError("Failed to fetch requests");
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchRequests(1);
  }, [perPage]);

  function goToNext() {
    if (currentIndex < requests.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }

  function goToNext10() {
    setCurrentIndex(Math.min(currentIndex + 10, requests.length - 1));
  }

  function goToPrevious() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }

  function goToPrevious10() {
    setCurrentIndex(Math.max(currentIndex - 10, 0));
  }

  function goToFirst() {
    setCurrentIndex(0);
  }

  function goToLast() {
    setCurrentIndex(requests.length - 1);
  }

  function goToPage(pageNumber) {
    if (pageNumber < 1 || pageNumber > totalPages || pageNumber === currentPage) {
      return;
    }
    fetchRequests(pageNumber);
  }

  function goToNextPage() {
    if (hasNextPage) {
      goToPage(currentPage + 1);
    }
  }

  function goToPreviousPage() {
    if (hasPreviousPage) {
      goToPage(currentPage - 1);
    }
  }

  function goToNext10Pages() {
    goToPage(Math.min(currentPage + 10, totalPages));
  }

  function goToPrevious10Pages() {
    goToPage(Math.max(currentPage - 10, 1));
  }

  const currentRequest = requests[currentIndex];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Browse Requests</h3>
        <div style={styles.headerControls}>
          <label style={styles.densityLabel} htmlFor="request-density">
            Requests per page
          </label>
          <select
            id="request-density"
            style={styles.densitySelect}
            value={perPage}
            onChange={(event) => setPerPage(Number(event.target.value))}
            disabled={loading}
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <button style={styles.refreshButton} onClick={() => fetchRequests(currentPage)} disabled={loading}>
            {loading ? "Loading..." : "↻ Refresh"}
          </button>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {!loading && requests.length === 0 && (
        <div style={styles.empty}>No requests found</div>
      )}

      {requests.length > 0 && currentRequest && (
        <div>
          <div style={styles.navigation}>
            <div style={styles.navigationButtons}>
              <button style={styles.navButton} onClick={() => goToPage(1)} disabled={currentPage === 1 || loading}>
                ⟪ First Page
              </button>
              <button style={styles.navButton} onClick={goToPrevious10Pages} disabled={currentPage === 1 || loading}>
                ← Previous 10 Pages
              </button>
              <button style={styles.navButton} onClick={goToPreviousPage} disabled={!hasPreviousPage || loading}>
                ← Previous Page
              </button>
              <span style={styles.counter}>
                Page {currentPage} of {totalPages || 1}
              </span>
              <button style={styles.navButton} onClick={goToNextPage} disabled={!hasNextPage || loading}>
                Next Page →
              </button>
              <button style={styles.navButton} onClick={goToNext10Pages} disabled={currentPage === totalPages || loading}>
                Next 10 Pages →
              </button>
              <button style={styles.navButton} onClick={() => goToPage(totalPages || 1)} disabled={currentPage === totalPages || loading}>
                Last Page ⟫
              </button>
            </div>
            <div style={styles.pageInfo}>
              Total requests: {total} (showing up to {perPage} per page)
            </div>
          </div>

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
                onClick={goToPrevious10} 
                disabled={currentIndex === 0}
              >
                ← Previous 10
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
                onClick={goToNext10} 
                disabled={currentIndex === requests.length - 1}
              >
                Next 10 →
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
  headerControls: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    justifyContent: "flex-end"
  },
  densityLabel: {
    fontSize: "14px",
    color: "#444",
    fontWeight: "600"
  },
  densitySelect: {
    padding: "6px 8px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    fontSize: "14px",
    background: "#fff"
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
    flexWrap: "wrap",
    gap: "8px"
  },
  pageInfo: {
    textAlign: "center",
    marginTop: "8px",
    color: "#555",
    fontSize: "14px"
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
