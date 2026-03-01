package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
)

// JSONBMap is a helper map type that can be scanned from / written to Postgres JSONB.
type JSONBMap map[string]interface{}

func (m JSONBMap) Value() (driver.Value, error) {
	if m == nil {
		return []byte("{}"), nil
	}
	b, err := json.Marshal(m)
	if err != nil {
		return nil, err
	}
	return b, nil
}

func (m *JSONBMap) Scan(value interface{}) error {
	if value == nil {
		*m = JSONBMap{}
		return nil
	}
	switch v := value.(type) {
	case []byte:
		if len(v) == 0 {
			*m = JSONBMap{}
			return nil
		}
		return json.Unmarshal(v, m)
	case string:
		if v == "" {
			*m = JSONBMap{}
			return nil
		}
		return json.Unmarshal([]byte(v), m)
	default:
		return fmt.Errorf("unsupported type for JSONBMap scan: %T", value)
	}
}
