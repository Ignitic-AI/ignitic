package agents

import (
	"backend/database"
	"backend/models"
	"backend/services"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	amqp "github.com/rabbitmq/amqp091-go"
)

// WebSocket upgrader
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

// WebSocket connection manager
type WebSocketManager struct {
	connections map[string]*WebSocketConnection
	mutex       sync.RWMutex
}

type WebSocketConnection struct {
	ID      string
	UserID  string
	Conn    *websocket.Conn
	Send    chan []byte
	Manager *WebSocketManager
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
)

// SetLogger sets the database logger for the agents package
func SetLogger(db *database.DB) {
	logger = services.NewDatabaseLogger(db)
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

	log.Println("✅ Agent RabbitMQ queues initialized successfully")

	// Start consuming responses for WebSocket notifications
	go startResponseConsumer()

	return nil
}

// Start consuming AI engine responses
func startResponseConsumer() {
	msgs, err := rabbitmqChannel.Consume(
		"agent_response_queue", // queue
		"",                     // consumer
		true,                   // auto-ack
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
			continue
		}

		// Notify WebSocket clients about the response
		wsManager.BroadcastResponse(response)
	}
}

// WebSocket handler
func handleWebSocket() gin.HandlerFunc {
	return func(c *gin.Context) {
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

		// Upgrade HTTP connection to WebSocket
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("WebSocket upgrade failed: %v", err)
			return
		}

		// Create WebSocket connection
		wsConn := &WebSocketConnection{
			ID:      uuid.New().String(),
			UserID:  userID.(string),
			Conn:    conn,
			Send:    make(chan []byte, 256),
			Manager: wsManager,
		}

		// Register connection
		wsManager.Register(wsConn)

		// Start WebSocket handlers
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
	authToken, _ := msg["auth_token"].(string)

	// Validate required fields
	if chatID == "" {
		errorResp := map[string]interface{}{
			"type":    "request_error",
			"error":   "Missing chat_id",
			"message": "chat_id is required",
		}
		if respBytes, err := json.Marshal(errorResp); err == nil {
			c.Send <- respBytes
		}
		return
	}

	if authToken == "" {
		errorResp := map[string]interface{}{
			"type":    "request_error",
			"error":   "Missing auth_token",
			"message": "auth_token is required",
		}
		if respBytes, err := json.Marshal(errorResp); err == nil {
			c.Send <- respBytes
		}
		return
	}

	// Convert agents to string slice
	agentSlice := make([]string, len(agents))
	for i, agent := range agents {
		if agentStr, ok := agent.(string); ok {
			agentSlice[i] = agentStr
		}
	}

	// Create agent request
	requestID := uuid.New().String()
	agentRequest := &AgentRequest{
		Message:   message,
		Agents:    agentSlice,
		Model:     model,
		UserID:    c.UserID,
		ChatID:    chatID,
		AuthToken: authToken,
		RequestID: requestID,
		Timestamp: time.Now(),
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

func (m *WebSocketManager) BroadcastResponse(response AgentResponse) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

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

			if respBytes, err := json.Marshal(notification); err == nil {
				select {
				case conn.Send <- respBytes:
					log.Printf("Response sent to WebSocket: %s", conn.ID)
				default:
					log.Printf("Failed to send response to WebSocket: %s", conn.ID)
				}
			}
		}
	}
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

		// Generate unique request ID
		requestID := uuid.New().String()

		// Create agent request
		agentRequest := &AgentRequest{
			Message:   req.Message,
			Agents:    req.Agents,
			Model:     req.Model,
			UserID:    userID.(string),
			ChatID:    req.ChatID,
			AuthToken: req.AuthToken,
			RequestID: requestID,
			Timestamp: time.Now(),
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
						"agents_count": len(req.Agents),
						"model":        req.Model,
						"chat_id":      req.ChatID,
						"error":        err.Error(),
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
					"agents_count":   len(req.Agents),
					"model":          req.Model,
					"message_length": len(req.Message),
					"chat_id":        req.ChatID,
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

// Cleanup function (call this when shutting down)
func Cleanup() {
	if rabbitmqChannel != nil {
		rabbitmqChannel.Close()
	}
	if rabbitmqConn != nil {
		rabbitmqConn.Close()
	}
}
