package agents

import (
	"backend/database"
	"backend/models"
	"backend/services"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	amqp "github.com/rabbitmq/amqp091-go"
)

// WebSocket upgrader
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	Subprotocols:    []string{"websocket"},
}

// WebSocket connection manager
type WebSocketManager struct {
	connections map[string]*WebSocketConnection
	mutex       sync.RWMutex
}

type WebSocketConnection struct {
	ID        string
	UserID    string
	AuthToken string
	Conn      *websocket.Conn
	Send      chan []byte
	Manager   *WebSocketManager
}

// Global WebSocket manager
var wsManager = &WebSocketManager{
	connections: make(map[string]*WebSocketConnection),
}

// RabbitMQ connection and channel
var (
	rabbitmqConn    *amqp.Connection
	rabbitmqChannel *amqp.Channel
	logger          *services.DatabaseLogger
	dbClient        *database.DB
)

// SetLogger sets the database logger for the agents package
func SetLogger(db *database.DB) {
	logger = services.NewDatabaseLogger(db)
}

// SetDB sets the database client for the agents package
func SetDB(db *database.DB) {
	dbClient = db
}

// resolveOrganizationID tries to determine the organization ID for a user
func resolveOrganizationID(userID string) (string, error) {
	if dbClient == nil || userID == "" {
		return "", nil
	}

	// Parse user UUID
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return "", nil
	}

	// Prefer user's primary OrganizationID if set
	var user models.User
	if err := dbClient.Where("id = ?", userUUID).First(&user).Error; err == nil {
		if user.OrganizationID != nil {
			return user.OrganizationID.String(), nil
		}
	}

	// Fallback: first active membership from user_organizations
	var userOrg models.UserOrganization
	if err := dbClient.Where("user_id = ? AND is_active = true", userUUID).First(&userOrg).Error; err == nil {
		return userOrg.OrganizationID.String(), nil
	}

	return "", nil
}

// Initialize RabbitMQ connection
func initRabbitMQ() error {
	// Get RabbitMQ URL from environment
	rabbitmqURL := os.Getenv("RABBITMQ_URL")
	if rabbitmqURL == "" {
		rabbitmqURL = "amqp://sami:sami%401234@localhost:5672/%2F" // fallback
	}

	var err error
	rabbitmqConn, err = amqp.Dial(rabbitmqURL)
	if err != nil {
		return err
	}

	rabbitmqChannel, err = rabbitmqConn.Channel()
	if err != nil {
		return err
	}

	// Declare exchange for agent requests
	err = rabbitmqChannel.ExchangeDeclare(
		"agent_requests", // name
		"direct",         // type
		true,             // durable
		false,            // auto-deleted
		false,            // internal
		false,            // no-wait
		nil,              // arguments
	)
	if err != nil {
		return err
	}

	// Declare agent request queue
	_, err = rabbitmqChannel.QueueDeclare(
		"agent_request_queue", // name
		true,                  // durable
		false,                 // delete when unused
		false,                 // exclusive
		false,                 // no-wait
		nil,                   // arguments
	)
	if err != nil {
		return err
	}

	// Declare agent response queue
	_, err = rabbitmqChannel.QueueDeclare(
		"agent_response_queue", // name
		true,                   // durable
		false,                  // delete when unused
		false,                  // exclusive
		false,                  // no-wait
		nil,                    // arguments
	)
	if err != nil {
		return err
	}

	// Bind queues to exchange
	err = rabbitmqChannel.QueueBind(
		"agent_request_queue", // queue name
		"agent_request",       // routing key
		"agent_requests",      // exchange
		false,
		nil,
	)
	if err != nil {
		return err
	}

	err = rabbitmqChannel.QueueBind(
		"agent_response_queue", // queue name
		"agent_response",       // routing key
		"agent_requests",       // exchange
		false,
		nil,
	)
	if err != nil {
		return err
	}

	_, err = rabbitmqChannel.QueueDeclare(
		"asset_processing_queue",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return err
	}

	err = rabbitmqChannel.QueueBind(
		"asset_processing_queue",
		"asset_process",
		"agent_requests",
		false,
		nil,
	)
	if err != nil {
		return err
	}

	log.Println("✅ Agent RabbitMQ queues initialized successfully")

	// Start consuming responses for WebSocket notifications
	go startResponseConsumer()

	return nil
}

func aiEngineBaseURL() (string, bool) {
	v := strings.TrimRight(os.Getenv("AI_ENGINE_URL"), "/")
	if v == "" {
		return "", false
	}
	return v, true
}

func proxyGetJSON(c *gin.Context, path string) {
	if _, ok := c.Get("user_id"); !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	base, ok := aiEngineBaseURL()
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI_ENGINE_URL not configured"})
		return
	}
	url := base + path
	if raw := c.Request.URL.RawQuery; raw != "" {
		url += "?" + raw
	}
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, url, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to build upstream request"})
		return
	}
	auth := c.GetHeader("Authorization")
	if auth == "" {
		if t := c.Query("token"); t != "" {
			auth = "Bearer " + t
		}
	}
	if auth != "" {
		req.Header.Set("Authorization", auth)
	}
	req.Header.Set("Accept", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "upstream unavailable"})
		return
	}
	defer resp.Body.Close()
	c.Status(resp.StatusCode)
	c.Header("Content-Type", resp.Header.Get("Content-Type"))
	io.Copy(c.Writer, resp.Body)
}

// Proxy-backed REST endpoints
// List Agents godoc
// @Summary      List Agents
// @Description  Proxies to AI engine to list available agents and their tools
// @Tags         agents
// @Security     Bearer
// @Produce      json
// @Success      200  {array}   map[string]interface{}
// @Failure      401  {object}  ErrorResponse
// @Failure      500  {object}  ErrorResponse
// @Router       /api/v1/agents/ [get]
func listAgents() gin.HandlerFunc {
	return func(c *gin.Context) { proxyGetJSON(c, "/api/v1/agents/") }
}

// List Agent Tools godoc
// @Summary      List Agent Tools
// @Description  Proxies to AI engine to list tools for a given agent
// @Tags         agents
// @Security     Bearer
// @Produce      json
// @Param        agent  path  string  true  "Agent name (e.g., product_researcher, marketer)"
// @Success      200  {array}   map[string]interface{}
// @Failure      401  {object}  ErrorResponse
// @Failure      500  {object}  ErrorResponse
// @Router       /api/v1/agents/{agent}/tools [get]
func listAgentTools() gin.HandlerFunc {
	return func(c *gin.Context) {
		agent := c.Param("agent")
		proxyGetJSON(c, "/api/v1/agents/"+agent+"/tools")
	}
}

// List Chats godoc
// @Summary      List Chats
// @Description  Proxies to AI engine to list chats for the authenticated user
// @Tags         agents
// @Security     Bearer
// @Produce      json
// @Success      200  {array}   map[string]interface{}
// @Failure      401  {object}  ErrorResponse
// @Failure      500  {object}  ErrorResponse
// @Router       /api/v1/agents/chats [get]
func listChats() gin.HandlerFunc {
	return func(c *gin.Context) { proxyGetJSON(c, "/api/v1/agents/chats") }
}

// Get Chat godoc
// @Summary      Get Chat
// @Description  Proxies to AI engine to fetch a single chat by ID
// @Tags         agents
// @Security     Bearer
// @Produce      json
// @Param        chat_id  path  string  true  "Chat ID"
// @Success      200  {object}  map[string]interface{}
// @Failure      401  {object}  ErrorResponse
// @Failure      500  {object}  ErrorResponse
// @Router       /api/v1/agents/chats/{chat_id} [get]
func getChat() gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("chat_id")
		proxyGetJSON(c, "/api/v1/agents/chats/"+chatID)
	}
}

// Get Chat Messages godoc
// @Summary      Get Chat Messages
// @Description  Proxies to AI engine to fetch messages for a chat
// @Tags         agents
// @Security     Bearer
// @Produce      json
// @Param        chat_id  path  string  true  "Chat ID"
// @Success      200  {object}  map[string]interface{}
// @Failure      401  {object}  ErrorResponse
// @Failure      500  {object}  ErrorResponse
// @Router       /api/v1/agents/chats/{chat_id}/messages [get]
func getChatMessages() gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("chat_id")
		proxyGetJSON(c, "/api/v1/agents/chats/"+chatID+"/messages")
	}
}

// Start consuming AI engine responses
func startResponseConsumer() {
	msgs, err := rabbitmqChannel.Consume(
		"agent_response_queue", // queue
		"",                     // consumer
		false,                  // auto-ack (set to false for manual ack)
		false,                  // exclusive
		false,                  // no-local
		false,                  // no-wait
		nil,                    // args
	)
	if err != nil {
		log.Printf("Failed to start response consumer: %v", err)
		return
	}

	for msg := range msgs {
		var response AgentResponse
		if err := json.Unmarshal(msg.Body, &response); err != nil {
			log.Printf("Failed to unmarshal response: %v", err)
			log.Printf("Raw message body: %s", string(msg.Body))
			// Reject the message and don't requeue it (it's malformed)
			msg.Nack(false, false)
			continue
		}

		// Notify WebSocket clients about the response
		if err := wsManager.BroadcastResponse(response); err != nil {
			log.Printf("Failed to broadcast response: %v", err)
			// Still acknowledge the message since the response was valid,
			// but the WebSocket broadcast failed (maybe no clients connected)
		}

		// Print the agent response to terminal before acking
		log.Printf("📨 Agent Response Received:")
		log.Printf("  Request ID: %s", response.RequestID)
		log.Printf("  User ID: %s", response.UserID)
		log.Printf("  Chat ID: %s", response.ChatID)
		log.Printf("  Status: %s", response.Status)
		if response.Error != "" {
			log.Printf("  Error: %s", response.Error)
		}
		log.Printf("  Response: %s", response.Response)
		log.Printf("  Timestamp: %s", response.Timestamp.Format(time.RFC3339))

		// Acknowledge the message only after successful processing
		msg.Ack(false)
	}
}

// WebSocket handler
// WebSocket handler - REWRITTEN FOR CORRECT AUTHENTICATION

func handleWebSocket() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Handle CORS preflight
		if c.Request.Method == "OPTIONS" {
			c.Header("Access-Control-Allow-Origin", "*")
			c.Header("Access-Control-Allow-Methods", "GET, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type")
			c.Status(http.StatusOK)
			return
		}

		// 1. Get token from the URL query parameter
		tokenString := c.Query("token")
		if tokenString == "" {
			log.Println("🔴 Missing token in query parameter")
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error:   "Missing authentication token",
				Message: "Token required in query parameter",
				Code:    http.StatusUnauthorized,
			})
			return
		}

		// 2. Validate JWT token
		jwtSecret := os.Getenv("JWT_SECRET")
		if jwtSecret == "" {
			log.Println("🔴 JWT_SECRET not set")
			c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Server configuration error"})
			return
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			log.Printf("🔴 Invalid token: %v", err)
			c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "Invalid token"})
			return
		}

		// 3. Extract user_id from claims
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "Invalid token claims"})
			return
		}

		userID, ok := claims["user_id"].(string)
		if !ok {
			c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "Invalid user_id claim"})
			return
		}

		// 4. Update upgrader with proper CORS config
		upgrader.CheckOrigin = func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			return origin == "http://localhost:3000" // Add your frontend origin
		}

		// 5. Upgrade connection to WebSocket
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("🔴 WebSocket upgrade failed: %v", err)
			return
		}

		// 6. Create and register connection
		wsConn := &WebSocketConnection{
			ID:        uuid.New().String(),
			UserID:    userID,
			AuthToken: tokenString,
			Conn:      conn,
			Send:      make(chan []byte, 256),
			Manager:   wsManager,
		}

		wsManager.Register(wsConn)

		// 7. Send connection success message
		successMsg := map[string]interface{}{
			"type":      "connection_success",
			"message":   "WebSocket connection established",
			"user_id":   userID,
			"timestamp": time.Now().Format(time.RFC3339),
		}
		if msgBytes, err := json.Marshal(successMsg); err == nil {
			wsConn.Send <- msgBytes
		}

		// 8. Start the pumps
		go wsConn.writePump()
		go wsConn.readPump()
	}
}

// WebSocket connection methods
func (c *WebSocketConnection) readPump() {
	defer func() {
		c.Manager.Unregister(c)
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(512)
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket read error: %v", err)
			}
			break
		}

		// Handle incoming WebSocket messages
		c.handleMessage(message)
	}
}

func (c *WebSocketConnection) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *WebSocketConnection) handleMessage(message []byte) {
	var msg map[string]interface{}
	if err := json.Unmarshal(message, &msg); err != nil {
		log.Printf("Failed to unmarshal WebSocket message: %v", err)
		return
	}

	// Handle different message types
	switch msg["type"] {
	case "submit_request":
		c.handleSubmitRequest(msg)
	case "get_status":
		c.handleGetStatus(msg)
	case "ping":
		c.Send <- []byte(`{"type":"pong","timestamp":"` + time.Now().Format(time.RFC3339) + `"}`)
	}
}

func (c *WebSocketConnection) handleSubmitRequest(msg map[string]interface{}) {
	// Extract request data
	message, _ := msg["message"].(string)
	agents, _ := msg["agents"].([]interface{})
	model, _ := msg["model"].(string)
	chatID, _ := msg["chat_id"].(string)

	// Convert agents to string slice
	agentSlice := make([]string, len(agents))
	for i, agent := range agents {
		if agentStr, ok := agent.(string); ok {
			agentSlice[i] = agentStr
		}
	}

	// Create agent request
	requestID := uuid.New().String()
	orgID, _ := resolveOrganizationID(c.UserID)
	agentRequest := &AgentRequest{
		Message:        message,
		Agents:         agentSlice,
		Model:          model,
		UserID:         c.UserID,
		OrganizationID: orgID,
		ChatID:         chatID,
		AuthToken:      c.AuthToken, // Use the stored auth token from WebSocket connection
		RequestID:      requestID,
		Timestamp:      time.Now(),
	}

	// Publish to RabbitMQ
	err := publishAgentRequest(agentRequest)
	if err != nil {
		// Send error response via WebSocket
		errorResp := map[string]interface{}{
			"type":    "request_error",
			"error":   "Failed to queue request",
			"message": err.Error(),
		}
		if respBytes, err := json.Marshal(errorResp); err == nil {
			c.Send <- respBytes
		}
		return
	}

	// Send success response via WebSocket
	successResp := map[string]interface{}{
		"type":       "request_submitted",
		"request_id": requestID,
		"status":     "queued",
		"message":    "Agent request queued successfully",
		"timestamp":  time.Now().Format(time.RFC3339),
	}
	if respBytes, err := json.Marshal(successResp); err == nil {
		c.Send <- respBytes
	}
}

func (c *WebSocketConnection) handleGetStatus(msg map[string]interface{}) {
	requestID, _ := msg["request_id"].(string)

	// Send status response via WebSocket
	statusResp := map[string]interface{}{
		"type":       "request_status",
		"request_id": requestID,
		"status":     "processing",
		"message":    "Request is being processed",
		"timestamp":  time.Now().Format(time.RFC3339),
	}
	if respBytes, err := json.Marshal(statusResp); err == nil {
		c.Send <- respBytes
	}
}

// WebSocket manager methods
func (m *WebSocketManager) Register(conn *WebSocketConnection) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.connections[conn.ID] = conn
	log.Printf("WebSocket connection registered: %s (User: %s)", conn.ID, conn.UserID)
}

func (m *WebSocketManager) Unregister(conn *WebSocketConnection) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	if _, ok := m.connections[conn.ID]; ok {
		delete(m.connections, conn.ID)
		close(conn.Send)
		log.Printf("WebSocket connection unregistered: %s", conn.ID)
	}
}

func (m *WebSocketManager) BroadcastResponse(response AgentResponse) error {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	sentCount := 0
	// Find the connection for the user who made the request
	for _, conn := range m.connections {
		if conn.UserID == response.UserID {
			// Send response notification
			notification := map[string]interface{}{
				"type":       "ai_response",
				"request_id": response.RequestID,
				"response":   response.Response,
				"status":     response.Status,
				"chat_id":    response.ChatID,
				"timestamp":  response.Timestamp.Format(time.RFC3339),
			}

			respBytes, err := json.Marshal(notification)
			if err != nil {
				log.Printf("Failed to marshal notification for WebSocket %s: %v", conn.ID, err)
				continue
			}

			select {
			case conn.Send <- respBytes:
				log.Printf("Response sent to WebSocket: %s", conn.ID)
				sentCount++
			default:
				log.Printf("Failed to send response to WebSocket: %s (channel full)", conn.ID)
			}
		}
	}

	if sentCount == 0 {
		log.Printf("No WebSocket connections found for user: %s", response.UserID)
	}

	return nil
}

// Initialize RabbitMQ on package import - optional
func init() {
	// RabbitMQ initialization is now optional and will be done on first use
}

// Publish agent request to RabbitMQ
func publishAgentRequest(request *AgentRequest) error {
	// Initialize RabbitMQ on first use
	if rabbitmqChannel == nil {
		if err := initRabbitMQ(); err != nil {
			log.Printf("⚠️ Failed to initialize RabbitMQ: %v", err)
			return fmt.Errorf("RabbitMQ not available: %w", err)
		}
	}

	body, err := json.Marshal(request)
	if err != nil {
		return err
	}

	return rabbitmqChannel.Publish(
		"agent_requests", // exchange
		"agent_request",  // routing key
		false,            // mandatory
		false,            // immediate
		amqp.Publishing{
			ContentType: "application/json",
			Body:        body,
		},
	)
}

// Get queue information
func getQueueInfo() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user ID from JWT token
		_, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error:   "User not authenticated",
				Message: "Authentication required",
				Code:    http.StatusUnauthorized,
			})
			return
		}

		var queueInfo QueueInfo
		var connection string

		if rabbitmqConn != nil && !rabbitmqConn.IsClosed() {
			connection = "connected"

			// Get request queue info
			reqQueue, err := rabbitmqChannel.QueueInspect("agent_request_queue")
			if err == nil {
				queueInfo.RequestQueue = QueueDetails{
					Name:      "agent_request_queue",
					Messages:  reqQueue.Messages,
					Consumers: reqQueue.Consumers,
					Status:    "active",
				}
			}

			// Get response queue info
			respQueue, err := rabbitmqChannel.QueueInspect("agent_response_queue")
			if err == nil {
				queueInfo.ResponseQueue = QueueDetails{
					Name:      "agent_response_queue",
					Messages:  respQueue.Messages,
					Consumers: respQueue.Consumers,
					Status:    "active",
				}
			}
		} else {
			connection = "disconnected"
			queueInfo.RequestQueue = QueueDetails{
				Name:      "agent_request_queue",
				Messages:  -1,
				Consumers: -1,
				Status:    "inactive",
			}
			queueInfo.ResponseQueue = QueueDetails{
				Name:      "agent_response_queue",
				Messages:  -1,
				Consumers: -1,
				Status:    "inactive",
			}
		}

		queueInfo.Connection = connection
		queueInfo.Timestamp = time.Now().Format(time.RFC3339)

		c.JSON(http.StatusOK, queueInfo)
	}
}

// Get queue size for monitoring
func getQueueSize(queueName string) int {
	if rabbitmqChannel == nil {
		return -1
	}

	queue, err := rabbitmqChannel.QueueInspect(queueName)
	if err != nil {
		return -1
	}

	return queue.Messages
}

// Create agent chat request
// @Summary Create a new agent chat request
// @Description Submit a message to AI agents for processing. The JWT token is automatically extracted from the Authorization header.
// @Tags agents
// @Accept json
// @Produce json
// @Security Bearer
// @Param request body AgentChatRequest true "Agent chat request data"
// @Success 202 {object} AgentChatResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/agents/chat [post]
func createAgentChatRequest() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req AgentChatRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:   err.Error(),
				Message: "Invalid request format",
				Code:    http.StatusBadRequest,
			})
			return
		}

		// Get user ID from JWT token
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error:   "User not authenticated",
				Message: "Authentication required",
				Code:    http.StatusUnauthorized,
			})
			return
		}

		// Extract JWT token from Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error:   "Authorization header required",
				Message: "JWT token required in Authorization header",
				Code:    http.StatusUnauthorized,
			})
			return
		}

		// Extract the token part after "Bearer "
		authToken := strings.TrimPrefix(authHeader, "Bearer ")
		if authToken == authHeader {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error:   "Invalid authorization format",
				Message: "Bearer token required",
				Code:    http.StatusUnauthorized,
			})
			return
		}

		// Generate unique request ID
		requestID := uuid.New().String()

		// Create agent request
		orgID, _ := resolveOrganizationID(userID.(string))
		agentRequest := &AgentRequest{
			Message:        req.Message,
			Agents:         req.Agents,
			Model:          req.Model,
			UserID:         userID.(string),
			OrganizationID: orgID,
			ChatID:         req.ChatID,
			AuthToken:      authToken,
			RequestID:      requestID,
			Timestamp:      time.Now(),
		}

		// Publish to RabbitMQ
		err := publishAgentRequest(agentRequest)
		if err != nil {
			// Log error
			if logger != nil {
				userUUID, _ := uuid.Parse(userID.(string))
				logger.LogAgents(c.Request.Context(), models.LogLevelError, "QUEUE_FAILED",
					"Failed to queue agent request",
					services.WithUserID(userUUID),
					services.WithRequestID(requestID),
					services.WithIPAddress(c.ClientIP()),
					services.WithMetadata(map[string]interface{}{
						"agents_count":    len(req.Agents),
						"model":           req.Model,
						"chat_id":         req.ChatID,
						"organization_id": orgID,
						"error":           err.Error(),
					}))
			}
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error:   "Failed to queue agent request",
				Message: "Internal server error occurred",
				Code:    http.StatusInternalServerError,
			})
			return
		}

		if logger != nil {
			userUUID, _ := uuid.Parse(userID.(string))
			logger.LogAgents(c.Request.Context(), models.LogLevelInfo, "REQUEST_QUEUED",
				"Agent request queued successfully",
				services.WithUserID(userUUID),
				services.WithRequestID(requestID),
				services.WithIPAddress(c.ClientIP()),
				services.WithMetadata(map[string]interface{}{
					"agents_count":    len(req.Agents),
					"model":           req.Model,
					"message_length":  len(req.Message),
					"chat_id":         req.ChatID,
					"organization_id": orgID,
				}))
		}

		c.JSON(http.StatusAccepted, AgentChatResponse{
			RequestID: requestID,
			Status:    "queued",
			Message:   "Agent request queued successfully",
			Timestamp: time.Now(),
		})
	}
}

// Get agent chat status
func getAgentChatStatus() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.Param("request_id")
		if requestID == "" {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:   "Request ID required",
				Message: "Missing request ID parameter",
				Code:    http.StatusBadRequest,
			})
			return
		}

		// Get user ID from JWT token for authorization
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error:   "User not authenticated",
				Message: "Authentication required",
				Code:    http.StatusUnauthorized,
			})
			return
		}

		// For now, return a simple status
		// Later, you can check the response queue or database
		c.JSON(http.StatusOK, gin.H{
			"request_id": requestID,
			"user_id":    userID,
			"status":     "processing",
			"message":    "Agent request is being processed",
			"timestamp":  time.Now(),
			"note":       "Check response queue for actual results",
		})
	}
}

// Get agent system status
func getAgentSystemStatus() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user ID from JWT token
		_, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error:   "User not authenticated",
				Message: "Authentication required",
				Code:    http.StatusUnauthorized,
			})
			return
		}

		// Check RabbitMQ connection status
		var status string
		var message string
		var queueSize int

		if rabbitmqConn != nil && !rabbitmqConn.IsClosed() {
			status = "connected"
			message = "Agent system is operational"
			queueSize = getQueueSize("agent_request_queue")
		} else {
			status = "disconnected"
			message = "Agent system is not available"
			queueSize = -1
		}

		c.JSON(http.StatusOK, AgentSystemStatus{
			Status:    status,
			Message:   message,
			QueueSize: queueSize,
			Timestamp: time.Now().Format(time.RFC3339),
		})
	}
}

// PublishAssetProcessingRequest publishes an asset processing request to RabbitMQ
func PublishAssetProcessingRequest(request *AssetProcessingRequest) error {
	// Initialize RabbitMQ on first use
	if rabbitmqChannel == nil {
		if err := initRabbitMQ(); err != nil {
			log.Printf("⚠️ Failed to initialize RabbitMQ: %v", err)
			return fmt.Errorf("RabbitMQ not available: %w", err)
		}
	}

	body, err := json.Marshal(request)
	if err != nil {
		return fmt.Errorf("failed to marshal asset processing request: %w", err)
	}

	err = rabbitmqChannel.Publish(
		"agent_requests", // exchange
		"asset_process",  // routing key
		false,            // mandatory
		false,            // immediate
		amqp.Publishing{
			ContentType: "application/json",
			Body:        body,
		},
	)

	if err != nil {
		return fmt.Errorf("failed to publish asset processing request: %w", err)
	}

	log.Printf("✅ Asset processing request published: %s", request.AssetID)
	return nil
}

// Cleanup function (call this when shutting down)
func Cleanup() {
	if rabbitmqChannel != nil {
		rabbitmqChannel.Close()
	}
	if rabbitmqConn != nil {
		rabbitmqConn.Close()
	}
}
