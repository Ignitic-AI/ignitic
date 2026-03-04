package unit

import (
	"testing"

	"backend/models"
)

func TestTodoPriority_IsValid(t *testing.T) {
	tests := []struct {
		name string
		p    models.TodoPriority
		want bool
	}{
		{"high", models.PriorityHigh, true},
		{"medium", models.PriorityMedium, true},
		{"low", models.PriorityLow, true},
		{"invalid", models.TodoPriority("invalid"), false},
		{"empty", models.TodoPriority(""), false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.p.IsValid(); got != tt.want {
				t.Fatalf("IsValid() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestTodoStatus_IsValid(t *testing.T) {
	validStatuses := []models.TodoStatus{models.StatusTodo, models.StatusInProgress, models.StatusDone}
	for _, s := range validStatuses {
		if !s.IsValid() {
			t.Fatalf("TodoStatus %q should be valid", s)
		}
	}
	if (models.TodoStatus("invalid")).IsValid() {
		t.Fatal("invalid status should not be valid")
	}
}

func TestTodo_TableName(t *testing.T) {
	var todo models.Todo
	if got := todo.TableName(); got != "todos" {
		t.Fatalf("Todo.TableName() = %q, want todos", got)
	}
}

func TestAssetCategory_IsValid(t *testing.T) {
	tests := []struct {
		name string
		c    models.AssetCategory
		want bool
	}{
		{"business_profile", models.BusinessProfile, true},
		{"brand_assets", models.BrandAssets, true},
		{"invalid", models.AssetCategory("invalid"), false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.c.IsValid(); got != tt.want {
				t.Fatalf("IsValid() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestLog_TableName(t *testing.T) {
	var log models.Log
	if got := log.TableName(); got != "logs" {
		t.Fatalf("Log.TableName() = %q, want logs", got)
	}
}
