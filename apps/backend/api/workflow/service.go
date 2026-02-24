package workflow

import (
	"backend/database"
	"backend/models"
	"backend/services"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

var (
	logger   *services.DatabaseLogger
	dbClient *database.DB
)

func SetDB(database *database.DB) {
	dbClient = database
}

func SetLogger(database *database.DB) {
	logger = services.NewDatabaseLogger(database)
}

func aiEngineBaseURL() (string, bool) {
	v := strings.TrimRight(os.Getenv("AI_ENGINE_URL"), "/")
	if v == "" {
		return "", false
	}
	return v, true
}

var (
	workflowViewRoles  = map[string]bool{"admin": true, "member": true, "viewer": true}
	workflowAdminRoles = map[string]bool{"admin": true}
)

func resolveOrganizationID(userID string) (string, error) {
	if dbClient == nil || userID == "" {
		return "", nil
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return "", nil
	}

	var user models.User
	if err := dbClient.Where("id = ?", userUUID).First(&user).Error; err == nil {
		if user.OrganizationID != nil {
			return user.OrganizationID.String(), nil
		}
	}

	var userOrg models.UserOrganization
	if err := dbClient.Where("user_id = ? AND is_active = true", userUUID).First(&userOrg).Error; err == nil {
		return userOrg.OrganizationID.String(), nil
	}

	return "", nil
}

func getUserOrgRole(userID string, orgID string) (string, bool, error) {
	if dbClient == nil || userID == "" || orgID == "" {
		return "", false, nil
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return "", false, err
	}

	orgUUID, err := uuid.Parse(orgID)
	if err != nil {
		return "", false, err
	}

	var userOrg models.UserOrganization
	if err := dbClient.Where("user_id = ? AND organization_id = ? AND is_active = true", userUUID, orgUUID).First(&userOrg).Error; err != nil {
		return "", false, nil
	}

	return userOrg.Role, true, nil
}

func authorizeWorkflowAction(c *gin.Context, allowedRoles map[string]bool, eventCode string) bool {
	userID, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return false
	}

	orgID, _ := resolveOrganizationID(userID.(string))
	if orgID == "" {
		return true
	}

	role, ok, err := getUserOrgRole(userID.(string), orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to authorize request"})
		return false
	}

	if !ok || !allowedRoles[role] {
		if logger != nil {
			userUUID, _ := uuid.Parse(userID.(string))
			logger.LogRBAC(c.Request.Context(), models.LogLevelWarn, eventCode+"_FORBIDDEN",
				"Access denied",
				services.WithUserID(userUUID),
				services.WithEndpoint(c.FullPath()),
				services.WithMethod(c.Request.Method),
				services.WithIPAddress(c.ClientIP()),
				services.WithStatusCode(http.StatusForbidden),
				services.WithMetadata(map[string]interface{}{
					"organization_id": orgID,
					"role":            role,
				}),
			)
		}
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return false
	}

	return true
}

func proxyRequest(c *gin.Context, method string, path string, eventCode string, body io.Reader) int {
	userID, ok := c.Get("user_id")
	if !ok {
		if logger != nil {
			logger.Log(context.Background(), models.LogLevelWarn, models.SectionSystem,
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
			logger.Log(context.Background(), models.LogLevelError, models.SectionSystem,
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

	req, err := http.NewRequestWithContext(c.Request.Context(), method, url, body)
	if err != nil {
		if logger != nil {
			userUUID, _ := uuid.Parse(userID.(string))
			logger.Log(context.Background(), models.LogLevelError, models.SectionSystem,
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

	// Forward authorization header
	auth := c.GetHeader("Authorization")
	if auth != "" {
		req.Header.Set("Authorization", auth)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		if logger != nil {
			userUUID, _ := uuid.Parse(userID.(string))
			logger.Log(context.Background(), models.LogLevelError, models.SectionSystem,
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

	// Log success or error based on status code
	if logger != nil {
		userUUID, _ := uuid.Parse(userID.(string))
		logLevel := models.LogLevelInfo
		if statusCode >= 400 {
			logLevel = models.LogLevelError
		}

		metadata := map[string]interface{}{
			"upstream_url": url,
			"status_code":  statusCode,
			"event_code":   eventCode,
		}

		if templateID := c.Param("id"); templateID != "" {
			metadata["template_id"] = templateID
		}

		logger.Log(context.Background(), logLevel, models.SectionSystem,
			"Workflow proxy request completed",
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

// importWorkflowFromJSON handles importing a workflow from JSON
// @Summary Import workflow from JSON
// @Description Import an N8N workflow template from JSON
// @Tags workflow
// @Accept json
// @Produce json
// @Param body body ImportWorkflowRequest true "Workflow import data"
// @Success 200 {object} SuccessResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Router /workflow-template/n8n/import [post]
func importWorkflowFromJSON() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !authorizeWorkflowAction(c, workflowAdminRoles, "WORKFLOW_IMPORT") {
			return
		}
		// Read the request body
		bodyBytes, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:   "Failed to read request body",
				Message: err.Error(),
				Code:    http.StatusBadRequest,
			})
			return
		}
		c.Request.Body.Close()

		// Create a new reader from the body bytes for proxying
		bodyReader := strings.NewReader(string(bodyBytes))

		// Proxy to AI engine
		proxyRequest(c, http.MethodPost, "/api/v1/workflow-template/n8n/import", "WORKFLOW_IMPORT", bodyReader)
	}
}

// getWorkflowTemplates retrieves a list of workflow templates
// @Summary Get workflow templates
// @Description Retrieve a list of workflow templates
// @Tags workflow
// @Produce json
// @Param limit query int false "Limit" default(10)
// @Param n8n_json query bool false "Include n8n_json" default(true)
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Router /workflow-template/n8n/ [get]
func getWorkflowTemplates() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !authorizeWorkflowAction(c, workflowViewRoles, "WORKFLOW_LIST") {
			return
		}
		// Proxy to AI engine
		proxyRequest(c, http.MethodGet, "/api/v1/workflow-template/n8n/", "WORKFLOW_LIST", nil)
	}
}

// getWorkflowTemplate retrieves a specific workflow template by ID
// @Summary Get workflow template
// @Description Retrieve a specific N8N workflow template by its ID
// @Tags workflow
// @Produce json
// @Param id path string true "Workflow Template ID"
// @Success 200 {object} WorkflowTemplateResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /workflow-template/n8n/{id} [get]
func getWorkflowTemplate() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !authorizeWorkflowAction(c, workflowViewRoles, "WORKFLOW_GET") {
			return
		}
		templateID := c.Param("id")
		if templateID == "" {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:   "Template ID required",
				Message: "Missing template ID parameter",
				Code:    http.StatusBadRequest,
			})
			return
		}

		// Proxy to AI engine
		proxyRequest(c, http.MethodGet, fmt.Sprintf("/api/v1/workflow-template/n8n/%s", templateID), "WORKFLOW_GET", nil)
	}
}

// deleteWorkflowTemplate deletes a workflow template by ID
// @Summary Delete workflow template
// @Description Delete a specific N8N workflow template by its ID
// @Tags workflow
// @Produce json
// @Param id path string true "Workflow Template ID"
// @Success 200 {object} SuccessResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /workflow-template/n8n/{id} [delete]
func deleteWorkflowTemplate() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !authorizeWorkflowAction(c, workflowAdminRoles, "WORKFLOW_DELETE") {
			return
		}
		templateID := c.Param("id")
		if templateID == "" {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:   "Template ID required",
				Message: "Missing template ID parameter",
				Code:    http.StatusBadRequest,
			})
			return
		}

		// Proxy to AI engine
		proxyRequest(c, http.MethodDelete, fmt.Sprintf("/api/v1/workflow-template/n8n/%s", templateID), "WORKFLOW_DELETE", nil)
	}
}
