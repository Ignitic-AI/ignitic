package analytics

import (
	"backend/database"
	"backend/models"
	"backend/services"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

var logger *services.DatabaseLogger

func SetLogger(db *database.DB) {
	logger = services.NewDatabaseLogger(db)
}

func aiEngineBaseURL() (string, bool) {
	v := strings.TrimRight(os.Getenv("AI_ENGINE_URL"), "/")
	if v == "" {
		return "", false
	}
	return v, true
}

func proxyGetJSON(c *gin.Context, path string, eventCode string) int {
	userID, ok := c.Get("user_id")
	if !ok {
		if logger != nil {
			logger.LogAgents(c.Request.Context(), models.LogLevelWarn, eventCode+"_FAILED",
				"User not authenticated",
				services.WithEndpoint(c.FullPath()),
				services.WithMethod(c.Request.Method),
				services.WithIPAddress(c.ClientIP()),
				services.WithStatusCode(http.StatusUnauthorized),
			)
		}
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return http.StatusUnauthorized
	}

	base, ok := aiEngineBaseURL()
	if !ok {
		if logger != nil {
			userUUID, _ := uuid.Parse(userID.(string))
			logger.LogAgents(c.Request.Context(), models.LogLevelError, eventCode+"_FAILED",
				"AI_ENGINE_URL not configured",
				services.WithUserID(userUUID),
				services.WithEndpoint(c.FullPath()),
				services.WithMethod(c.Request.Method),
				services.WithIPAddress(c.ClientIP()),
				services.WithStatusCode(http.StatusInternalServerError),
			)
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI_ENGINE_URL not configured"})
		return http.StatusInternalServerError
	}

	url := base + path
	if raw := c.Request.URL.RawQuery; raw != "" {
		url += "?" + raw
	}

	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, url, nil)
	if err != nil {
		if logger != nil {
			userUUID, _ := uuid.Parse(userID.(string))
			logger.LogAgents(c.Request.Context(), models.LogLevelError, eventCode+"_FAILED",
				"Failed to build upstream request",
				services.WithUserID(userUUID),
				services.WithEndpoint(c.FullPath()),
				services.WithMethod(c.Request.Method),
				services.WithIPAddress(c.ClientIP()),
				services.WithStatusCode(http.StatusInternalServerError),
				services.WithMetadata(map[string]interface{}{
					"error": err.Error(),
				}),
			)
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to build upstream request"})
		return http.StatusInternalServerError
	}

	auth := c.GetHeader("Authorization")
	if auth == "" {
		if t := c.Query("token"); t != "" {
			auth = "Bearer " + t
		}
	}
	if auth != "" {
		req.Header.Set("Authorization", auth)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		if logger != nil {
			userUUID, _ := uuid.Parse(userID.(string))
			logger.LogAgents(c.Request.Context(), models.LogLevelError, eventCode+"_FAILED",
				"Upstream unavailable",
				services.WithUserID(userUUID),
				services.WithEndpoint(c.FullPath()),
				services.WithMethod(c.Request.Method),
				services.WithIPAddress(c.ClientIP()),
				services.WithStatusCode(http.StatusBadGateway),
				services.WithMetadata(map[string]interface{}{
					"error": err.Error(),
					"url":   url,
				}),
			)
		}
		c.JSON(http.StatusBadGateway, gin.H{"error": "upstream unavailable"})
		return http.StatusBadGateway
	}
	defer resp.Body.Close()

	statusCode := resp.StatusCode
	c.Status(statusCode)
	c.Header("Content-Type", resp.Header.Get("Content-Type"))
	io.Copy(c.Writer, resp.Body)

	if logger != nil {
		userUUID, _ := uuid.Parse(userID.(string))
		logLevel := models.LogLevelInfo
		logEvent := eventCode + "_SUCCESS"
		if statusCode >= 400 {
			logLevel = models.LogLevelError
			logEvent = eventCode + "_FAILED"
		}

		metadata := map[string]interface{}{
			"upstream_url": url,
			"status_code":  statusCode,
		}

		logger.LogAgents(c.Request.Context(), logLevel, logEvent,
			"Analytics proxy request completed",
			services.WithUserID(userUUID),
			services.WithEndpoint(c.FullPath()),
			services.WithMethod(c.Request.Method),
			services.WithIPAddress(c.ClientIP()),
			services.WithStatusCode(statusCode),
			services.WithMetadata(metadata),
		)
	}

	return statusCode
}

// GetAgentRuns godoc
// @Summary      List agent runs (paginated)
// @Description  Proxies to AI engine analytics agent runs endpoint.
// @Tags         analytics
// @Security     BearerAuth
// @Param        agent_identifier query string false "Filter by agent identifier"
// @Param        start_date       query string false "Inclusive start datetime (RFC3339)"
// @Param        end_date         query string false "Inclusive end datetime (RFC3339)"
// @Param        org_only         query bool   false "If true, only org runs are allowed"
// @Param        page             query int    false "Page number (min 1)"
// @Param        page_size        query int    false "Page size (min 1, max 100)"
// @Success      200  {object}  map[string]interface{}
// @Failure      400  {object}  map[string]interface{}
// @Failure      401  {object}  map[string]interface{}
// @Failure      500  {object}  map[string]interface{}
// @Router       /api/v1/analytics/agent/runs [get]
func GetAgentRuns() gin.HandlerFunc {
	return func(c *gin.Context) {
		proxyGetJSON(c, "/api/v1/analytics/agent/runs", "ANALYTICS_AGENT_RUNS")
	}
}

// GetAgentUsage godoc
// @Summary      Get aggregated agent usage
// @Description  Proxies to AI engine analytics agent usage endpoint.
// @Tags         analytics
// @Security     BearerAuth
// @Param        agent_identifiers query []string false "Filter by agent identifiers"
// @Param        org_only           query bool     false "If true, only org runs are allowed"
// @Param        start_date         query string   false "Inclusive start datetime (RFC3339)"
// @Param        end_date           query string   false "Inclusive end datetime (RFC3339)"
// @Success      200  {array}  map[string]interface{}
// @Failure      400  {object}  map[string]interface{}
// @Failure      401  {object}  map[string]interface{}
// @Failure      500  {object}  map[string]interface{}
// @Router       /api/v1/analytics/agent/usage [get]
func GetAgentUsage() gin.HandlerFunc {
	return func(c *gin.Context) {
		proxyGetJSON(c, "/api/v1/analytics/agent/usage", "ANALYTICS_AGENT_USAGE")
	}
}
