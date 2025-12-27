package agents

import (
	"encoding/json"
	"testing"
	"time"
)

func TestAgentStreamChunk_UnmarshalJSON(t *testing.T) {
	tests := []struct {
		name      string
		json      string
		wantErr   bool
		checkTime func(time.Time) bool
		checkName func(string) bool
	}{
		{
			name: "RFC3339 Timestamp",
			json: `{
				"request_id": "req-123",
				"timestamp": "2025-12-27T00:49:39Z",
				"agent_name": "TestAgent"
			}`,
			wantErr: false,
			checkTime: func(ts time.Time) bool {
				return !ts.IsZero()
			},
			checkName: func(name string) bool {
				return name == "TestAgent"
			},
		},
		{
			name: "No Timezone with Microseconds (The Error Case)",
			json: `{
				"request_id": "req-123",
				"timestamp": "2025-12-27T00:49:39.258178",
				"agent_name": "TestAgent"
			}`,
			wantErr: false,
			checkTime: func(ts time.Time) bool {
				return !ts.IsZero() && ts.Year() == 2025
			},
			checkName: func(name string) bool {
				return name == "TestAgent"
			},
		},
		{
			name: "No Timezone No Microseconds",
			json: `{
				"request_id": "req-123",
				"timestamp": "2025-12-27T00:49:39"
			}`,
			wantErr: false,
			checkTime: func(ts time.Time) bool {
				return !ts.IsZero() && ts.Year() == 2025
			},
			checkName: func(name string) bool {
				return name == "" // Optional field
			},
		},
		{
			name: "Invalid Timestamp (Should Fallback to Now)",
			json: `{
				"request_id": "req-123",
				"timestamp": "invalid-time"
			}`,
			wantErr: false,
			checkTime: func(ts time.Time) bool {
				// Should be close to now
				return time.Since(ts) < time.Second
			},
			checkName: func(name string) bool {
				return name == ""
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var chunk AgentStreamChunk
			err := json.Unmarshal([]byte(tt.json), &chunk)
			if (err != nil) != tt.wantErr {
				t.Errorf("UnmarshalJSON() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.checkTime(chunk.Timestamp) {
				t.Errorf("UnmarshalJSON() timestamp check failed for %v", chunk.Timestamp)
			}
			if !tt.checkName(chunk.AgentName) {
				t.Errorf("UnmarshalJSON() agent_name check failed for %v", chunk.AgentName)
			}
		})
	}
}
