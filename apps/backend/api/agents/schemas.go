package agents

import (
	"time"
)

// Request/Response structures for API endpoints
type AgentChatRequest struct {
	Message string   `json:"message" binding:"required"`
	Agents  []string `json:"agents" binding:"required"`
	Model   string   `json:"model" binding:"required"`
}

type AgentChatResponse struct {
	RequestID string    `json:"request_id"`
	Status    string    `json:"status"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
}

// Internal structures for RabbitMQ communication
type AgentRequest struct {
	Message   string    `json:"message"`
	Agents    []string  `json:"agents"`
	Model     string    `json:"model"`
	UserID    string    `json:"user_id"`
	RequestID string    `json:"request_id"`
	Timestamp time.Time `json:"timestamp"`
}

type AgentResponse struct {
	RequestID string    `json:"request_id"`
	Response  string    `json:"response"`
	Status    string    `json:"status"`
	Error     string    `json:"error,omitempty"`
	UserID    string    `json:"user_id"`
	Timestamp time.Time `json:"timestamp"`
}

// System monitoring structures
type AgentSystemStatus struct {
	Status    string `json:"status"`
	Message   string `json:"message"`
	QueueSize int    `json:"queue_size"`
	Timestamp string `json:"timestamp"`
}

type QueueInfo struct {
	RequestQueue  QueueDetails `json:"request_queue"`
	ResponseQueue QueueDetails `json:"response_queue"`
	Connection    string       `json:"connection"`
	Timestamp     string       `json:"timestamp"`
}

type QueueDetails struct {
	Name      string `json:"name"`
	Messages  int    `json:"messages"`
	Consumers int    `json:"consumers"`
	Status    string `json:"status"`
}

// Error response structure
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
	Code    int    `json:"code,omitempty"`
}

// Success response structure
type SuccessResponse struct {
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
	Code    int         `json:"code"`
}
