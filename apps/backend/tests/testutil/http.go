package testutil

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

// JSONContext builds a Gin test context with a JSON body and optional route params.
func JSONContext(t testing.TB, method, target string, body any, params gin.Params) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()

	gin.SetMode(gin.TestMode)

	var payload []byte
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		payload = raw
	}

	req := httptest.NewRequest(method, target, bytes.NewReader(payload))
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = req
	ctx.Params = params
	t.Cleanup(func() {
		TraceRecorder(t, method, target, body, recorder)
	})
	return ctx, recorder
}

// EmptyContext builds a Gin test context without a body.
func EmptyContext(t testing.TB, method, target string, params gin.Params) (*gin.Context, *httptest.ResponseRecorder) {
	return JSONContext(t, method, target, nil, params)
}

// MustStatus is a small helper for benchmark-style tests that should not return non-200 codes.
func MustStatus(t testing.TB, recorder *httptest.ResponseRecorder, want int) {
	t.Helper()
	if recorder.Code != want {
		t.Fatalf("unexpected status: got %d want %d body=%s", recorder.Code, want, recorder.Body.String())
	}
}

// BodyContains fails if the response body does not include the given substring.
func BodyContains(t testing.TB, recorder *httptest.ResponseRecorder, want string) {
	t.Helper()
	if !bytes.Contains(recorder.Body.Bytes(), []byte(want)) {
		t.Fatalf("response body does not contain %q: %s", want, recorder.Body.String())
	}
}

// HeaderSet checks a response header value.
func HeaderSet(t testing.TB, recorder *httptest.ResponseRecorder, key, want string) {
	t.Helper()
	if got := recorder.Header().Get(key); got != want {
		t.Fatalf("unexpected header %s: got %q want %q", key, got, want)
	}
}

// MethodRequest creates a request object for non-Gin test usage.
func MethodRequest(method, target string, body any) *http.Request {
	var payload []byte
	if body != nil {
		payload, _ = json.Marshal(body)
	}
	req := httptest.NewRequest(method, target, bytes.NewReader(payload))
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return req
}

// TraceRecorder logs the request/response exchange in verbose test output.
func TraceRecorder(t testing.TB, method, target string, requestBody any, recorder *httptest.ResponseRecorder) {
	t.Helper()

	reqText := "<empty>"
	switch v := requestBody.(type) {
	case nil:
	case string:
		reqText = v
	case []byte:
		reqText = string(v)
	default:
		if raw, err := json.Marshal(v); err == nil {
			reqText = string(raw)
		} else {
			reqText = fmt.Sprintf("%v", v)
		}
	}

	respText := strings.TrimSpace(recorder.Body.String())
	if respText == "" {
		respText = "<empty>"
	}

	t.Logf("HTTP %s %s req=%s status=%d resp=%s headers=%v", method, target, reqText, recorder.Code, respText, recorder.Header())
}
