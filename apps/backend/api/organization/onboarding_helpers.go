package organization

import "encoding/json"

func employeeCountFromCompanySize(size string) int {
	switch size {
	case "Just me (1)":
		return 1
	case "Small team (2-10)":
		return 5
	case "Medium team (11-50)":
		return 25
	case "Large team (51-200)":
		return 100
	case "Enterprise (200+)":
		return 500
	default:
		return 0
	}
}

func stringSliceToJSONRaw(slice []string) json.RawMessage {
	if len(slice) == 0 {
		return json.RawMessage("[]")
	}
	b, err := json.Marshal(slice)
	if err != nil {
		return json.RawMessage("[]")
	}
	return json.RawMessage(b)
}
