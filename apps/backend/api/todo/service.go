package todo

import (
	"backend/database"
	"backend/models"
	"backend/services"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TodoService struct {
	db     *database.DB
	logger *services.DatabaseLogger
}

// NewTodoService creates a new todo service instance
func NewTodoService(db *database.DB) (*TodoService, error) {
	return &TodoService{
		db:     db,
		logger: services.NewDatabaseLogger(db),
	}, nil
}

var (
	todoViewRoles   = map[string]bool{"admin": true, "member": true, "viewer": true}
	todoEditRoles   = map[string]bool{"admin": true, "member": true}
	todoDeleteRoles = map[string]bool{"admin": true}
)

func (s *TodoService) getUserOrgRole(userID uuid.UUID, orgID uuid.UUID) (string, bool, error) {
	var userOrg models.UserOrganization
	if err := s.db.Where("user_id = ? AND organization_id = ? AND is_active = true", userID, orgID).First(&userOrg).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", false, nil
		}
		return "", false, err
	}
	return userOrg.Role, true, nil
}

func (s *TodoService) authorizeOrgRole(c *gin.Context, userID uuid.UUID, orgID uuid.UUID, allowed map[string]bool) bool {
	role, ok, err := s.getUserOrgRole(userID, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to authorize request"})
		return false
	}
	if !ok || !allowed[role] {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return false
	}
	return true
}

// ListTodos godoc
// @Summary List all todos for the authenticated user
// @Description Retrieves all todos belonging to the authenticated user, optionally filtered by status or priority
// @Tags todos
// @Security Bearer
// @Produce json
// @Param status query string false "Filter by status (todo, in_progress, done)"
// @Param priority query string false "Filter by priority (high, medium, low)"
// @Param organization_id query string false "Filter by organization ID"
// @Success 200 {object} map[string]interface{} "List of todos"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 500 {object} map[string]string "Server error"
// @Router /todos [get]
func (s *TodoService) ListTodos(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var todos []models.Todo
	query := s.db.Model(&models.Todo{})

	// Filter by status
	if status := c.Query("status"); status != "" {
		if models.TodoStatus(status).IsValid() {
			query = query.Where("status = ?", status)
		}
	}

	// Filter by priority
	if priority := c.Query("priority"); priority != "" {
		if models.TodoPriority(priority).IsValid() {
			query = query.Where("priority = ?", priority)
		}
	}

	// Filter by organization
	if orgID := c.Query("organization_id"); orgID != "" {
		orgUUID, err := uuid.Parse(orgID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization ID"})
			return
		}
		if !s.authorizeOrgRole(c, userUUID, orgUUID, todoViewRoles) {
			return
		}
		query = query.Where("organization_id = ?", orgUUID)
	} else {
		query = query.Where("user_id = ?", userUUID)
	}

	if err := query.Order("created_at DESC").Find(&todos).Error; err != nil {
		s.logger.Log(context.Background(), models.LogLevelError, models.SectionSystem,
			fmt.Sprintf("Failed to list todos: %v", err),
			services.WithUserID(userUUID),
			services.WithEndpoint(c.FullPath()),
			services.WithMethod(c.Request.Method),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve todos"})
		return
	}

	// Convert to response format
	response := make([]models.TodoResponse, len(todos))
	for i, todo := range todos {
		response[i] = s.todoToResponse(&todo)
	}

	c.JSON(http.StatusOK, gin.H{
		"count": len(response),
		"todos": response,
	})
}

// GetTodo godoc
// @Summary Get a specific todo by ID
// @Description Retrieves a single todo by its ID
// @Tags todos
// @Security Bearer
// @Produce json
// @Param id path string true "Todo ID"
// @Success 200 {object} models.TodoResponse "Todo details"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 404 {object} map[string]string "Todo not found"
// @Failure 500 {object} map[string]string "Server error"
// @Router /todos/{id} [get]
func (s *TodoService) GetTodo(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	todoID := c.Param("id")
	todoUUID, err := uuid.Parse(todoID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid todo ID"})
		return
	}

	var todo models.Todo
	if err := s.db.Where("id = ?", todoUUID).First(&todo).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Todo not found"})
		return
	}

	if todo.OrganizationID != nil {
		if !s.authorizeOrgRole(c, userUUID, *todo.OrganizationID, todoViewRoles) {
			return
		}
	} else if todo.UserID != userUUID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	c.JSON(http.StatusOK, s.todoToResponse(&todo))
}

// CreateTodo godoc
// @Summary Create a new todo
// @Description Creates a new todo item for the authenticated user
// @Tags todos
// @Security Bearer
// @Accept json
// @Produce json
// @Param body body models.TodoCreateRequest true "Todo data"
// @Success 201 {object} models.TodoResponse "Created todo"
// @Failure 400 {object} map[string]string "Invalid request"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 500 {object} map[string]string "Server error"
// @Router /todos [post]
func (s *TodoService) CreateTodo(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req models.TodoCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.OrganizationID != nil {
		if !s.authorizeOrgRole(c, userUUID, *req.OrganizationID, todoEditRoles) {
			return
		}
	}

	// Set default status if not provided
	status := models.StatusTodo
	if req.Status != "" {
		status = req.Status
	}

	// Set default progress if not provided
	progress := 0
	if req.Progress > 0 {
		progress = req.Progress
	}

	todo := models.Todo{
		UserID:         userUUID,
		OrganizationID: req.OrganizationID,
		Title:          req.Title,
		Description:    req.Description,
		Priority:       req.Priority,
		Status:         status,
		Progress:       progress,
		MonetaryValue:  req.MonetaryValue,
		Icon:           req.Icon,
		ScheduledAt:    req.ScheduledAt,
		DueDate:        req.DueDate,
		CreatedBy:      userUUID,
	}

	// Handle tags and metadata
	if req.Tags != nil {
		tagsJSON, _ := json.Marshal(req.Tags)
		todo.Tags = req.Tags
		_ = tagsJSON // Store in DB via GORM hooks if needed
	}

	if req.Metadata != nil {
		metadataJSON, _ := json.Marshal(req.Metadata)
		todo.Metadata = req.Metadata
		_ = metadataJSON
	}

	if err := s.db.Create(&todo).Error; err != nil {
		s.logger.Log(context.Background(), models.LogLevelError, models.SectionSystem,
			fmt.Sprintf("Failed to create todo: %v", err),
			services.WithUserID(userUUID),
			services.WithEndpoint(c.FullPath()),
			services.WithMethod(c.Request.Method),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create todo"})
		return
	}

	s.logger.Log(context.Background(), models.LogLevelInfo, models.SectionSystem,
		"Todo created successfully",
		services.WithUserID(userUUID),
		services.WithEndpoint(c.FullPath()),
		services.WithMethod(c.Request.Method),
		services.WithMetadata(map[string]interface{}{
			"todo_id": todo.ID.String(),
			"title":   todo.Title,
		}),
	)

	c.JSON(http.StatusCreated, s.todoToResponse(&todo))
}

// UpdateTodo godoc
// @Summary Update a todo
// @Description Updates an existing todo item
// @Tags todos
// @Security Bearer
// @Accept json
// @Produce json
// @Param id path string true "Todo ID"
// @Param body body models.TodoUpdateRequest true "Updated todo data"
// @Success 200 {object} models.TodoResponse "Updated todo"
// @Failure 400 {object} map[string]string "Invalid request"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 404 {object} map[string]string "Todo not found"
// @Failure 500 {object} map[string]string "Server error"
// @Router /todos/{id} [put]
func (s *TodoService) UpdateTodo(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	todoID := c.Param("id")
	todoUUID, err := uuid.Parse(todoID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid todo ID"})
		return
	}

	var todo models.Todo
	if err := s.db.Where("id = ?", todoUUID).First(&todo).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Todo not found"})
		return
	}

	if todo.OrganizationID != nil {
		if !s.authorizeOrgRole(c, userUUID, *todo.OrganizationID, todoEditRoles) {
			return
		}
	} else if todo.UserID != userUUID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var req models.TodoUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update fields if provided
	if req.Title != nil {
		todo.Title = *req.Title
	}
	if req.Description != nil {
		todo.Description = *req.Description
	}
	if req.Priority != nil {
		todo.Priority = *req.Priority
	}
	if req.Status != nil {
		todo.Status = *req.Status
	}
	if req.Progress != nil {
		todo.Progress = *req.Progress
	}
	if req.MonetaryValue != nil {
		todo.MonetaryValue = req.MonetaryValue
	}
	if req.Icon != nil {
		todo.Icon = *req.Icon
	}
	if req.DueDate != nil {
		todo.DueDate = req.DueDate
	}
	if req.Tags != nil {
		todo.Tags = req.Tags
	}
	if req.Metadata != nil {
		todo.Metadata = req.Metadata
	}

	if err := s.db.Save(&todo).Error; err != nil {
		s.logger.Log(context.Background(), models.LogLevelError, models.SectionSystem,
			fmt.Sprintf("Failed to update todo: %v", err),
			services.WithUserID(userUUID),
			services.WithEndpoint(c.FullPath()),
			services.WithMethod(c.Request.Method),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update todo"})
		return
	}

	c.JSON(http.StatusOK, s.todoToResponse(&todo))
}

// DeleteTodo godoc
// @Summary Delete a todo
// @Description Deletes a todo item (soft delete)
// @Tags todos
// @Security Bearer
// @Produce json
// @Param id path string true "Todo ID"
// @Success 200 {object} map[string]string "Success message"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 404 {object} map[string]string "Todo not found"
// @Failure 500 {object} map[string]string "Server error"
// @Router /todos/{id} [delete]
func (s *TodoService) DeleteTodo(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	todoID := c.Param("id")
	todoUUID, err := uuid.Parse(todoID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid todo ID"})
		return
	}

	var todo models.Todo
	if err := s.db.Where("id = ?", todoUUID).First(&todo).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Todo not found"})
		return
	}

	if todo.OrganizationID != nil {
		if !s.authorizeOrgRole(c, userUUID, *todo.OrganizationID, todoDeleteRoles) {
			return
		}
	} else if todo.UserID != userUUID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	if err := s.db.Delete(&todo).Error; err != nil {
		s.logger.Log(context.Background(), models.LogLevelError, models.SectionSystem,
			fmt.Sprintf("Failed to delete todo: %v", err),
			services.WithUserID(userUUID),
			services.WithEndpoint(c.FullPath()),
			services.WithMethod(c.Request.Method),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete todo"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Todo deleted successfully"})
}

// MarkAsDone godoc
// @Summary Mark a todo as done
// @Description Marks a todo as completed (status = done, progress = 100)
// @Tags todos
// @Security Bearer
// @Produce json
// @Param id path string true "Todo ID"
// @Success 200 {object} models.TodoResponse "Updated todo"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 404 {object} map[string]string "Todo not found"
// @Failure 500 {object} map[string]string "Server error"
// @Router /todos/{id}/complete [patch]
func (s *TodoService) MarkAsDone(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	todoID := c.Param("id")
	todoUUID, err := uuid.Parse(todoID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid todo ID"})
		return
	}

	var todo models.Todo
	if err := s.db.Where("id = ?", todoUUID).First(&todo).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Todo not found"})
		return
	}

	if todo.OrganizationID != nil {
		if !s.authorizeOrgRole(c, userUUID, *todo.OrganizationID, todoEditRoles) {
			return
		}
	} else if todo.UserID != userUUID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	todo.Status = models.StatusDone
	todo.Progress = 100

	if err := s.db.Save(&todo).Error; err != nil {
		s.logger.Log(context.Background(), models.LogLevelError, models.SectionSystem,
			fmt.Sprintf("Failed to mark todo as done: %v", err),
			services.WithUserID(userUUID),
			services.WithEndpoint(c.FullPath()),
			services.WithMethod(c.Request.Method),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update todo"})
		return
	}

	c.JSON(http.StatusOK, s.todoToResponse(&todo))
}

// ScheduleAgentTask godoc
// @Summary Schedule an agent task for a todo
// @Description Associates an agent task with a todo and schedules it
// @Tags todos
// @Security Bearer
// @Accept json
// @Produce json
// @Param id path string true "Todo ID"
// @Param body body models.TodoScheduleAgentRequest true "Agent task configuration"
// @Success 200 {object} models.TodoResponse "Updated todo with agent task"
// @Failure 400 {object} map[string]string "Invalid request"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 404 {object} map[string]string "Todo not found"
// @Failure 500 {object} map[string]string "Server error"
// @Router /todos/{id}/schedule-agent [post]
func (s *TodoService) ScheduleAgentTask(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	todoID := c.Param("id")
	todoUUID, err := uuid.Parse(todoID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid todo ID"})
		return
	}

	var todo models.Todo
	if err := s.db.Where("id = ?", todoUUID).First(&todo).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Todo not found"})
		return
	}

	if todo.OrganizationID != nil {
		if !s.authorizeOrgRole(c, userUUID, *todo.OrganizationID, todoEditRoles) {
			return
		}
	} else if todo.UserID != userUUID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var req models.TodoScheduleAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update todo with agent task information
	todo.IsAgentTask = true
	todo.AgentName = &req.AgentName
	if req.ScheduledAt != nil {
		todo.ScheduledAt = req.ScheduledAt
	}

	// Store agent config as JSON
	if req.AgentConfig != nil {
		configJSON, err := json.Marshal(req.AgentConfig)
		if err == nil {
			configStr := string(configJSON)
			todo.AgentConfig = &configStr
		}
	}

	if err := s.db.Save(&todo).Error; err != nil {
		s.logger.Log(context.Background(), models.LogLevelError, models.SectionSystem,
			fmt.Sprintf("Failed to schedule agent task: %v", err),
			services.WithUserID(userUUID),
			services.WithEndpoint(c.FullPath()),
			services.WithMethod(c.Request.Method),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to schedule agent task"})
		return
	}

	s.logger.Log(context.Background(), models.LogLevelInfo, models.SectionAgents,
		"Agent task scheduled for todo",
		services.WithUserID(userUUID),
		services.WithEndpoint(c.FullPath()),
		services.WithMethod(c.Request.Method),
		services.WithMetadata(map[string]interface{}{
			"todo_id":    todo.ID.String(),
			"agent_name": req.AgentName,
		}),
	)

	c.JSON(http.StatusOK, s.todoToResponse(&todo))
}

// GetTodosByStatus godoc
// @Summary Get todos by status
// @Description Retrieves all todos filtered by status
// @Tags todos
// @Security Bearer
// @Produce json
// @Param status path string true "Status (todo, in_progress, done)"
// @Success 200 {object} map[string]interface{} "List of todos"
// @Failure 400 {object} map[string]string "Invalid status"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Router /todos/status/{status} [get]
func (s *TodoService) GetTodosByStatus(c *gin.Context) {
	status := c.Param("status")
	if !models.TodoStatus(status).IsValid() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status"})
		return
	}

	c.Set("status", status)
	s.ListTodos(c)
}

// GetTodosByPriority godoc
// @Summary Get todos by priority
// @Description Retrieves all todos filtered by priority
// @Tags todos
// @Security Bearer
// @Produce json
// @Param priority path string true "Priority (high, medium, low)"
// @Success 200 {object} map[string]interface{} "List of todos"
// @Failure 400 {object} map[string]string "Invalid priority"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Router /todos/priority/{priority} [get]
func (s *TodoService) GetTodosByPriority(c *gin.Context) {
	priority := c.Param("priority")
	if !models.TodoPriority(priority).IsValid() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid priority"})
		return
	}

	c.Set("priority", priority)
	s.ListTodos(c)
}

// todoToResponse converts a Todo model to TodoResponse
func (s *TodoService) todoToResponse(todo *models.Todo) models.TodoResponse {
	return models.TodoResponse{
		ID:             todo.ID,
		UserID:         todo.UserID,
		OrganizationID: todo.OrganizationID,
		Title:          todo.Title,
		Description:    todo.Description,
		Priority:       todo.Priority,
		Status:         todo.Status,
		Progress:       todo.Progress,
		MonetaryValue:  todo.MonetaryValue,
		Icon:           todo.Icon,
		IsAgentTask:    todo.IsAgentTask,
		AgentName:      todo.AgentName,
		AgentTaskID:    todo.AgentTaskID,
		ScheduledAt:    todo.ScheduledAt,
		DueDate:        todo.DueDate,
		Tags:           todo.Tags,
		Metadata:       todo.Metadata,
		CreatedBy:      todo.CreatedBy,
		CreatedAt:      todo.CreatedAt,
		UpdatedAt:      todo.UpdatedAt,
	}
}
