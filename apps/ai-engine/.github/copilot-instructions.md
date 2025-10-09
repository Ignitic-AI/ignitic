# Copilot Instructions for AI Engine Development

## Code Quality Guidelines

### 🏗️ Architecture Principles
- **Reusable Components**: Write code that can be easily reused across different parts of the application
- **Modular Design**: Break down functionality into small, focused modules with clear responsibilities
- **Single Responsibility**: Each class/function should have one clear purpose
- **Dependency Injection**: Use dependency injection patterns for better testability and flexibility

### 📦 Code Organization
- **Service Layer Pattern**: Follow the established service patterns (e.g., `AssetService`, `N8NWorkflowService`)
- **Model Separation**: Use Pydantic models for data validation and Beanie documents for MongoDB operations
- **Error Handling**: Implement comprehensive error handling with appropriate HTTP status codes
- **Logging**: Use structured logging with clear, descriptive messages and emoji indicators

### 🔄 Existing Patterns to Follow
- **RMQ Architecture**: Use the established RabbitMQ dependency injection pattern with `BaseRMQService` and `BaseRMQMessageProcessor`
- **Authentication**: Leverage `AuthProvider` for user context and backend communication
- **Backend Integration**: Use `BackendClient` for all API communications
- **Async Operations**: Ensure all I/O operations are properly async

## Task Management

### 🦐 Shrimp Task Manager Usage
When working on complex features or multi-step implementations:

1. **Use Task Planning**:
   ```
   Use mcp_shrimp-task-m_plan_task for complex feature development
   ```

2. **Break Down Complex Work**:
   ```
   Use mcp_shrimp-task-m_split_tasks to divide large tasks into manageable subtasks
   ```

3. **Task Execution**:
   ```
   Use mcp_shrimp-task-m_execute_task to get step-by-step guidance
   ```

4. **Verification**:
   ```
   Use mcp_shrimp-task-m_verify_task to ensure tasks meet requirements
   ```

### 📋 When to Use Shrimp Task Manager
- **New Feature Implementation**: Asset notification service, document processors, etc.
- **Complex Integrations**: Multi-service coordination, RMQ setup, vector store operations
- **Architecture Changes**: Refactoring, dependency updates, structural modifications
- **Cross-Module Dependencies**: When changes affect multiple services or components

## Development Workflow

### 🚀 Implementation Steps
1. **Analyze Requirements**: Understand the full scope before coding
2. **Plan Architecture**: Use task manager for complex features
3. **Follow Patterns**: Leverage existing service and model patterns
4. **Write Tests**: Ensure functionality works correctly
5. **Document Changes**: Update docstrings and comments

### 🔍 Code Review Checklist
- [ ] Follows established architectural patterns
- [ ] Uses dependency injection where appropriate
- [ ] Has proper error handling and logging
- [ ] Is modular and reusable
- [ ] Includes appropriate type hints
- [ ] Has clear, descriptive function/class names
- [ ] Follows existing naming conventions

## Specific Project Guidelines

### 🗄️ Asset Management System
- Use `Asset` models for all asset operations
- Leverage `AssetService` for backend communication
- Follow the established vector store patterns for document processing

### 🐰 RabbitMQ Integration
- Extend `BaseRMQService` for new RMQ services
- Implement `BaseRMQMessageProcessor` for message handling
- Use `RMQTaskManager` for service coordination

### 📊 Vector Store Operations
- Use existing `MongoDBStore` for vector operations
- Implement proper namespace management (user_id/org_id)
- Follow async patterns for all vector operations

### 🔐 Authentication & Authorization
- Always use `AuthProvider` for user context
- Implement proper access control at the service layer
- Use `BackendClient` for authenticated API calls

## Example Implementation Pattern

```python
# 1. Service with dependency injection
class NewFeatureService:
    def __init__(self, auth: AuthProvider):
        self._auth = auth
        self._backend_client = BackendClient(auth)
    
    async def process_feature(self, data: Model) -> Result:
        # Implement with proper error handling
        pass

# 2. RMQ Service following patterns
class NewFeatureRMQService(BaseRMQService):
    def __init__(self, message_processor: BaseRMQMessageProcessor):
        super().__init__(message_processor)
    
    async def setup_infrastructure(self):
        # Implement RMQ setup
        pass

# 3. Use task manager for complex features
# mcp_shrimp-task-m_plan_task for feature planning
# mcp_shrimp-task-m_split_tasks for implementation breakdown
```

## Remember
- **Consistency**: Follow existing patterns and conventions
- **Quality**: Prioritize maintainable, testable code
- **Documentation**: Keep code self-documenting with clear names and docstrings
- **Task Management**: Use shrimp task manager for complex multi-step work
- **Testing**: Verify functionality works as expected

This ensures the codebase remains maintainable, scalable, and follows established architectural patterns.