package workflow

import (
	"encoding/json"
	"time"
)

// WorkflowInputField defines a single input parameter for a workflow tool
type WorkflowInputField struct {
	Type        string      `json:"type" example:"str"`                          // Python type string: str, int, float, bool, List[str], Dict[str, Any], etc.
	Required    bool        `json:"required,omitempty" example:"true"`           // Whether this input is required
	Description string      `json:"description,omitempty" example:"Recipient email"` // Human-readable description of the input
	Default     interface{} `json:"default,omitempty"`                            // Default value for this input (any type)
}

// WorkflowOutputField defines a single output field for a workflow tool
type WorkflowOutputField struct {
	Type        string `json:"type" example:"str"`                         // Python type string: str, int, float, bool, List[str], Dict[str, Any], etc.
	Description string `json:"description,omitempty" example:"Send status"` // Human-readable description of the output
}

// ImportWorkflowRequest represents the request to import a workflow from JSON.
// The ignitic_identifier determines which AI agent receives this workflow as a tool.
// Format: workflows.n8n.<agent_name>.<tool_name>
type ImportWorkflowRequest struct {
	IgniticIdentifier string                          `json:"ignitic_identifier" binding:"required" example:"workflows.n8n.marketer.my_email_tool"` // Dot-separated identifier that maps the workflow to an agent
	Name              string                          `json:"name" binding:"required" example:"My Custom Email Tool"`                                // Display name of the workflow
	Description       string                          `json:"description" binding:"required" example:"Sends a personalized email to a customer"`      // Description of what the workflow does (required by AI Engine)
	Inputs            map[string]WorkflowInputField    `json:"inputs,omitempty"`                                                                     // Input schema: parameter name -> field definition
	Outputs           map[string]WorkflowOutputField   `json:"outputs,omitempty"`                                                                    // Output schema: field name -> field definition
	WorkflowData      json.RawMessage                  `json:"workflow_data" binding:"required"`                                                     // The n8n workflow JSON (nodes, connections, settings)
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
