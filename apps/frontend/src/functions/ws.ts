interface Env {
  BACKEND_URL: string;
}

export default {
  async fetch(request: Request, env: Env) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 400 });
    }

    // Change this section to check the header
    const authHeader = request.headers.get("Authorization");
    // Example: "Bearer your_token_here"
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response("Missing or invalid Authorization header", { status: 403 });
    }
    const token = authHeader.split(" ")[1]; // Extracts the token

    const [client, workerSocket] = Object.values(new WebSocketPair());
    workerSocket.accept();

    try {
      const backendUrl = new URL(env.BACKEND_URL);
      backendUrl.searchParams.set("token", token);
      
      // Connect to backend WebSocket
      const backendSocket = new WebSocket(backendUrl.toString());

      // Forward messages frontend → backend
      workerSocket.addEventListener("message", (event) => {
        try {
          if (backendSocket.readyState === WebSocket.OPEN) {
            backendSocket.send(event.data);
          }
        } catch (err) {
          console.error("Error sending to backend:", err);
          workerSocket.send(JSON.stringify({
            type: "error",
            message: "Failed to send message to backend",
            details: err instanceof Error ? err.message : String(err),
          }));
        }
      });

      // Forward messages backend → frontend
      backendSocket.addEventListener("message", (event) => {
        try {
          if (workerSocket.readyState === WebSocket.OPEN) {
            workerSocket.send(event.data);
          }
        } catch (err) {
          console.error("Error sending to client:", err);
        }
      });

      // Handle connection open
      backendSocket.addEventListener("open", () => {
        console.log("Backend WebSocket connection established");
      });

      // Handle closures
      workerSocket.addEventListener("close", () => {
        if (backendSocket.readyState === WebSocket.OPEN) {
          backendSocket.close();
        }
      });
      
      backendSocket.addEventListener("close", () => {
        if (workerSocket.readyState === WebSocket.OPEN) {
          workerSocket.close();
        }
      });

      // Handle errors
      workerSocket.addEventListener("error", (error) => {
        console.error("Worker socket error:", error);
        if (backendSocket.readyState === WebSocket.OPEN) {
          backendSocket.close();
        }
      });

      backendSocket.addEventListener("error", (event) => {
  // The event object itself contains more useful details
  const errorDetails =  "Failed to connect to the backend WebSocket server.";
  console.error("Backend socket error:", event); 
  
  if (workerSocket.readyState === WebSocket.OPEN) {
    workerSocket.send(JSON.stringify({
      type: "error",
      message: "Backend WebSocket error",
      details: errorDetails,
    }));
    workerSocket.close();
  }
});

    } catch (error) {
      console.error("WebSocket proxy error:", error);
      workerSocket.send(
        JSON.stringify({
          type: "error",
          message: "Failed to connect to backend WebSocket",
          details: error instanceof Error ? error.message : String(error),
        })
      );
      workerSocket.close(1011, "Backend connection failed");
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  },
};