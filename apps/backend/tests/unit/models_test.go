package unit

import (
	"testing"

	"backend/models"
)

func TestUser_TableName(t *testing.T) {
	var u models.User
	if got := u.TableName(); got != "users" {
		t.Fatalf("User.TableName() = %q, want users", got)
	}
}

func TestOrganization_TableName(t *testing.T) {
	var o models.Organization
	if got := o.TableName(); got != "organizations" {
		t.Fatalf("Organization.TableName() = %q, want organizations", got)
	}
}

func TestUserOrganization_TableName(t *testing.T) {
	var uo models.UserOrganization
	if got := uo.TableName(); got != "user_organizations" {
		t.Fatalf("UserOrganization.TableName() = %q, want user_organizations", got)
	}
}
