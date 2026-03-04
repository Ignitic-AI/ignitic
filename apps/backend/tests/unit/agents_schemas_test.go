package unit

import (
	"encoding/json"
	"testing"
	"time"

	"backend/api/agents"
)

func TestAgentResponse_UnmarshalJSON_RFC3339(t *testing.T) {
	ts := "2025-03-02T12:00:00Z"
	body := `{"request_id":"r1","response":"hi","status":"ok","user_id":"u1","chat_id":"c1","timestamp":"` + ts + `"}`
	var ar agents.AgentResponse
	if err := json.Unmarshal([]byte(body), &ar); err != nil {
		t.Fatalf("UnmarshalJSON error = %v", err)
	}
	if ar.RequestID != "r1" || ar.Response != "hi" || ar.UserID != "u1" || ar.ChatID != "c1" {
		t.Fatalf("unexpected fields: %+v", ar)
	}
	expect, _ := time.Parse(time.RFC3339, ts)
	if !ar.Timestamp.Equal(expect) {
		t.Fatalf("Timestamp = %v, want %v", ar.Timestamp, expect)
	}
}

func TestAgentResponse_UnmarshalJSON_InvalidTimestampUsesNow(t *testing.T) {
	body := `{"request_id":"r1","response":"","status":"","user_id":"","chat_id":"","timestamp":"not-a-date"}`
	var ar agents.AgentResponse
	before := time.Now().UTC()
	if err := json.Unmarshal([]byte(body), &ar); err != nil {
		t.Fatalf("UnmarshalJSON error = %v", err)
	}
	after := time.Now().UTC()
	if ar.Timestamp.Before(before) || ar.Timestamp.After(after) {
		t.Fatalf("fallback timestamp %v not in [%v, %v]", ar.Timestamp, before, after)
	}
}

func TestAgentStreamChunk_UnmarshalJSON(t *testing.T) {
	ts := "2025-03-02T12:00:00Z"
	body := `{"request_id":"r1","user_id":"u1","chat_id":"c1","chunk_index":0,"content":"hello","is_final":true,"timestamp":"` + ts + `"}`
	var asc agents.AgentStreamChunk
	if err := json.Unmarshal([]byte(body), &asc); err != nil {
		t.Fatalf("UnmarshalJSON error = %v", err)
	}
	if asc.RequestID != "r1" || asc.Content != "hello" || !asc.IsFinal {
		t.Fatalf("unexpected fields: %+v", asc)
	}
	expect, _ := time.Parse(time.RFC3339, ts)
	if !asc.Timestamp.Equal(expect) {
		t.Fatalf("Timestamp = %v, want %v", asc.Timestamp, expect)
	}
}
