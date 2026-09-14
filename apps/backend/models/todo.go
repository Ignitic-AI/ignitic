package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TodoPriority represents the priority level of a todo
type TodoPriority string

const (
	PriorityHigh   TodoPriority = "high"
	PriorityMedium TodoPriority = "medium"
	PriorityLow    TodoPriority = "low"
)

// IsValid checks if the priority is valid
func (p TodoPriority) IsValid() bool {
	switch p {
	case PriorityHigh, PriorityMedium, PriorityLow:
		return true
	}
	return false
}

// TodoStatus represents the status of a todo
type TodoStatus string

const (
	StatusTodo       TodoStatus = "todo"
	StatusInProgress TodoStatus = "in_progress"
	StatusDone       TodoStatus = "done"
)

// IsValid checks if the status is valid
func (s TodoStatus) IsValid() bool {
	switch s {
	case StatusTodo, StatusInProgress, StatusDone:
		return true
	}
	return false
}

// Todo represents a todo item in the system
type Todo struct {
	ID             uuid.UUID  `json:"id" gorm:"primaryKey;type:uuid;default:uuid_generate_v4()"`
	UserID         uuid.UUID  `json:"user_id" gorm:"type:uuid;not null;index"`
	OrganizationID *uuid.UUID `json:"organization_id,omitempty" gorm:"type:uuid;index"`

	Title       string       `json:"title" gorm:"type:text;not null"`
	Description string       `json:"description,omitempty" gorm:"type:text"`
	Priority    TodoPriority `json:"priority" gorm:"type:varchar(20);not null;default:'medium'"`
	Status      TodoStatus   `json:"status" gorm:"type:varchar(20);not null;default:'todo'"`
	Progress    int          `json:"progress" gorm:"type:integer;not null;default:0;check:progress >= 0 AND progress <= 100"`

	// Monetary value (optional)
	MonetaryValue *float64 `json:"monetary_value,omitempty" gorm:"type:decimal(10,2)"`

	// Icon/Type identifier (e.g., "facebook", "ads", "report", "email")
	Icon string `json:"icon,omitempty" gorm:"type:varchar(50)"`

	// Agent task association
	IsAgentTask bool    `json:"is_agent_task" gorm:"default:false"`
	AgentName   *string `json:"agent_name,omitempty" gorm:"type:varchar(100)"`
	AgentTaskID *string `json:"agent_task_id,omitempty" gorm:"type:varchar(255)"` // Reference to agent task/request ID
	AgentConfig *string `json:"agent_config,omitempty" gorm:"type:jsonb"`         // JSON config for agent task

	// Scheduling
	ScheduledAt *time.Time `json:"scheduled_at,omitempty" gorm:"type:timestamp"`
	DueDate     *time.Time `json:"due_date,omitempty" gorm:"type:timestamp"`

	// Metadata
	Tags         []string    `json:"-" gorm:"-"`
	TagsJSON     []byte      `json:"tags" gorm:"column:tags;type:jsonb"`
	Metadata     interface{} `json:"-" gorm:"-"`
	MetadataJSON []byte      `json:"metadata" gorm:"column:metadata;type:jsonb"`

	CreatedBy uuid.UUID      `json:"created_by" gorm:"type:uuid;not null;index"`
	CreatedAt time.Time      `json:"created_at" gorm:"not null;default:now()"`
	UpdatedAt time.Time      `json:"updated_at" gorm:"not null;default:now()"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	// Relationships
	User         *User         `json:"user,omitempty" gorm:"foreignKey:UserID"`
	Organization *Organization `json:"organization,omitempty" gorm:"foreignKey:OrganizationID"`
}

// TableName specifies the table name for GORM
func (Todo) TableName() string {
	return "todos"
}

// BeforeSave hook to ensure progress is between 0-100 and handle JSON marshaling
func (t *Todo) BeforeSave(tx *gorm.DB) error {
	if t.Progress < 0 {
		t.Progress = 0
	}
	if t.Progress > 100 {
		t.Progress = 100
	}
	// Auto-update status based on progress
	if t.Progress == 100 && t.Status != StatusDone {
		t.Status = StatusDone
	} else if t.Progress > 0 && t.Progress < 100 && t.Status == StatusTodo {
		t.Status = StatusInProgress
	}

	// Handle JSON marshaling for Tags
	if t.Tags != nil {
		data, err := json.Marshal(t.Tags)
		if err != nil {
			return err
		}
		t.TagsJSON = data
	}

	// Handle JSON marshaling for Metadata
	if t.Metadata != nil {
		data, err := json.Marshal(t.Metadata)
		if err != nil {
			return err
		}
		t.MetadataJSON = data
	}

	return nil
}

// AfterFind handles JSON unmarshaling
func (t *Todo) AfterFind(tx *gorm.DB) error {
	if t.TagsJSON != nil {
		if err := json.Unmarshal(t.TagsJSON, &t.Tags); err != nil {
			return err
		}
	}

	if t.MetadataJSON != nil {
		if err := json.Unmarshal(t.MetadataJSON, &t.Metadata); err != nil {
			return err
		}
	}

	return nil
}

// TodoCreateRequest represents the request to create a todo
type TodoCreateRequest struct {
	Title          string       `json:"title" binding:"required"`
	Description    string       `json:"description" binding:"required"`
	Priority       TodoPriority `json:"priority" binding:"required,oneof=high medium low"`
	Status         TodoStatus   `json:"status,omitempty" binding:"omitempty,oneof=todo in_progress done"`
	Progress       int          `json:"progress,omitempty" binding:"omitempty,min=0,max=100"`
	MonetaryValue  *float64     `json:"monetary_value,omitempty"`
	Icon           string       `json:"icon,omitempty"`
	OrganizationID *uuid.UUID   `json:"organization_id,omitempty"`
	ScheduledAt    *time.Time   `json:"scheduled_at,omitempty"`
	DueDate        *time.Time   `json:"due_date,omitempty"`
	Tags           []string     `json:"tags,omitempty"`
	Metadata       interface{}  `json:"metadata,omitempty"`
}

// TodoUpdateRequest represents the request to update a todo
type TodoUpdateRequest struct {
	Title         *string       `json:"title,omitempty"`
	Description   *string       `json:"description,omitempty"`
	Priority      *TodoPriority `json:"priority,omitempty" binding:"omitempty,oneof=high medium low"`
	Status        *TodoStatus   `json:"status,omitempty" binding:"omitempty,oneof=todo in_progress done"`
	Progress      *int          `json:"progress,omitempty" binding:"omitempty,min=0,max=100"`
	MonetaryValue *float64      `json:"monetary_value,omitempty"`
	Icon          *string       `json:"icon,omitempty"`
	DueDate       *time.Time    `json:"due_date,omitempty"`
	Tags          []string      `json:"tags,omitempty"`
	Metadata      interface{}   `json:"metadata,omitempty"`
}

// TodoScheduleAgentRequest represents the request to schedule an agent task
type TodoScheduleAgentRequest struct {
	AgentName   string                 `json:"agent_name" binding:"required"`
	AgentConfig map[string]interface{} `json:"agent_config" binding:"required"`
	ScheduledAt *time.Time             `json:"scheduled_at,omitempty"`
}

// TodoSuggestionRequest asks backend to generate suggested todos using available agents/tools.
type TodoSuggestionRequest struct {
	Goal           string     `json:"goal" binding:"required"`
	Context        string     `json:"context,omitempty"`
	OrganizationID *uuid.UUID `json:"organization_id,omitempty"`
	MaxSuggestions int        `json:"max_suggestions,omitempty"`
}

type TodoSuggestionItem struct {
	Title          string    `json:"title"`
	Description    string    `json:"description"`
	Priority       string    `json:"priority"`
	Icon           string    `json:"icon,omitempty"`
	AgentName      string    `json:"agent_name,omitempty"`
	Reasoning      string    `json:"reasoning,omitempty"`
	SuggestedAtUTC time.Time `json:"suggested_at_utc"`
}

type TodoSuggestionResponse struct {
	Goal        string               `json:"goal"`
	Count       int                  `json:"count"`
	Suggestions []TodoSuggestionItem `json:"suggestions"`
}

// TodoResponse represents the response for a todo
type TodoResponse struct {
	ID             uuid.UUID    `json:"id"`
	UserID         uuid.UUID    `json:"user_id"`
	OrganizationID *uuid.UUID   `json:"organization_id,omitempty"`
	Title          string       `json:"title"`
	Description    string       `json:"description,omitempty"`
	Priority       TodoPriority `json:"priority"`
	Status         TodoStatus   `json:"status"`
	Progress       int          `json:"progress"`
	MonetaryValue  *float64     `json:"monetary_value,omitempty"`
	Icon           string       `json:"icon,omitempty"`
	IsAgentTask    bool         `json:"is_agent_task"`
	AgentName      *string      `json:"agent_name,omitempty"`
	AgentTaskID    *string      `json:"agent_task_id,omitempty"`
	ScheduledAt    *time.Time   `json:"scheduled_at,omitempty"`
	DueDate        *time.Time   `json:"due_date,omitempty"`
	Tags           []string     `json:"tags,omitempty"`
	Metadata       interface{}  `json:"metadata,omitempty"`
	CreatedBy      uuid.UUID    `json:"created_by"`
	CreatedAt      time.Time    `json:"created_at"`
	UpdatedAt      time.Time    `json:"updated_at"`
}
