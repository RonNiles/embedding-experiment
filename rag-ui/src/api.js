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

export async function uploadProcedure(name, description, steps) {
  const response = await fetch("http://127.0.0.1:5000/upload-procedure", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name,
      description,
      steps
    })
  });

  return response.json();
}

export async function askProcedure(question) {
  const response = await fetch("http://127.0.0.1:5000/ask-procedure", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      question
    })
  });

  return response.json();
}

export async function getRequests(page = 1, perPage = 25) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage)
  });

  const response = await fetch(`http://127.0.0.1:5000/requests?${params.toString()}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  });

  return response.json();
}
