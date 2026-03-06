export async function askQuestion(question, sessionId) {
  const response = await fetch("http://127.0.0.1:5000/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      question: question,
      session_id: sessionId
    })
  });

  return response.json();
}

export async function getStatus() {
  const response = await fetch("http://127.0.0.1:5000/status", {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  });

  return response.json();
}
