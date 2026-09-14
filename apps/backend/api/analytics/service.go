package analytics

import (
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"backend/database"
	"backend/models"
	"backend/services"
	"backend/services/policy"
)

var logger *services.DatabaseLogger
var policySvc *policy.Service

func SetLogger(db *database.DB) {
	logger = services.NewDatabaseLogger(db)
	policySvc = policy.NewService(db)
}

func authorizeAnalyticsPlan(c *gin.Context, actionKey string) bool {
	if policySvc == nil {
		return true
	}
	userID := c.GetString("user_id")
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return false
	}

	var orgUUID *uuid.UUID
	if orgIDStr := c.Query("organization_id"); orgIDStr != "" {
		if parsed, err := uuid.Parse(orgIDStr); err == nil {
			orgUUID = &parsed
		}
	}

	_, err = policySvc.AuthorizeAndMaybeConsume(policy.AuthorizeInput{
		UserID:          userUUID,
		OrganizationID:  orgUUID,
		ActionKey:       actionKey,
		RequireBillable: false,
		EndpointRole:    policy.EndpointRoleView,
	})
	if err == nil {
		return true
	}
	switch err {
	case policy.ErrFeatureNotAllowed, policy.ErrOrgMembershipRequired, policy.ErrRBACDenied:
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "policy check failed"})
	}
	return false
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
		if !authorizeAnalyticsPlan(c, "analytics.agent_runs") {
			return
		}
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
		if !authorizeAnalyticsPlan(c, "analytics.agent_usage") {
			return
		}
		proxyGetJSON(c, "/api/v1/analytics/agent/usage", "ANALYTICS_AGENT_USAGE")
	}
}

// GetToolExecutions godoc
// @Summary      List tool runs (paginated)
// @Description  Proxies to AI engine analytics tool executions endpoint.
// @Tags         analytics
// @Security     BearerAuth
// @Param        tool_name          query string false "Filter by tool name"
// @Param        status             query string false "Filter by status: running|succeeded|failed"
// @Param        ignitic_identifier query string false "Filter by ignitic identifier"
// @Param        chat_id            query string false "Filter by chat id"
// @Param        is_workflow        query bool   false "Filter by workflow executions"
// @Param        workflow_provider  query string false "Filter by workflow provider"
// @Param        start_date         query string false "Inclusive start datetime (RFC3339)"
// @Param        end_date           query string false "Inclusive end datetime (RFC3339)"
// @Param        org_only           query bool   false "If true, only org executions are allowed"
// @Param        page               query int    false "Page number (default 1, min 1)"
// @Param        page_size          query int    false "Page size (default 50, min 1, max 100)"
// @Success      200  {object}  map[string]interface{}
// @Failure      400  {object}  map[string]interface{}
// @Failure      401  {object}  map[string]interface{}
// @Failure      500  {object}  map[string]interface{}
// @Router       /api/v1/analytics/tool/executions [get]
func GetToolExecutions() gin.HandlerFunc {
	return func(c *gin.Context) {
		proxyGetJSON(c, "/api/v1/analytics/tool/executions", "ANALYTICS_TOOL_EXECUTIONS")
	}
}

// GetToolExecutionByID godoc
// @Summary      Get single tool run
// @Description  Proxies to AI engine analytics tool execution-by-id endpoint.
// @Tags         analytics
// @Security     BearerAuth
// @Param        execution_id path string true "Tool execution id (Mongo ObjectId)"
// @Success      200  {object}  map[string]interface{}
// @Failure      400  {object}  map[string]interface{}
// @Failure      401  {object}  map[string]interface{}
// @Failure      500  {object}  map[string]interface{}
// @Router       /api/v1/analytics/tool/executions/{execution_id} [get]
func GetToolExecutionByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		executionID := c.Param("execution_id")
		proxyGetJSON(c, "/api/v1/analytics/tool/executions/"+executionID, "ANALYTICS_TOOL_EXECUTION_BY_ID")
	}
}
