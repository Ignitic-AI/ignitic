package credits

import (
	"backend/database"
	"backend/services/policy"
	"fmt"
	"math"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type CreditsService struct {
	policy *policy.Service
}

func NewCreditsService(db *database.DB) *CreditsService {
	return &CreditsService{policy: policy.NewService(db)}
}

func parseOptionalOrgID(c *gin.Context) (*uuid.UUID, error) {
	orgIDStr := c.Query("organization_id")
	if orgIDStr == "" {
		return nil, nil
	}
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		return nil, err
	}
	return &orgID, nil
}

func (s *CreditsService) Overview(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}
	orgID, err := parseOptionalOrgID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization_id"})
		return
	}
	account, plan, err := s.policy.GetOverview(userUUID, orgID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"owner_type":        account.OwnerType,
		"owner_id":          account.OwnerID,
		"plan":              plan.Code,
		"total_credits":     account.TotalCredits,
		"credits_consumed":  account.CreditsConsumed,
		"available_credits": account.AvailableCredits(),
		"cycle_start":       account.CycleStart,
		"cycle_end":         account.CycleEnd,
		"status":            account.Status,
	})
}

func (s *CreditsService) Records(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}
	orgID, err := parseOptionalOrgID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization_id"})
		return
	}
	page := 1
	pageSize := 20
	if v := c.Query("page"); v != "" {
		if _, err := fmt.Sscanf(v, "%d", &page); err != nil {
			page = 1
		}
	}
	if v := c.Query("page_size"); v != "" {
		if _, err := fmt.Sscanf(v, "%d", &pageSize); err != nil {
			pageSize = 20
		}
	}
	records, total, err := s.policy.ListRecords(userUUID, orgID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	totalPages := int(math.Ceil(float64(total) / float64(max(1, pageSize))))
	c.JSON(http.StatusOK, gin.H{"records": records, "total": total, "page": page, "page_size": pageSize, "total_pages": totalPages})
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func (s *CreditsService) Entitlements(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}
	orgID, err := parseOptionalOrgID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization_id"})
		return
	}
	rules, plan, err := s.policy.GetEntitlements(userUUID, orgID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"plan": plan.Code, "rules": rules})
}
