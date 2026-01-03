package agents

import (
	"encoding/json"
	"time"
)

type AgentChatRequest struct {
	Message string   `json:"message" binding:"required"`
	Agents  []string `json:"agents"`
	Model   string   `json:"model"`
	ChatID  string   `json:"chat_id"`
}

type AgentChatResponse struct {
	RequestID string    `json:"request_id"`
	Status    string    `json:"status"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
}

type AgentRequest struct {
	Message        string    `json:"message"`
	Agents         []string  `json:"agents"`
	Model          string    `json:"model"`
	UserID         string    `json:"user_id"`
	OrganizationID string    `json:"organization_id"`
	ChatID         string    `json:"chat_id"`
	AuthToken      string    `json:"auth_token"`
	RequestID      string    `json:"request_id"`
	Timestamp      time.Time `json:"timestamp"`
}

type AgentResponse struct {
	RequestID string    `json:"request_id"`
	Response  string    `json:"response"`
	Status    string    `json:"status"`
	Error     string    `json:"error,omitempty"`
	UserID    string    `json:"user_id"`
	ChatID    string    `json:"chat_id"`
	Timestamp time.Time `json:"timestamp"`
}

// UnmarshalJSON custom unmarshaler for AgentResponse to handle different timestamp formats
func (ar *AgentResponse) UnmarshalJSON(data []byte) error {
	// Create a temporary struct with the same fields but string timestamp
	type tempAgentResponse struct {
		RequestID string `json:"request_id"`
		Response  string `json:"response"`
		Status    string `json:"status"`
		Error     string `json:"error,omitempty"`
		UserID    string `json:"user_id"`
		ChatID    string `json:"chat_id"`
		Timestamp string `json:"timestamp"`
	}

	var temp tempAgentResponse
	if err := json.Unmarshal(data, &temp); err != nil {
		return err
	}

	// Copy all fields except timestamp
	ar.RequestID = temp.RequestID
	ar.Response = temp.Response
	ar.Status = temp.Status
	ar.Error = temp.Error
	ar.UserID = temp.UserID
	ar.ChatID = temp.ChatID

	// Try to parse timestamp with different formats
	var err error

	// Try RFC3339 first (standard format)
	ar.Timestamp, err = time.Parse(time.RFC3339, temp.Timestamp)
	if err == nil {
		return nil
	}

	// Try without timezone (add UTC)
	ar.Timestamp, err = time.Parse("2006-01-02T15:04:05.999999", temp.Timestamp)
	if err == nil {
		ar.Timestamp = ar.Timestamp.UTC()
		return nil
	}

	// Try without microseconds
	ar.Timestamp, err = time.Parse("2006-01-02T15:04:05", temp.Timestamp)
	if err == nil {
		ar.Timestamp = ar.Timestamp.UTC()
		return nil
	}

	// If all formats fail, use current time and log warning
	ar.Timestamp = time.Now().UTC()
	return nil // Don't fail the entire unmarshaling for timestamp issues
}

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

type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
	Code    int    `json:"code,omitempty"`
}

type SuccessResponse struct {
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
	Code    int         `json:"code"`
}

// AssetProcessingRequest represents a request to process an asset for vector generation
type AssetProcessingRequest struct {
	AssetID        string `json:"asset_id" binding:"required"`
	UserID         string `json:"user_id" binding:"required"`
	OrganizationID string `json:"organization_id"`
	AuthToken      string `json:"auth_token" binding:"required"`
	RequestID      string `json:"request_id"`
	Action string `json:"action"`
	EventID   string    `json:"event_id"`
	Timestamp time.Time `json:"timestamp"`
}

// AgentUpdateRequest represents a request to update an agent
type AgentUpdateRequest struct {
	Name        *string  `json:"name,omitempty"`
	Description *string  `json:"description,omitempty"`
	SystemPrompt *string `json:"system_prompt,omitempty"`
	Tags        []string `json:"tags,omitempty"`
}

// AgentStreamChunk represents a single chunk of a streamed response from AI engine
type AgentStreamChunk struct {
	RequestID  string    `json:"request_id"`
	UserID     string    `json:"user_id"`
	ChatID     string    `json:"chat_id"`
	ChunkIndex int       `json:"chunk_index"`
	Content    string    `json:"content"`
	AgentName  string    `json:"agent_name,omitempty"`
	IsFinal    bool      `json:"is_final"`
	Timestamp  time.Time `json:"timestamp"`
}

// UnmarshalJSON custom unmarshaler for AgentStreamChunk to handle different timestamp formats
func (asc *AgentStreamChunk) UnmarshalJSON(data []byte) error {
	// Create a temporary struct with the same fields but string timestamp
	type tempAgentStreamChunk struct {
		RequestID  string `json:"request_id"`
		UserID     string `json:"user_id"`
		ChatID     string `json:"chat_id"`
		ChunkIndex int    `json:"chunk_index"`
		Content    string `json:"content"`
		AgentName  string `json:"agent_name,omitempty"`
		IsFinal    bool   `json:"is_final"`
		Timestamp  string `json:"timestamp"`
	}

	var temp tempAgentStreamChunk
	if err := json.Unmarshal(data, &temp); err != nil {
		return err
	}

	// Copy all fields except timestamp
	asc.RequestID = temp.RequestID
	asc.UserID = temp.UserID
	asc.ChatID = temp.ChatID
	asc.ChunkIndex = temp.ChunkIndex
	asc.Content = temp.Content
	asc.AgentName = temp.AgentName
	asc.IsFinal = temp.IsFinal

	// Try to parse timestamp with different formats
	var err error

	// Try RFC3339 first (standard format)
	asc.Timestamp, err = time.Parse(time.RFC3339, temp.Timestamp)
	if err == nil {
		return nil
	}

	// Try without timezone (add UTC)
	asc.Timestamp, err = time.Parse("2006-01-02T15:04:05.999999", temp.Timestamp)
	if err == nil {
		asc.Timestamp = asc.Timestamp.UTC()
		return nil
	}

	// Try without microseconds
	asc.Timestamp, err = time.Parse("2006-01-02T15:04:05", temp.Timestamp)
	if err == nil {
		asc.Timestamp = asc.Timestamp.UTC()
		return nil
	}

	// If all formats fail, use current time
	asc.Timestamp = time.Now().UTC()
	return nil // Don't fail the entire unmarshaling for timestamp issues
}
