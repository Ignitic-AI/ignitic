package agents

import (
	"backend/database"
	"backend/models"
	"backend/services"
	"backend/services/policy"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	amqp "github.com/rabbitmq/amqp091-go"
)

// WebSocket connection manager
type WebSocketManager struct {
	connections map[string]*WebSocketConnection
	mutex       sync.RWMutex
}

type WebSocketConnection struct {
	ID             string
	UserID         string
	OrganizationID string
	OrgRole        string
	AuthToken      string // optional: store JWT
	Conn           *websocket.Conn
	Send           chan []byte
	Manager        *WebSocketManager
	authenticated  bool
	mu             sync.Mutex
}

// Global WebSocket manager
var WSManager = &WebSocketManager{
	connections: make(map[string]*WebSocketConnection),
}

// RabbitMQ connection and channel
var (
	rabbitmqConn    *amqp.Connection
	rabbitmqChannel *amqp.Channel
	logger          *services.DatabaseLogger
	dbClient        *database.DB
	policyService   *policy.Service
)

var (
	agentViewRoles  = map[string]bool{"admin": true, "member": true, "viewer": true}
	agentRunRoles   = map[string]bool{"admin": true, "member": true}
	agentAdminRoles = map[string]bool{"admin": true}
)

// SetLogger sets the database logger for the agents package
func SetLogger(db *database.DB) {
	logger = services.NewDatabaseLogger(db)
}

// SetDB sets the database client for the agents package
func SetDB(db *database.DB) {
	dbClient = db
	policyService = policy.NewService(db)
}

// resolveOrganizationID tries to determine the organization ID for a user
func resolveOrganizationID(userID string) (string, error) {
	if dbClient == nil || userID == "" {
		return "", nil
	}

	// Parse user UUID
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return "", nil
	}

	// Prefer user's primary OrganizationID if set
	var user models.User
	if err := dbClient.Where("id = ?", userUUID).First(&user).Error; err == nil {
		if user.OrganizationID != nil {
			return user.OrganizationID.String(), nil
		}
	}

	// Fallback: first active membership from user_organizations
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

func authorizeAgentAction(c *gin.Context, allowedRoles map[string]bool, eventCode string) bool {
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
		return false
	}

	orgID := c.Query("organization_id")
	if orgID == "" {
		orgID, _ = resolveOrganizationID(userID.(string))
	}
	if orgID == "" {
		return true
	}

	role, ok, err := getUserOrgRole(userID.(string), orgID)
	if err != nil {
		if logger != nil {
			userUUID, _ := uuid.Parse(userID.(string))
			logger.LogAgents(c.Request.Context(), models.LogLevelError, eventCode+"_FAILED",
				"Failed to resolve organization role",
				services.WithUserID(userUUID),
				services.WithEndpoint(c.FullPath()),
				services.WithMethod(c.Request.Method),
				services.WithIPAddress(c.ClientIP()),
				services.WithStatusCode(http.StatusInternalServerError),
			)
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to authorize request"})
		return false
	}

	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return false
	}

	// Business-only RBAC strictness. Starter/Pro require membership only.
	if policyService != nil {
		userUUID, parseUserErr := uuid.Parse(userID.(string))
		orgUUID, parseOrgErr := uuid.Parse(orgID)
		if parseUserErr == nil && parseOrgErr == nil {
			_, plan, planErr := policyService.GetOverview(userUUID, &orgUUID)
			if planErr == nil && plan.Code != "business" {
				return true
			}
		}
	}

	if !allowedRoles[role] {
		if logger != nil {
			userUUID, _ := uuid.Parse(userID.(string))
			logger.LogAgents(c.Request.Context(), models.LogLevelWarn, eventCode+"_FORBIDDEN",
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

func endpointRoleFromAllowed(allowedRoles map[string]bool) policy.EndpointRole {
	if allowedRoles["admin"] && !allowedRoles["member"] && !allowedRoles["viewer"] {
		return policy.EndpointRoleAdmin
	}
	if allowedRoles["admin"] && allowedRoles["member"] {
		return policy.EndpointRoleRun
	}
	return policy.EndpointRoleView
}

func authorizePlanAction(c *gin.Context, actionKey string, role policy.EndpointRole, billable bool, model string, tools []string, agentsCount int, referenceID string, orgID string) bool {
	if policyService == nil {
		return true
	}

	userIDStr := c.GetString("user_id")
	userUUID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return false
	}

	var orgUUID *uuid.UUID
	if orgID != "" {
		parsedOrgID, err := uuid.Parse(orgID)
		if err == nil {
			orgUUID = &parsedOrgID
		}
	}

	_, err = policyService.AuthorizeAndMaybeConsume(policy.AuthorizeInput{
		UserID:          userUUID,
		OrganizationID:  orgUUID,
		ActionKey:       actionKey,
		Model:           model,
		Tools:           tools,
		AgentsCount:     agentsCount,
		ReferenceID:     referenceID,
		RequireBillable: billable,
		EndpointRole:    role,
		RequestMeta: map[string]interface{}{
			"endpoint": c.FullPath(),
		},
	})
	if err == nil {
		return true
	}

	switch err {
	case policy.ErrInsufficientCredits:
		c.JSON(http.StatusPaymentRequired, gin.H{"error": "insufficient credits"})
	case policy.ErrRBACDenied, policy.ErrFeatureNotAllowed, policy.ErrModelNotAllowed, policy.ErrToolNotAllowed:
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
	case policy.ErrOrgMembershipRequired:
		c.JSON(http.StatusForbidden, gin.H{"error": "organization membership required"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "policy check failed"})
	}
	return false
}

// Initialize RabbitMQ connection
func initRabbitMQ() error {
	// Get RabbitMQ URL from environment
	rabbitmqURL := os.Getenv("RABBITMQ_URL")
	if rabbitmqURL == "" {
		rabbitmqURL = "amqp://sami:sami@1234@localhost:5672/" // fallback
	}

	// Create a config with connection timeout to prevent hanging
	config := amqp.Config{
		Dial: func(network, addr string) (net.Conn, error) {
			return net.DialTimeout(network, addr, 5*time.Second)
		},
	}

	var err error
	var retries = 3
	var retryDelay = 2 * time.Second

	for attempt := 1; attempt <= retries; attempt++ {
		log.Printf("🔄 Attempting to connect to RabbitMQ (attempt %d/%d)...", attempt, retries)

		rabbitmqConn, err = amqp.DialConfig(rabbitmqURL, config)
		if err == nil {
			log.Printf("✅ Successfully connected to RabbitMQ")
			break
		}

		if attempt < retries {
			log.Printf("❌ Connection attempt %d failed: %v. Retrying in %v...", attempt, err, retryDelay)
			time.Sleep(retryDelay)
		} else {
			log.Printf("❌ Failed to connect to RabbitMQ after %d attempts: %v", retries, err)
			return fmt.Errorf("RabbitMQ connection failed after %d attempts: %w", retries, err)
		}
	}

	rabbitmqChannel, err = rabbitmqConn.Channel()
	if err != nil {
		return err
	}

	// Declare exchange for agent requests
	err = rabbitmqChannel.ExchangeDeclare(
		"agent_exchange", // name
		"direct",         // type
		true,             // durable
		false,            // auto-deleted
		false,            // internal
		false,            // no-wait
		nil,              // arguments
	)
	if err != nil {
		return err
	}

	// Declare exchange for asset requests
	err = rabbitmqChannel.ExchangeDeclare(
		"asset_exchange", // name
		"topic",          // type - changed to match existing exchange
		true,             // durable
		false,            // auto-deleted
		false,            // internal
		false,            // no-wait
		nil,              // arguments
	)
	if err != nil {
		return err
	}

	// Declare agent request queue
	_, err = rabbitmqChannel.QueueDeclare(
		"agent_request_queue", // name
		true,                  // durable
		false,                 // delete when unused
		false,                 // exclusive
		false,                 // no-wait
		nil,                   // arguments
	)
	if err != nil {
		return err
	}

	// Declare agent response queue
	_, err = rabbitmqChannel.QueueDeclare(
		"agent_response_queue", // name
		true,                   // durable
		false,                  // delete when unused
		false,                  // exclusive
		false,                  // no-wait
		nil,                    // arguments
	)
	if err != nil {
		return err
	}

	// Bind queues to exchange
	err = rabbitmqChannel.QueueBind(
		"agent_request_queue", // queue name
		"agent_request",       // routing key
		"agent_exchange",      // exchange
		false,
		nil,
	)
	if err != nil {
		return err
	}

	err = rabbitmqChannel.QueueBind(
		"agent_response_queue", // queue name
		"agent_response",       // routing key
		"agent_exchange",       // exchange
		false,
		nil,
	)
	if err != nil {
		return err
	}

	_, err = rabbitmqChannel.QueueDeclare(
		"asset_processing_queue",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return err
	}

	err = rabbitmqChannel.QueueBind(
		"asset_processing_queue",
		"asset_process",
		"asset_exchange",
		false,
		nil,
	)
	if err != nil {
		return err
	}

	// Declare agent stream queue for chunked responses
	_, err = rabbitmqChannel.QueueDeclare(
		"agent_stream_queue",
		true,  // durable
		false, // delete when unused
		false, // exclusive
		false, // no-wait
		nil,   // arguments
	)
	if err != nil {
		return err
	}

	err = rabbitmqChannel.QueueBind(
		"agent_stream_queue",
		"agent_stream", // routing key
		"agent_exchange",
		false,
		nil,
	)
	if err != nil {
		return err
	}

	log.Println("✅ Agent RabbitMQ queues initialized successfully")

	// Start consuming responses for WebSocket notifications
	go startResponseConsumer()
	go startStreamConsumer()

	return nil
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

	// Log success or error based on status code
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

		// Add path-specific metadata
		if agent := c.Param("agent"); agent != "" {
			metadata["agent"] = agent
		}
		if chatID := c.Param("chat_id"); chatID != "" {
			metadata["chat_id"] = chatID
		}

		logger.LogAgents(c.Request.Context(), logLevel, logEvent,
			"Agent proxy request completed",
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

func proxyPublicGetJSON(c *gin.Context, path string) int {
	base, ok := aiEngineBaseURL()
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI_ENGINE_URL not configured"})
		return http.StatusInternalServerError
	}

	url := base + path
	if raw := c.Request.URL.RawQuery; raw != "" {
		url += "?" + raw
	}

	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, url, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to build upstream request"})
		return http.StatusInternalServerError
	}
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "upstream unavailable"})
		return http.StatusBadGateway
	}
	defer resp.Body.Close()

	statusCode := resp.StatusCode
	c.Status(statusCode)
	c.Header("Content-Type", resp.Header.Get("Content-Type"))
	io.Copy(c.Writer, resp.Body)
	return statusCode
}

func proxyDeleteJSON(c *gin.Context, path string, eventCode string) int {
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

	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodDelete, url, nil)
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
		if agent := c.Param("agent"); agent != "" {
			metadata["agent"] = agent
		}
		logger.LogAgents(c.Request.Context(), logLevel, logEvent,
			"Agent proxy request completed",
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

// proxyPutJSON proxies PUT requests to the AI engine
func proxyPutJSON(c *gin.Context, path string, eventCode string, body interface{}) int {
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

	// Marshal request body
	var bodyReader io.Reader
	if body != nil {
		bodyBytes, err := json.Marshal(body)
		if err != nil {
			if logger != nil {
				userUUID, _ := uuid.Parse(userID.(string))
				logger.LogAgents(c.Request.Context(), models.LogLevelError, eventCode+"_FAILED",
					"Failed to marshal request body",
					services.WithUserID(userUUID),
					services.WithEndpoint(c.FullPath()),
					services.WithMethod(c.Request.Method),
					services.WithIPAddress(c.ClientIP()),
					services.WithStatusCode(http.StatusBadRequest),
					services.WithMetadata(map[string]interface{}{
						"error": err.Error(),
					}),
				)
			}
			c.JSON(http.StatusBadRequest, gin.H{"error": "failed to marshal request body"})
			return http.StatusBadRequest
		}
		bodyReader = strings.NewReader(string(bodyBytes))
	}

	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPut, url, bodyReader)
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
	req.Header.Set("Content-Type", "application/json")
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

	// Log success or error based on status code
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

		// Add path-specific metadata
		if agent := c.Param("agent_identifier"); agent != "" {
			metadata["agent_identifier"] = agent
		}
		if agent := c.Param("agent"); agent != "" {
			metadata["agent"] = agent
		}
		if chatID := c.Param("chat_id"); chatID != "" {
			metadata["chat_id"] = chatID
		}

		logger.LogAgents(c.Request.Context(), logLevel, logEvent,
			"Agent proxy request completed",
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

func proxyPostJSON(c *gin.Context, path string, eventCode string, body interface{}) int {
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

	var bodyReader io.Reader
	if body != nil {
		bodyBytes, err := json.Marshal(body)
		if err != nil {
			if logger != nil {
				userUUID, _ := uuid.Parse(userID.(string))
				logger.LogAgents(c.Request.Context(), models.LogLevelError, eventCode+"_FAILED",
					"Failed to marshal request body",
					services.WithUserID(userUUID),
					services.WithEndpoint(c.FullPath()),
					services.WithMethod(c.Request.Method),
					services.WithIPAddress(c.ClientIP()),
					services.WithStatusCode(http.StatusBadRequest),
					services.WithMetadata(map[string]interface{}{
						"error": err.Error(),
					}),
				)
			}
			c.JSON(http.StatusBadRequest, gin.H{"error": "failed to marshal request body"})
			return http.StatusBadRequest
		}
		bodyReader = strings.NewReader(string(bodyBytes))
	}

	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, url, bodyReader)
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
	req.Header.Set("Content-Type", "application/json")
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
		if agent := c.Param("agent"); agent != "" {
			metadata["agent"] = agent
		}
		logger.LogAgents(c.Request.Context(), logLevel, logEvent,
			"Agent proxy request completed",
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

// Proxy-backed REST endpoints
// List Agents godoc
// @Summary      List Agents
// @Description  Proxies to AI engine to list available agents and their tools
// @Tags         agents
// @Security     Bearer
// @Produce      json
// @Success      200  {array}   map[string]interface{}
// @Failure      401  {object}  ErrorResponse
// @Failure      500  {object}  ErrorResponse
// @Router       /api/v1/agents/ [get]
func listAgents() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !authorizeAgentAction(c, agentViewRoles, "LIST_AGENTS") {
			return
		}
		if !authorizePlanAction(c, "agent.chat", endpointRoleFromAllowed(agentViewRoles), false, "", nil, 0, "", c.Query("organization_id")) {
			return
		}
		proxyGetJSON(c, "/api/v1/agents/", "LIST_AGENTS")
	}
}

// Available tools for custom agents (MCP /custom server) godoc
// @Summary      List tools available when building a custom agent
// @Description  Proxies to AI engine GET /api/v1/agents/available-tools
// @Tags         agents
// @Security     Bearer
// @Produce      json
// @Param        is_org  query  bool  false  "Organization scope"
// @Success      200  {array}   map[string]interface{}
// @Router       /api/v1/agents/available-tools [get]
func availableCustomAgentTools() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !authorizeAgentAction(c, agentViewRoles, "AVAILABLE_CUSTOM_AGENT_TOOLS") {
			return
		}
		if !authorizePlanAction(c, "agent.chat", endpointRoleFromAllowed(agentViewRoles), false, "", nil, 0, "", c.Query("organization_id")) {
			return
		}
		proxyGetJSON(c, "/api/v1/agents/available-tools", "AVAILABLE_CUSTOM_AGENT_TOOLS")
	}
}

// Create custom agent godoc
// @Summary      Create custom agent
// @Description  Proxies to AI engine POST /api/v1/agents/
// @Tags         agents
// @Security     Bearer
// @Accept       json
// @Produce      json
// @Param        body  body  AgentCreateRequest  true  "Create payload"
// @Success      201  {object}  map[string]interface{}
// @Router       /api/v1/agents/ [post]
func createCustomAgent() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !authorizeAgentAction(c, agentAdminRoles, "CREATE_CUSTOM_AGENT") {
			return
		}
		if !authorizePlanAction(c, "agent.update", endpointRoleFromAllowed(agentAdminRoles), false, "", nil, 0, "", c.Query("organization_id")) {
			return
		}
		var req AgentCreateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		proxyPostJSON(c, "/api/v1/agents/", "CREATE_CUSTOM_AGENT", req)
	}
}

// Get Agent godoc
// @Summary      Get Agent
// @Description  Proxies to AI engine to get a specific agent by identifier
// @Tags         agents
// @Security     Bearer
// @Produce      json
// @Param        agent  path  string  true  "Agent identifier"
// @Param        is_org  query  bool  false  "Whether the agent is for an organization"
// @Success      200  {array}   map[string]interface{}
// @Failure      401  {object}  ErrorResponse
// @Failure      500  {object}  ErrorResponse
// @Router       /api/v1/agents/{agent}/get-agent [get]
func getAgent() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !authorizeAgentAction(c, agentViewRoles, "GET_AGENT") {
			return
		}
		if !authorizePlanAction(c, "agent.chat", endpointRoleFromAllowed(agentViewRoles), false, "", nil, 0, "", c.Query("organization_id")) {
			return
		}
		agentIdentifier := c.Param("agent")
		proxyGetJSON(c, "/api/v1/agents/"+agentIdentifier, "GET_AGENT")
	}
}

// Update Agent godoc
// @Summary      Update Agent
// @Description  Proxies to AI engine to update a specific agent by identifier
// @Tags         agents
// @Security     Bearer
// @Accept       json
// @Produce      json
// @Param        agent  path  string  true  "Agent identifier"
// @Param        is_org  query  bool  false  "Whether the agent is for an organization"
// @Param        updateRequest  body  AgentUpdateRequest  true  "Agent update data"
// @Success      200  {object}  map[string]interface{}
// @Failure      401  {object}  ErrorResponse
// @Failure      500  {object}  ErrorResponse
// @Router       /api/v1/agents/{agent}/update-agent [put]
func updateAgent() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !authorizeAgentAction(c, agentAdminRoles, "UPDATE_AGENT") {
			return
		}
		if !authorizePlanAction(c, "agent.update", endpointRoleFromAllowed(agentAdminRoles), false, "", nil, 0, "", c.Query("organization_id")) {
			return
		}
		agentIdentifier := c.Param("agent")

		var updateRequest AgentUpdateRequest
		if err := c.ShouldBindJSON(&updateRequest); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		proxyPutJSON(c, "/api/v1/agents/"+agentIdentifier, "UPDATE_AGENT", updateRequest)
	}
}

// Delete custom agent godoc
// @Summary      Delete custom agent
// @Description  Deletes a user-defined agent; prebuilt agents are rejected here and by the AI engine
// @Tags         agents
// @Security     Bearer
// @Param        agent  path  string  true  "Agent identifier"
// @Param        is_org  query  bool  false  "Organization scope"
// @Success      200  {object}  map[string]interface{}
// @Router       /api/v1/agents/{agent} [delete]
func deleteCustomAgent() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !authorizeAgentAction(c, agentAdminRoles, "DELETE_CUSTOM_AGENT") {
			return
		}
		if !authorizePlanAction(c, "agent.update", endpointRoleFromAllowed(agentAdminRoles), false, "", nil, 0, "", c.Query("organization_id")) {
			return
		}

		agentIdentifier := c.Param("agent")
		prebuilt := map[string]bool{
			"product_researcher":  true,
			"marketer":            true,
			"seo_agent":           true,
			"gdrive_agent":        true,
			"shopify_agent":       true,
			"hubspot_agent":       true,
			"facebook_page_agent": true,
			"instagram_agent":     true,
			"super_agent":         true,
		}
		if prebuilt[agentIdentifier] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Prebuilt agents cannot be deleted"})
			return
		}

		proxyDeleteJSON(c, "/api/v1/agents/"+agentIdentifier, "DELETE_CUSTOM_AGENT")
	}
}

// List Agent Tools godoc
// @Summary      List Agent Tools
// @Description  Proxies to AI engine to list tools for a given agent
// @Tags         agents
// @Security     Bearer
// @Produce      json
// @Param        agent  path  string  true  "Agent name (e.g., product_researcher, marketer)"
// @Success      200  {array}   map[string]interface{}
// @Failure      401  {object}  ErrorResponse
// @Failure      500  {object}  ErrorResponse
// @Router       /api/v1/agents/{agent}/tools [get]
func listAgentTools() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !authorizeAgentAction(c, agentViewRoles, "LIST_AGENT_TOOLS") {
			return
		}
		if !authorizePlanAction(c, "agent.chat", endpointRoleFromAllowed(agentViewRoles), false, "", nil, 0, "", c.Query("organization_id")) {
			return
		}
		agent := c.Param("agent")
		proxyGetJSON(c, "/api/v1/agents/"+agent+"/tools", "LIST_AGENT_TOOLS")
	}
}

// List Agent Tool Calls godoc
// @Summary      List Agent Tool Calls
// @Description  Proxies to AI engine to list tool call executions for a given agent
// @Tags         agents
// @Security     Bearer
// @Produce      json
// @Param        agent            path   string  true   "Agent name (e.g., product_researcher, marketer)"
// @Param        scope            query  string  false  "Scope filter: personal|org|all"
// @Param        is_org           query  bool    false  "Legacy organization scope flag (backward compatibility)"
// @Param        page             query  int     false  "Page number"
// @Param        page_size        query  int     false  "Number of entries per page"
// @Param        organization_id  query  string  false  "Organization UUID (used for org scope and plan checks)"
// @Success      200  {object}  map[string]interface{}
// @Failure      401  {object}  ErrorResponse
// @Failure      500  {object}  ErrorResponse
// @Router       /api/v1/agents/{agent}/tool-calls [get]
func listAgentToolCalls() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !authorizeAgentAction(c, agentViewRoles, "LIST_AGENT_TOOL_CALLS") {
			return
		}
		if !authorizePlanAction(c, "agent.chat", endpointRoleFromAllowed(agentViewRoles), false, "", nil, 0, "", c.Query("organization_id")) {
			return
		}
		agent := c.Param("agent")
		proxyGetJSON(c, "/api/v1/agents/"+agent+"/tool-calls", "LIST_AGENT_TOOL_CALLS")
	}
}

// List Chats godoc
// @Summary      List Chats
// @Description  Proxies to AI engine to list chats for the authenticated user
// @Tags         agents
// @Security     Bearer
// @Produce      json
// @Success      200  {array}   map[string]interface{}
// @Failure      401  {object}  ErrorResponse
// @Failure      500  {object}  ErrorResponse
// @Router       /api/v1/agents/chats [get]
func listChats() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !authorizeAgentAction(c, agentViewRoles, "LIST_CHATS") {
			return
		}
		if !authorizePlanAction(c, "agent.chat", endpointRoleFromAllowed(agentViewRoles), false, "", nil, 0, "", c.Query("organization_id")) {
			return
		}
		proxyGetJSON(c, "/api/v1/chat/", "LIST_CHATS")
	}
}

// Get Chat godoc
// @Summary      Get Chat
// @Description  Proxies to AI engine to fetch a single chat by ID
// @Tags         agents
// @Security     Bearer
// @Produce      json
// @Param        chat_id  path  string  true  "Chat ID"
// @Success      200  {object}  map[string]interface{}
// @Failure      401  {object}  ErrorResponse
// @Failure      500  {object}  ErrorResponse
// @Router       /api/v1/agents/chats/{chat_id} [get]
func getChat() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !authorizeAgentAction(c, agentViewRoles, "GET_CHAT") {
			return
		}
		if !authorizePlanAction(c, "agent.chat", endpointRoleFromAllowed(agentViewRoles), false, "", nil, 0, "", c.Query("organization_id")) {
			return
		}
		chatID := c.Param("chat_id")
		proxyGetJSON(c, "/api/v1/chat/"+chatID, "GET_CHAT")
	}
}

// Get Chat Messages godoc
// @Summary      Get Chat Messages
// @Description  Proxies to AI engine to fetch messages for a chat
// @Tags         agents
// @Security     Bearer
// @Produce      json
// @Param        chat_id  path  string  true  "Chat ID"
// @Success      200  {object}  map[string]interface{}
// @Failure      401  {object}  ErrorResponse
// @Failure      500  {object}  ErrorResponse
// @Router       /api/v1/agents/chats/{chat_id}/messages [get]
func getChatMessages() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !authorizeAgentAction(c, agentViewRoles, "GET_CHAT_MESSAGES") {
			return
		}
		if !authorizePlanAction(c, "agent.chat", endpointRoleFromAllowed(agentViewRoles), false, "", nil, 0, "", c.Query("organization_id")) {
			return
		}
		chatID := c.Param("chat_id")
		proxyGetJSON(c, "/api/v1/chat/"+chatID+"/messages", "GET_CHAT_MESSAGES")
	}
}

// Create Chat Share godoc
// @Summary      Create Chat Share
// @Description  Creates or returns a public read-only sharing token for a chat
// @Tags         agents
// @Security     Bearer
// @Produce      json
// @Param        chat_id  path  string  true  "Chat ID"
// @Success      200  {object}  map[string]interface{}
// @Failure      401  {object}  ErrorResponse
// @Failure      404  {object}  ErrorResponse
// @Failure      500  {object}  ErrorResponse
// @Router       /api/v1/agents/chats/{chat_id}/share [post]
func createChatShare() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !authorizeAgentAction(c, agentViewRoles, "CREATE_CHAT_SHARE") {
			return
		}
		if !authorizePlanAction(c, "agent.chat", endpointRoleFromAllowed(agentViewRoles), false, "", nil, 0, "", c.Query("organization_id")) {
			return
		}
		chatID := c.Param("chat_id")
		proxyPostJSON(c, "/api/v1/chat/"+chatID+"/share", "CREATE_CHAT_SHARE", nil)
	}
}

func getSharedChat() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.Param("token")
		proxyPublicGetJSON(c, "/api/v1/chat/shared/"+token)
	}
}

// Delete Chat godoc
// @Summary      Delete Chat
// @Description  Proxies to AI engine to delete a chat and its messages
// @Tags         agents
// @Security     Bearer
// @Produce      json
// @Param        chat_id  path  string  true  "Chat ID"
// @Success      200  {object}  map[string]interface{}
// @Failure      401  {object}  ErrorResponse
// @Failure      404  {object}  ErrorResponse
// @Failure      500  {object}  ErrorResponse
// @Router       /api/v1/agents/chats/{chat_id} [delete]
func deleteChat() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !authorizeAgentAction(c, agentViewRoles, "DELETE_CHAT") {
			return
		}
		if !authorizePlanAction(c, "agent.chat", endpointRoleFromAllowed(agentViewRoles), false, "", nil, 0, "", c.Query("organization_id")) {
			return
		}
		chatID := c.Param("chat_id")
		proxyDeleteJSON(c, "/api/v1/chat/"+chatID, "DELETE_CHAT")
	}
}

// Start consuming AI engine responses
func startResponseConsumer() {
	msgs, err := rabbitmqChannel.Consume(
		"agent_response_queue", // queue
		"",                     // consumer
		false,                  // auto-ack (set to false for manual ack)
		false,                  // exclusive
		false,                  // no-local
		false,                  // no-wait
		nil,                    // args
	)
	if err != nil {
		log.Printf("Failed to start response consumer: %v", err)
		return
	}

	for msg := range msgs {
		var response AgentResponse
		if err := json.Unmarshal(msg.Body, &response); err != nil {
			log.Printf("Failed to unmarshal response: %v", err)
			log.Printf("Raw message body: %s", string(msg.Body))
			// Reject the message and don't requeue it (it's malformed)
			msg.Nack(false, false)
			continue
		}

		// Notify WebSocket clients about the response
		if err := WSManager.BroadcastResponse(response); err != nil {
			log.Printf("Failed to broadcast response: %v", err)
			// Still acknowledge the message since the response was valid,
			// but the WebSocket broadcast failed (maybe no clients connected)
		}

		// Print the agent response to terminal before acking
		log.Printf("📨 Agent Response Received:")
		log.Printf("  Request ID: %s", response.RequestID)
		log.Printf("  User ID: %s", response.UserID)
		log.Printf("  Chat ID: %s", response.ChatID)
		log.Printf("  Status: %s", response.Status)
		if response.Error != "" {
			log.Printf("  Error: %s", response.Error)
		}
		log.Printf("  Response: %s", response.Response)
		log.Printf("  Timestamp: %s", response.Timestamp.Format(time.RFC3339))

		// Acknowledge the message only after successful processing
		msg.Ack(false)
	}
}

// startStreamConsumer consumes chunked stream responses from AI engine
func startStreamConsumer() {
	msgs, err := rabbitmqChannel.Consume(
		"agent_stream_queue",
		"",    // consumer tag
		false, // auto-ack
		false, // exclusive
		false, // no-local
		false, // no-wait
		nil,
	)
	if err != nil {
		log.Printf("Failed to start stream consumer: %v", err)
		return
	}

	for msg := range msgs {
		var chunk AgentStreamChunk
		if err := json.Unmarshal(msg.Body, &chunk); err != nil {
			log.Printf("Failed to unmarshal stream chunk: %v", err)
			msg.Nack(false, false)
			continue
		}

		// Broadcast chunk to WebSocket clients
		if err := WSManager.BroadcastStreamChunk(chunk); err != nil {
			log.Printf("Failed to broadcast stream chunk: %v", err)
		}

		log.Printf("📡 Stream Chunk [%d]: %s (final: %v)",
			chunk.ChunkIndex, chunk.RequestID, chunk.IsFinal)

		msg.Ack(false)
	}
}

// mustMarshal is a small helper that panics on error – safe to use during connection setup/close
func mustMarshal(v any) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		// This should never happen with our simple structs
		log.Printf("FATAL: json.Marshal failed in mustMarshal: %v", err)
		return []byte(`{"type":"error","message":"internal server error"}`)
	}
	return b
}

// WebSocket handler
// WebSocket handler - REWRITTEN FOR CORRECT AUTHENTICATION
func HandleWebSocket(wsManager *WebSocketManager) gin.HandlerFunc {
	// Fixed upgrader with strict Origin check
	upgrader := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			allowedOrigins := map[string]bool{
				"http://localhost:3000": true,
				"http://localhost:5173": true,
			}
			if len(allowedOrigins) == 0 {
				return true // dev mode fallback
			}
			return allowedOrigins[origin]
		},
	}

	return func(c *gin.Context) {
		// Handle preflight
		if c.Request.Method == "OPTIONS" {
			c.Header("Access-Control-Allow-Origin", c.GetHeader("Origin"))
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
			c.Header("Access-Control-Allow-Methods", "GET, OPTIONS")
			c.Status(http.StatusOK)
			return
		}

		// 1. Upgrade to WebSocket (no auth yet)
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("WebSocket upgrade failed: %v", err)
			return
		}

		// 2. Create unauthenticated connection
		wsConn := &WebSocketConnection{
			ID:            uuid.New().String(),
			Conn:          conn,
			Send:          make(chan []byte, 256),
			Manager:       wsManager,
			authenticated: false, // NEW FIELD
		}

		// 3. Start pumps immediately (readPump will handle auth)
		go wsConn.writePump()
		go wsConn.readPump() // This now handles the first auth message
	}
}

// Fixed readPump — more robust error handling + ping/pong
func (c *WebSocketConnection) readPump() {
	defer func() {
		log.Printf("ReadPump closing for connection %s (User: %s)", c.ID, c.UserID)
		c.Manager.Unregister(c)
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(1024 * 1024)
	c.Conn.SetReadDeadline(time.Now().Add(15 * time.Second))

	// Pong handler
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	log.Printf("readPump started (unauthenticated) %s", c.ID)

	// 1. MUST receive auth message within 15 seconds
	_, msg, err := c.Conn.ReadMessage()
	if err != nil {
		log.Printf("Auth failed (no message): %v", err)
		c.unsafeCloseWithMessage("Authentication timeout or error")
		return
	}

	// Reset deadline after first message
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))

	// Parse auth message
	var authMsg struct {
		Type  string `json:"type"`
		Token string `json:"token"`
	}

	if err := json.Unmarshal(msg, &authMsg); err != nil || authMsg.Type != "auth" || authMsg.Token == "" {
		log.Printf("Invalid auth message from %s", c.ID)
		c.unsafeCloseWithMessage("Invalid authentication message")
		return
	}

	// 2. Validate JWT
	jwtSecret := os.Getenv("JWT_SECRET")
	token, err := jwt.Parse(authMsg.Token, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("invalid alg")
		}
		return []byte(jwtSecret), nil
	})

	if err != nil || !token.Valid {
		log.Printf("Invalid JWT from %s: %v", c.ID, err)
		c.unsafeCloseWithMessage("Invalid token")
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || claims["user_id"] == nil {
		c.unsafeCloseWithMessage("Invalid token claims")
		return
	}

	userID := claims["user_id"].(string)

	orgID, _ := resolveOrganizationID(userID)
	orgRole := ""
	if orgID != "" {
		role, ok, err := getUserOrgRole(userID, orgID)
		if err != nil || !ok {
			c.unsafeCloseWithMessage("Access denied")
			return
		}
		orgRole = role
	}

	// AUTH SUCCESS
	c.mu.Lock()
	c.UserID = userID
	c.OrganizationID = orgID
	c.OrgRole = orgRole
	c.AuthToken = authMsg.Token
	c.authenticated = true
	c.mu.Unlock()

	// Register only after auth
	c.Manager.Register(c)

	// Send welcome
	welcome := map[string]any{
		"type":      "connection_success",
		"message":   "Authenticated successfully",
		"user_id":   userID,
		"timestamp": time.Now().Format(time.RFC3339),
	}
	c.Send <- mustMarshal(welcome)

	log.Printf("WebSocket authenticated: %s (User: %s)", c.ID, userID)

	// 3. Normal message loop
	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("Unexpected close %s: %v", c.ID, err)
			} else if !websocket.IsCloseError(err, websocket.CloseNormalClosure) {
				log.Printf("Read error %s: %v", c.ID, err)
			}
			break
		}
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		c.handleMessage(message)
	}
}

// Helper: close with JSON error message
func (c *WebSocketConnection) unsafeCloseWithMessage(msg string) {
	errorMsg := map[string]string{"type": "error", "message": msg}
	if data, err := json.Marshal(errorMsg); err == nil {
		c.Conn.WriteMessage(websocket.TextMessage, data)
	}
	c.Conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
	c.Conn.Close()
}

func (c *WebSocketConnection) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *WebSocketConnection) handleMessage(message []byte) {
	// You can now safely trust c.UserID
	var msg map[string]interface{}
	if err := json.Unmarshal(message, &msg); err != nil {
		return
	}

	switch msg["type"] {
	case "submit_request":
		c.handleSubmitRequest(msg)
	case "get_status":
		c.handleGetStatus(msg)
	case "ping":
		c.Send <- []byte(`{"type":"pong"}`)
	}
}

func (c *WebSocketConnection) handleSubmitRequest(msg map[string]interface{}) {
	if c.OrganizationID != "" && !agentRunRoles[c.OrgRole] {
		errorResp := map[string]interface{}{
			"type":  "request_error",
			"error": "Access denied",
		}
		if respBytes, err := json.Marshal(errorResp); err == nil {
			c.Send <- respBytes
		}
		return
	}

	// Extract request data
	message, _ := msg["message"].(string)
	agents, _ := msg["agents"].([]interface{})
	model, _ := msg["model"].(string)
	chatID, _ := msg["chat_id"].(string)
	requestedOrgID, _ := msg["organization_id"].(string)
	requestedIsOrg, _ := msg["is_org"].(bool)
	imageURLsRaw, _ := msg["image_urls"].([]interface{})
	fileURLsRaw, _ := msg["file_urls"].([]interface{})

	// DEBUG LOGGING
	log.Printf("DEBUG WebSocket raw incoming files: %v", msg["file_urls"])
	log.Printf("DEBUG WebSocket raw incoming images: %v", msg["image_urls"])

	// Convert agents to string slice
	agentSlice := make([]string, len(agents))
	for i, agent := range agents {
		if agentStr, ok := agent.(string); ok {
			agentSlice[i] = agentStr
		}
	}

	// Convert image_urls to string slice
	imageURLSlice := make([]string, len(imageURLsRaw))
	for i, url := range imageURLsRaw {
		if urlStr, ok := url.(string); ok {
			imageURLSlice[i] = urlStr
		}
	}

	// Convert file_urls to string slice
	fileURLSlice := make([]string, len(fileURLsRaw))
	for i, url := range fileURLsRaw {
		if urlStr, ok := url.(string); ok {
			fileURLSlice[i] = urlStr
		}
	}

	// Create agent request
	requestID := uuid.New().String()
	orgID := strings.TrimSpace(requestedOrgID)
	if orgID == "" && requestedIsOrg {
		orgID, _ = resolveOrganizationID(c.UserID)
	}
	if orgID != "" {
		if _, ok, err := getUserOrgRole(c.UserID, orgID); err != nil {
			errorResp := map[string]interface{}{"type": "request_error", "error": "Failed to validate organization access"}
			if respBytes, mErr := json.Marshal(errorResp); mErr == nil {
				c.Send <- respBytes
			}
			return
		} else if !ok {
			errorResp := map[string]interface{}{"type": "request_error", "error": "Organization access denied"}
			if respBytes, mErr := json.Marshal(errorResp); mErr == nil {
				c.Send <- respBytes
			}
			return
		}
	}
	if policyService != nil {
		userUUID, uErr := uuid.Parse(c.UserID)
		if uErr != nil {
			errorResp := map[string]interface{}{"type": "request_error", "error": "Invalid user context"}
			if respBytes, err := json.Marshal(errorResp); err == nil {
				c.Send <- respBytes
			}
			return
		}
		var orgUUID *uuid.UUID
		if orgID != "" {
			if parsedOrg, err := uuid.Parse(orgID); err == nil {
				orgUUID = &parsedOrg
			}
		}
		_, err := policyService.AuthorizeAndMaybeConsume(policy.AuthorizeInput{
			UserID:          userUUID,
			OrganizationID:  orgUUID,
			ActionKey:       "agent.chat",
			Model:           model,
			AgentsCount:     len(agentSlice),
			ReferenceID:     requestID,
			RequireBillable: true,
			EndpointRole:    policy.EndpointRoleRun,
			RequestMeta: map[string]interface{}{
				"source": "websocket",
			},
		})
		if err != nil {
			errorResp := map[string]interface{}{"type": "request_error", "error": err.Error()}
			if respBytes, mErr := json.Marshal(errorResp); mErr == nil {
				c.Send <- respBytes
			}
			return
		}
	}
	agentRequest := &AgentRequest{
		Message:        message,
		Agents:         agentSlice,
		Model:          model,
		IsOrg:          orgID != "",
		UserID:         c.UserID,
		OrganizationID: orgID,
		ChatID:         chatID,
		AuthToken:      c.AuthToken, // Use the stored auth token from WebSocket connection
		RequestID:      requestID,
		Timestamp:      time.Now(),
		ImageURLs:      imageURLSlice,
		FileURLs:       fileURLSlice,
	}

	// Publish to RabbitMQ
	err := publishAgentRequest(agentRequest)
	if err != nil {
		// Send error response via WebSocket
		errorResp := map[string]interface{}{
			"type":    "request_error",
			"error":   "Failed to queue request",
			"message": err.Error(),
		}
		if respBytes, err := json.Marshal(errorResp); err == nil {
			c.Send <- respBytes
		}
		return
	}

	// Send success response via WebSocket
	successResp := map[string]interface{}{
		"type":       "request_submitted",
		"request_id": requestID,
		"status":     "queued",
		"message":    "Agent request queued successfully",
		"timestamp":  time.Now().Format(time.RFC3339),
	}
	if respBytes, err := json.Marshal(successResp); err == nil {
		c.Send <- respBytes
	}
}

func (c *WebSocketConnection) handleGetStatus(msg map[string]interface{}) {
	if c.OrganizationID != "" && !agentViewRoles[c.OrgRole] {
		errorResp := map[string]interface{}{
			"type":  "request_error",
			"error": "Access denied",
		}
		if respBytes, err := json.Marshal(errorResp); err == nil {
			c.Send <- respBytes
		}
		return
	}

	requestID, _ := msg["request_id"].(string)

	// Send status response via WebSocket
	statusResp := map[string]interface{}{
		"type":       "request_status",
		"request_id": requestID,
		"status":     "processing",
		"message":    "Request is being processed",
		"timestamp":  time.Now().Format(time.RFC3339),
	}
	if respBytes, err := json.Marshal(statusResp); err == nil {
		c.Send <- respBytes
	}
}

// WebSocket manager methods
func (m *WebSocketManager) Register(conn *WebSocketConnection) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.connections[conn.ID] = conn
	log.Printf("WebSocket connection registered: %s (User: %s)", conn.ID, conn.UserID)
}

func (m *WebSocketManager) Unregister(conn *WebSocketConnection) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	if _, ok := m.connections[conn.ID]; ok {
		delete(m.connections, conn.ID)
		close(conn.Send)
		log.Printf("WebSocket connection unregistered: %s", conn.ID)
	}
}

func (m *WebSocketManager) BroadcastResponse(response AgentResponse) error {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	sentCount := 0
	// Find the connection for the user who made the request
	for _, conn := range m.connections {
		if conn.UserID == response.UserID {
			// Send response notification
			notification := map[string]interface{}{
				"type":       "ai_response",
				"request_id": response.RequestID,
				"response":   response.Response,
				"status":     response.Status,
				"chat_id":    response.ChatID,
				"timestamp":  response.Timestamp.Format(time.RFC3339),
			}

			respBytes, err := json.Marshal(notification)
			if err != nil {
				log.Printf("Failed to marshal notification for WebSocket %s: %v", conn.ID, err)
				continue
			}

			select {
			case conn.Send <- respBytes:
				log.Printf("Response sent to WebSocket: %s", conn.ID)
				sentCount++
			default:
				log.Printf("Failed to send response to WebSocket: %s (channel full)", conn.ID)
			}
		}
	}

	if sentCount == 0 {
		log.Printf("No WebSocket connections found for user: %s", response.UserID)
	}

	return nil
}

// BroadcastStreamChunk sends a stream chunk to the appropriate user's WebSocket
func (m *WebSocketManager) BroadcastStreamChunk(chunk AgentStreamChunk) error {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	wsMessage := map[string]interface{}{
		"type":        "stream_chunk",
		"request_id":  chunk.RequestID,
		"chat_id":     chunk.ChatID,
		"chunk_index": chunk.ChunkIndex,
		"content":     chunk.Content,
		"agent_name":  chunk.AgentName,
		"is_final":    chunk.IsFinal,
		"timestamp":   chunk.Timestamp.Format(time.RFC3339),
		"chunk_type":  chunk.ChunkType,
		"tool_name":   chunk.ToolName,
		"tool_args":   chunk.ToolArgs,
		"tool_output": chunk.ToolOutput,
	}

	msgBytes, err := json.Marshal(wsMessage)
	if err != nil {
		return fmt.Errorf("failed to marshal stream chunk: %w", err)
	}

	for _, conn := range m.connections {
		if conn.UserID == chunk.UserID {
			select {
			case conn.Send <- msgBytes:
			default:
				log.Printf("Stream chunk send buffer full for user %s", conn.UserID)
			}
		}
	}

	return nil
}

// Initialize RabbitMQ on package import - optional
func init() {
	// RabbitMQ initialization is now handled explicitly during server startup
}

// InitializeRabbitMQ is exported to allow explicit initialization during server startup
func InitializeRabbitMQ() error {
	if rabbitmqConn != nil && !rabbitmqConn.IsClosed() {
		log.Println("ℹ️ RabbitMQ is already initialized")
		return nil
	}
	return initRabbitMQ()
}

// Publish agent request to RabbitMQ
func publishAgentRequest(request *AgentRequest) error {
	// Initialize RabbitMQ on first use or if connection is dead
	if rabbitmqChannel == nil || rabbitmqConn == nil || rabbitmqConn.IsClosed() {
		if err := initRabbitMQ(); err != nil {
			log.Printf("⚠️ Failed to initialize RabbitMQ: %v", err)
			return fmt.Errorf("RabbitMQ not available: %w", err)
		}
	}

	body, err := json.Marshal(request)
	if err != nil {
		return err
	}

	err = rabbitmqChannel.Publish(
		"agent_exchange", // exchange
		"agent_request",  // routing key
		false,            // mandatory
		false,            // immediate
		amqp.Publishing{
			ContentType: "application/json",
			Body:        body,
		},
	)

	if err != nil {
		log.Printf("❌ Failed to publish message to RabbitMQ: %v", err)
		// Attempt reconnection on next use
		rabbitmqChannel = nil
		rabbitmqConn = nil
	}

	return err
}

// PublishAgentRequest publishes an agent request to RabbitMQ.
// Exported for internal schedulers/jobs that need to enqueue agent tasks.
func PublishAgentRequest(request *AgentRequest) error {
	return publishAgentRequest(request)
}

// Get queue information
func getQueueInfo() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !authorizeAgentAction(c, agentAdminRoles, "GET_QUEUE_INFO") {
			return
		}
		// Get user ID from JWT token
		_, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error:   "User not authenticated",
				Message: "Authentication required",
				Code:    http.StatusUnauthorized,
			})
			return
		}

		var queueInfo QueueInfo
		var connection string

		if rabbitmqConn != nil && !rabbitmqConn.IsClosed() {
			connection = "connected"

			// Get request queue info
			reqQueue, err := rabbitmqChannel.QueueDeclare(
				"agent_request_queue", // name
				true,                  // durable
				false,                 // delete when unused
				false,                 // exclusive
				false,                 // no-wait
				nil,                   // arguments
			)
			if err == nil {
				queueInfo.RequestQueue = QueueDetails{
					Name:      "agent_request_queue",
					Messages:  reqQueue.Messages,
					Consumers: reqQueue.Consumers,
					Status:    "active",
				}
			}

			// Get response queue info
			respQueue, err := rabbitmqChannel.QueueDeclare(
				"agent_response_queue", // name
				true,                   // durable
				false,                  // delete when unused
				false,                  // exclusive
				false,                  // no-wait
				nil,                    // arguments
			)
			if err == nil {
				queueInfo.ResponseQueue = QueueDetails{
					Name:      "agent_response_queue",
					Messages:  respQueue.Messages,
					Consumers: respQueue.Consumers,
					Status:    "active",
				}
			}
		} else {
			connection = "disconnected"
			queueInfo.RequestQueue = QueueDetails{
				Name:      "agent_request_queue",
				Messages:  -1,
				Consumers: -1,
				Status:    "inactive",
			}
			queueInfo.ResponseQueue = QueueDetails{
				Name:      "agent_response_queue",
				Messages:  -1,
				Consumers: -1,
				Status:    "inactive",
			}
		}

		queueInfo.Connection = connection
		queueInfo.Timestamp = time.Now().Format(time.RFC3339)

		c.JSON(http.StatusOK, queueInfo)
	}
}

// Get queue size for monitoring
func getQueueSize(queueName string) int {
	if rabbitmqChannel == nil {
		return -1
	}

	queue, err := rabbitmqChannel.QueueDeclare(
		queueName, // name
		true,      // durable
		false,     // delete when unused
		false,     // exclusive
		false,     // no-wait
		nil,       // arguments
	)
	if err != nil {
		return -1
	}

	return queue.Messages
}

// Create agent chat request
// @Summary Create a new agent chat request
// @Description Submit a message to AI agents for processing. The JWT token is automatically extracted from the Authorization header.
// @Tags agents
// @Accept json
// @Produce json
// @Security Bearer
// @Param request body AgentChatRequest true "Agent chat request data"
// @Success 202 {object} AgentChatResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/agents/chat [post]
func createAgentChatRequest() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !authorizeAgentAction(c, agentRunRoles, "AGENT_RUN") {
			return
		}
		var req AgentChatRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:   err.Error(),
				Message: "Invalid request format",
				Code:    http.StatusBadRequest,
			})
			return
		}

		// Get user ID from JWT token
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error:   "User not authenticated",
				Message: "Authentication required",
				Code:    http.StatusUnauthorized,
			})
			return
		}

		// Extract JWT token from Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error:   "Authorization header required",
				Message: "JWT token required in Authorization header",
				Code:    http.StatusUnauthorized,
			})
			return
		}

		// Extract the token part after "Bearer "
		authToken := strings.TrimPrefix(authHeader, "Bearer ")
		if authToken == authHeader {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error:   "Invalid authorization format",
				Message: "Bearer token required",
				Code:    http.StatusUnauthorized,
			})
			return
		}

		// Generate unique request ID
		requestID := uuid.New().String()

		// Create agent request
		orgID := c.Query("organization_id")
		if orgID == "" {
			orgID, _ = resolveOrganizationID(userID.(string))
		}
		if !authorizePlanAction(c, "agent.chat", policy.EndpointRoleRun, true, req.Model, nil, len(req.Agents), requestID, orgID) {
			return
		}
		agentRequest := &AgentRequest{
			Message:        req.Message,
			Agents:         req.Agents,
			Model:          req.Model,
			UserID:         userID.(string),
			OrganizationID: orgID,
			ChatID:         req.ChatID,
			AuthToken:      authToken,
			RequestID:      requestID,
			Timestamp:      time.Now(),
			ImageURLs:      req.ImageURLs,
			FileURLs:       req.FileURLs,
		}

		// Publish to RabbitMQ
		err := publishAgentRequest(agentRequest)
		if err != nil {
			// Log error
			if logger != nil {
				userUUID, _ := uuid.Parse(userID.(string))
				logger.LogAgents(c.Request.Context(), models.LogLevelError, "QUEUE_FAILED",
					"Failed to queue agent request",
					services.WithUserID(userUUID),
					services.WithRequestID(requestID),
					services.WithIPAddress(c.ClientIP()),
					services.WithMetadata(map[string]interface{}{
						"agents_count":    len(req.Agents),
						"model":           req.Model,
						"chat_id":         req.ChatID,
						"organization_id": orgID,
						"error":           err.Error(),
					}))
			}
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error:   "Failed to queue agent request",
				Message: "Internal server error occurred",
				Code:    http.StatusInternalServerError,
			})
			return
		}

		if len(agentRequest.ImageURLs) > 0 {
			log.Printf("📸 Successfully queued %d image(s) to AI engine for RequestID: %s", len(agentRequest.ImageURLs), requestID)
		}

		if len(agentRequest.FileURLs) > 0 {
			log.Printf("📄 Successfully queued %d file(s) to AI engine for RequestID: %s", len(agentRequest.FileURLs), requestID)
		}

		if logger != nil {
			userUUID, _ := uuid.Parse(userID.(string))
			logger.LogAgents(c.Request.Context(), models.LogLevelInfo, "REQUEST_QUEUED",
				"Agent request queued successfully",
				services.WithUserID(userUUID),
				services.WithRequestID(requestID),
				services.WithIPAddress(c.ClientIP()),
				services.WithMetadata(map[string]interface{}{
					"agents_count":    len(req.Agents),
					"model":           req.Model,
					"message_length":  len(req.Message),
					"chat_id":         req.ChatID,
					"organization_id": orgID,
				}))
		}

		c.JSON(http.StatusAccepted, AgentChatResponse{
			RequestID: requestID,
			Status:    "queued",
			Message:   "Agent request queued successfully",
			Timestamp: time.Now(),
		})
	}
}

// Get agent chat status
func getAgentChatStatus() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !authorizeAgentAction(c, agentViewRoles, "GET_CHAT_STATUS") {
			return
		}
		requestID := c.Param("request_id")
		if requestID == "" {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:   "Request ID required",
				Message: "Missing request ID parameter",
				Code:    http.StatusBadRequest,
			})
			return
		}

		// Get user ID from JWT token for authorization
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error:   "User not authenticated",
				Message: "Authentication required",
				Code:    http.StatusUnauthorized,
			})
			return
		}

		// For now, return a simple status
		// Later, you can check the response queue or database
		c.JSON(http.StatusOK, gin.H{
			"request_id": requestID,
			"user_id":    userID,
			"status":     "processing",
			"message":    "Agent request is being processed",
			"timestamp":  time.Now(),
			"note":       "Check response queue for actual results",
		})
	}
}

// Get agent system status
func getAgentSystemStatus() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !authorizeAgentAction(c, agentAdminRoles, "GET_SYSTEM_STATUS") {
			return
		}
		// Get user ID from JWT token
		_, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error:   "User not authenticated",
				Message: "Authentication required",
				Code:    http.StatusUnauthorized,
			})
			return
		}

		// Check RabbitMQ connection status
		var status string
		var message string
		var queueSize int

		if rabbitmqConn != nil && !rabbitmqConn.IsClosed() {
			status = "connected"
			message = "Agent system is operational"
			queueSize = getQueueSize("agent_request_queue")
		} else {
			status = "disconnected"
			message = "Agent system is not available"
			queueSize = -1
		}

		c.JSON(http.StatusOK, AgentSystemStatus{
			Status:    status,
			Message:   message,
			QueueSize: queueSize,
			Timestamp: time.Now().Format(time.RFC3339),
		})
	}
}

// PublishAssetProcessingRequest publishes an asset processing request to RabbitMQ
func PublishAssetProcessingRequest(request *AssetProcessingRequest) error {
	// Initialize RabbitMQ on first use
	if rabbitmqChannel == nil {
		if err := initRabbitMQ(); err != nil {
			log.Printf("⚠️ Failed to initialize RabbitMQ: %v", err)
			return fmt.Errorf("RabbitMQ not available: %w", err)
		}
	}

	body, err := json.Marshal(request)
	if err != nil {
		return fmt.Errorf("failed to marshal asset processing request: %w", err)
	}

	err = rabbitmqChannel.Publish(
		"asset_exchange", // exchange
		"asset_process",  // routing key
		false,            // mandatory
		false,            // immediate
		amqp.Publishing{
			ContentType: "application/json",
			Body:        body,
		},
	)

	if err != nil {
		return fmt.Errorf("failed to publish asset processing request: %w", err)
	}

	log.Printf("✅ Asset processing request published: %s", request.AssetID)
	return nil
}

// Cleanup function (call this when shutting down)
func Cleanup() {
	if rabbitmqChannel != nil {
		rabbitmqChannel.Close()
	}
	if rabbitmqConn != nil {
		rabbitmqConn.Close()
	}
}
