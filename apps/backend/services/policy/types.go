package policy

import (
	"errors"

	"github.com/google/uuid"
)

type EndpointRole string

const (
	EndpointRoleView  EndpointRole = "view"
	EndpointRoleRun   EndpointRole = "run"
	EndpointRoleAdmin EndpointRole = "admin"
)

type AuthorizeInput struct {
	UserID          uuid.UUID
	OrganizationID  *uuid.UUID
	ActionKey       string
	Model           string
	Tools           []string
	AgentsCount     int
	ReferenceID     string
	RequireBillable bool
	RequestMeta     map[string]interface{}
	EndpointRole    EndpointRole
}

type AuthorizeResult struct {
	Allowed          bool                   `json:"allowed"`
	Decision         string                 `json:"decision"`
	OwnerType        string                 `json:"owner_type"`
	OwnerID          uuid.UUID              `json:"owner_id"`
	PlanCode         string                 `json:"plan_code"`
	Cost             int64                  `json:"cost"`
	TotalCredits     int64                  `json:"total_credits"`
	CreditsConsumed  int64                  `json:"credits_consumed"`
	AvailableCredits int64                  `json:"available_credits"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
}

var (
	ErrFeatureNotAllowed     = errors.New("feature_not_allowed")
	ErrModelNotAllowed       = errors.New("model_not_allowed")
	ErrToolNotAllowed        = errors.New("tool_not_allowed")
	ErrInsufficientCredits   = errors.New("insufficient_credits")
	ErrOrgMembershipRequired = errors.New("organization_membership_required")
	ErrRBACDenied            = errors.New("rbac_denied")
	ErrInvalidInput          = errors.New("invalid_input")
)
