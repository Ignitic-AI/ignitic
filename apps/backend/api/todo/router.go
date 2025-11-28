package todo

import (
	"backend/database"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(rg *gin.RouterGroup, db *database.DB) {
	service, err := NewTodoService(db)
	if err != nil {
		panic("Failed to create todo service: " + err.Error())
	}

	todos := rg.Group("/todos")
	{
		todos.GET("", service.ListTodos)
		todos.GET("/:id", service.GetTodo)
		todos.POST("", service.CreateTodo)
		todos.PUT("/:id", service.UpdateTodo)
		todos.DELETE("/:id", service.DeleteTodo)
		todos.PATCH("/:id/complete", service.MarkAsDone)
		todos.POST("/:id/schedule-agent", service.ScheduleAgentTask)
		todos.GET("/status/:status", service.GetTodosByStatus)
		todos.GET("/priority/:priority", service.GetTodosByPriority)
	}
}




