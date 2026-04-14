package nonfunctional_test

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"backend/api/credential"
	"backend/models"
	"backend/tests/testutil"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

func TestTamperedJWTRejected(t *testing.T) {
	secret := "security-secret"
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": uuid.NewString(),
		"email":   "sec@example.com",
		"role":    "user",
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
	})
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	tampered := signed[:len(signed)-1] + "x"
	parsed, err := jwt.Parse(tampered, func(token *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})
	if err == nil && parsed != nil && parsed.Valid {
		t.Fatalf("tampered token was accepted")
	}
}

func TestSecretOrgAccessDenied(t *testing.T) {
	t.Setenv("ENCRYPTION_KEY", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")

	db := testutil.NewSQLiteDB(t,
		&models.User{},
		&models.Organization{},
		&models.UserOrganization{},
		&models.Secret{},
	)

	svc, err := credential.NewCredentialService(db)
	if err != nil {
		t.Fatalf("credential service: %v", err)
	}

	adminHash, _ := bcrypt.GenerateFromPassword([]byte("AdminPass123!"), bcrypt.DefaultCost)
	memberHash, _ := bcrypt.GenerateFromPassword([]byte("MemberPass123!"), bcrypt.DefaultCost)

	admin := models.User{Email: "admin.sec@example.com", Password: string(adminHash), FirstName: "Admin", LastName: "User", Role: "user", IsActive: true, EmailVerified: true}
	member := models.User{Email: "member.sec@example.com", Password: string(memberHash), FirstName: "Member", LastName: "User", Role: "user", IsActive: true, EmailVerified: true}
	if err := db.Create(&admin).Error; err != nil {
		t.Fatalf("create admin: %v", err)
	}
	if err := db.Create(&member).Error; err != nil {
		t.Fatalf("create member: %v", err)
	}

	org := models.Organization{Name: "Secret Org", EmployeeCount: 2, CreatedBy: admin.ID}
	if err := db.Create(&org).Error; err != nil {
		t.Fatalf("create org: %v", err)
	}

	ctx, rec := testutil.JSONContext(t, http.MethodPut, "/secrets/github/token", map[string]any{
		"value":           "super-secret-value",
		"organization_id": org.ID,
	}, gin.Params{{Key: "app", Value: "github"}, {Key: "name", Value: "token"}})
	ctx.Set("user_id", member.ID.String())
	svc.PutSecret(ctx)

	testutil.MustStatus(t, rec, http.StatusForbidden)
	testutil.BodyContains(t, rec, "Access denied to organization")

	// The request must not have created a secret row.
	var count int64
	if err := db.Model(&models.Secret{}).Count(&count).Error; err != nil {
		t.Fatalf("count secrets: %v", err)
	}
	if count != 0 {
		t.Fatalf("unexpected secret rows created: %d", count)
	}
}

func TestWeakJWTSecretRotationFailureMode(t *testing.T) {
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"sub": "x"}).SignedString([]byte("short"))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		t.Fatalf("unexpected jwt shape")
	}
	parts[2] = "invalidsignature"
	tampered := strings.Join(parts, ".")
	_, err = jwt.Parse(tampered, func(token *jwt.Token) (interface{}, error) {
		return []byte("short"), nil
	})
	if err == nil {
		t.Fatalf("expected tampered signature to fail")
	}
}
