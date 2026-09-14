package models_test

import (
	"encoding/json"
	"testing"
	"time"

	backendmodels "backend/models"
)

func TestAssetCategoryAndTodoEnums(t *testing.T) {
	validCategories := []backendmodels.AssetCategory{
		backendmodels.BusinessProfile,
		backendmodels.BrandAssets,
		backendmodels.MarketingAssets,
		backendmodels.AnalyticsReports,
		backendmodels.PolicyDocuments,
		backendmodels.MediaDocuments,
	}
	for _, category := range validCategories {
		if !category.IsValid() {
			t.Fatalf("expected category %q to be valid", category)
		}
	}
	if backendmodels.AssetCategory("bad").IsValid() {
		t.Fatalf("expected invalid asset category to fail")
	}

	validPriorities := []backendmodels.TodoPriority{backendmodels.PriorityHigh, backendmodels.PriorityMedium, backendmodels.PriorityLow}
	for _, priority := range validPriorities {
		if !priority.IsValid() {
			t.Fatalf("expected priority %q to be valid", priority)
		}
	}
	if backendmodels.TodoPriority("urgent").IsValid() {
		t.Fatalf("expected invalid priority to fail")
	}

	validStatuses := []backendmodels.TodoStatus{backendmodels.StatusTodo, backendmodels.StatusInProgress, backendmodels.StatusDone}
	for _, status := range validStatuses {
		if !status.IsValid() {
			t.Fatalf("expected status %q to be valid", status)
		}
	}
	if backendmodels.TodoStatus("blocked").IsValid() {
		t.Fatalf("expected invalid status to fail")
	}
}

func TestJSONBMapValueAndScan(t *testing.T) {
	in := backendmodels.JSONBMap{"a": "b", "n": float64(3)}
	v, err := in.Value()
	if err != nil {
		t.Fatalf("value: %v", err)
	}
	var out backendmodels.JSONBMap
	if err := out.Scan(v); err != nil {
		t.Fatalf("scan: %v", err)
	}
	if out["a"] != "b" {
		t.Fatalf("unexpected value: %#v", out)
	}

	if err := out.Scan(`{"x":1}`); err != nil {
		t.Fatalf("scan string: %v", err)
	}
	if out["x"].(float64) != 1 {
		t.Fatalf("unexpected string scan result: %#v", out)
	}
}

func TestJSONBValueAndScan(t *testing.T) {
	var empty backendmodels.JSONB
	v, err := empty.Value()
	if err != nil {
		t.Fatalf("value: %v", err)
	}
	if v != nil {
		t.Fatalf("expected nil value for empty JSONB")
	}

	payload := backendmodels.JSONB([]byte(`{"x":1}`))
	v, err = payload.Value()
	if err != nil {
		t.Fatalf("value: %v", err)
	}
	var out backendmodels.JSONB
	if err := out.Scan(v); err != nil {
		t.Fatalf("scan: %v", err)
	}
	if string(out) != `{"x":1}` {
		t.Fatalf("unexpected output: %s", string(out))
	}
}

func TestAssetAndTodoHooks(t *testing.T) {
	asset := &backendmodels.Asset{
		Tags:     []string{"one", "two"},
		Metadata: map[string]interface{}{"enabled": true},
	}
	if err := asset.BeforeSave(nil); err != nil {
		t.Fatalf("asset before save: %v", err)
	}
	if len(asset.TagsJSON) == 0 || len(asset.MetadataJSON) == 0 {
		t.Fatalf("expected asset json fields to be populated")
	}
	loadedAsset := &backendmodels.Asset{TagsJSON: asset.TagsJSON, MetadataJSON: asset.MetadataJSON}
	if err := loadedAsset.AfterFind(nil); err != nil {
		t.Fatalf("asset after find: %v", err)
	}
	if len(loadedAsset.Tags) != 2 || loadedAsset.Tags[0] != "one" {
		t.Fatalf("unexpected loaded asset tags: %#v", loadedAsset.Tags)
	}

	todo := &backendmodels.Todo{
		Progress: 150,
		Status:   backendmodels.StatusTodo,
		Tags:     []string{"a"},
		Metadata: map[string]interface{}{"k": "v"},
	}
	if err := todo.BeforeSave(nil); err != nil {
		t.Fatalf("todo before save: %v", err)
	}
	if todo.Progress != 100 || todo.Status != backendmodels.StatusDone {
		t.Fatalf("expected progress/status normalization, got %d/%s", todo.Progress, todo.Status)
	}
	loadedTodo := &backendmodels.Todo{TagsJSON: todo.TagsJSON, MetadataJSON: todo.MetadataJSON}
	if err := loadedTodo.AfterFind(nil); err != nil {
		t.Fatalf("todo after find: %v", err)
	}
	if len(loadedTodo.Tags) != 1 || loadedTodo.Tags[0] != "a" {
		t.Fatalf("unexpected loaded todo tags: %#v", loadedTodo.Tags)
	}
}

func TestCreditAccountAvailableCredits(t *testing.T) {
	account := backendmodels.CreditAccount{TotalCredits: 100, CreditsConsumed: 37}
	if got := account.AvailableCredits(); got != 63 {
		t.Fatalf("expected 63, got %d", got)
	}
}

func TestOrganizationBusinessProfileScanners(t *testing.T) {
	m := backendmodels.StringMap{"a": "b"}
	v, err := m.Value()
	if err != nil {
		t.Fatalf("value: %v", err)
	}
	var out backendmodels.StringMap
	if err := out.Scan(v); err != nil {
		t.Fatalf("scan: %v", err)
	}
	if out["a"] != "b" {
		t.Fatalf("unexpected value: %#v", out)
	}

	contacts := backendmodels.ContactArray{{Name: "A", Role: "Owner", Email: "a@example.com"}}
	v, err = contacts.Value()
	if err != nil {
		t.Fatalf("contacts value: %v", err)
	}
	var outContacts backendmodels.ContactArray
	if err := outContacts.Scan(v); err != nil {
		t.Fatalf("contacts scan: %v", err)
	}
	if len(outContacts) != 1 || outContacts[0].Email != "a@example.com" {
		t.Fatalf("unexpected contacts: %#v", outContacts)
	}

	platforms := backendmodels.PlatformArray{{Name: "Shopify", Version: "1", URL: "https://example.com"}}
	v, err = platforms.Value()
	if err != nil {
		t.Fatalf("platform value: %v", err)
	}
	var outPlatforms backendmodels.PlatformArray
	if err := outPlatforms.Scan(v); err != nil {
		t.Fatalf("platform scan: %v", err)
	}
	if len(outPlatforms) != 1 || outPlatforms[0].Name != "Shopify" {
		t.Fatalf("unexpected platforms: %#v", outPlatforms)
	}
}

func TestModelJSONMarshalling(t *testing.T) {
	now := time.Now().UTC().Round(time.Second)
	b, err := json.Marshal(now)
	if err != nil || len(b) == 0 {
		t.Fatalf("json marshal sanity check failed: %v", err)
	}
}
