package unit

import (
	"testing"

	"backend/services/policy"
)

func TestPolicy_EndpointRoleConstants(t *testing.T) {
	if policy.EndpointRoleView != "view" {
		t.Fatalf("EndpointRoleView = %q, want view", policy.EndpointRoleView)
	}
	if policy.EndpointRoleRun != "run" {
		t.Fatalf("EndpointRoleRun = %q, want run", policy.EndpointRoleRun)
	}
	if policy.EndpointRoleAdmin != "admin" {
		t.Fatalf("EndpointRoleAdmin = %q, want admin", policy.EndpointRoleAdmin)
	}
}

func TestPolicy_ErrorSentinelValues(t *testing.T) {
	tests := []struct {
		name string
		err  error
		msg  string
	}{
		{"FeatureNotAllowed", policy.ErrFeatureNotAllowed, "feature_not_allowed"},
		{"ModelNotAllowed", policy.ErrModelNotAllowed, "model_not_allowed"},
		{"ToolNotAllowed", policy.ErrToolNotAllowed, "tool_not_allowed"},
		{"InsufficientCredits", policy.ErrInsufficientCredits, "insufficient_credits"},
		{"OrgMembershipRequired", policy.ErrOrgMembershipRequired, "organization_membership_required"},
		{"RBACDenied", policy.ErrRBACDenied, "rbac_denied"},
		{"InvalidInput", policy.ErrInvalidInput, "invalid_input"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.err == nil {
				t.Fatal("expected non-nil error")
			}
			if tt.err.Error() != tt.msg {
				t.Fatalf("error message = %q, want %q", tt.err.Error(), tt.msg)
			}
		})
	}
}

func TestPolicy_AuthorizeResultZeroValue(t *testing.T) {
	var r policy.AuthorizeResult
	if r.Allowed {
		t.Fatal("zero AuthorizeResult should not be Allowed")
	}
	if r.PlanCode != "" {
		t.Fatalf("zero PlanCode = %q", r.PlanCode)
	}
}
