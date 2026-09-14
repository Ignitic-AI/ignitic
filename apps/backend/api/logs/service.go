package logs

import (
	"backend/database"
	"backend/models"
	"net/http"

	"github.com/gin-gonic/gin"
)

type LogService struct {
	db *database.DB
}

func NewLogService(db *database.DB) *LogService { return &LogService{db: db} }

// ListLogs returns recent logs with optional filters (?level=INFO&user_id=...)
func (s *LogService) ListLogs() gin.HandlerFunc {
	return func(c *gin.Context) {
		var logs []models.Log
		q := s.db.Order("timestamp DESC").Limit(200)

		if level := c.Query("level"); level != "" {
			q = q.Where("level = ?", level)
		}
		if section := c.Query("section"); section != "" {
			q = q.Where("section = ?", section)
		}
		if userID := c.Query("user_id"); userID != "" {
			q = q.Where("user_id = ?", userID)
		}
		if orgID := c.Query("organization_id"); orgID != "" {
			q = q.Where("organization_id = ?", orgID)
		}
		if err := q.Find(&logs).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query logs"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"count": len(logs), "logs": logs})
	}
}

// ListLogsBySection returns logs for a given section
func (s *LogService) ListLogsBySection() gin.HandlerFunc {
	return func(c *gin.Context) {
		section := c.Param("section")
		var logs []models.Log
		q := s.db.Where("section = ?", section).Order("timestamp DESC").Limit(200)
		if level := c.Query("level"); level != "" {
			q = q.Where("level = ?", level)
		}
		if err := q.Find(&logs).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query logs"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"count": len(logs), "logs": logs})
	}
}

// ListSections returns distinct sections present
func (s *LogService) ListSections() gin.HandlerFunc {
	return func(c *gin.Context) {
		var sections []string
		if err := s.db.Model(&models.Log{}).Distinct().Pluck("section", &sections).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query sections"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"sections": sections})
	}
}
