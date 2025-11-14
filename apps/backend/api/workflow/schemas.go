package workflow

import (
	"encoding/json"
	"time"
)

// ImportWorkflowRequest represents the request to import a workflow from JSON
type ImportWorkflowRequest struct {
	Name     string          `json:"name" binding:"required"`
	N8NJSON  json.RawMessage `json:"n8n_json" binding:"required"`
	Category string          `json:"category,omitempty"`
	Tags     []string        `json:"tags,omitempty"`
}

// WorkflowTemplate represents a workflow template
type WorkflowTemplate struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Category  string          `json:"category,omitempty"`
	Tags      []string        `json:"tags,omitempty"`
	N8NJSON   json.RawMessage `json:"n8n_json,omitempty"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
	CreatedBy string          `json:"created_by"`
}

// WorkflowTemplateResponse represents the response for workflow template operations
type WorkflowTemplateResponse struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Category  string          `json:"category,omitempty"`
	Tags      []string        `json:"tags,omitempty"`
	N8NJSON   json.RawMessage `json:"n8n_json,omitempty"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
	Code    int    `json:"code,omitempty"`
}

// SuccessResponse represents a success response
type SuccessResponse struct {
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
	Code    int         `json:"code"`
}
