# RMQ Services Architecture - Dependency Injection Pattern

This document describes the scalable RabbitMQ architecture with dependency injection implemented in the AI Engine.

## Architecture Overview

### 1. **Dependency Injection Pattern**
- Message processors are injected into RMQ services as dependencies
- Clean separation between message processing logic and transport layer
- Easy testing and mocking of dependencies

### 2. **Single Connection, Multiple Channels**
- One robust connection shared across all services
- Each feature/service gets its own dedicated channel
- Optimal resource usage and connection management

### 3. **Service Structure**

```
services/rabbitmq/
├── __init__.py                             # Package initialization
├── base_rmq_service.py                     # Base service with dependency injection
├── base_message_processor.py               # Abstract base for message processors
├── agent_rmq_service.py                    # Agent chat functionality
├── agent_message_processor.py              # Agent message processing logic
├── asset_notification_rmq_service.py       # Asset modification notifications
├── asset_notification_message_processor.py # Asset notification processing logic
├── rmq_task_manager.py                     # Coordinates all services
├── rmq_service_factory.py                  # Factory for dependency injection
└── README.md                               # This documentation
```

## Architecture Components

### BaseRMQService
- Manages shared connection and common functionality
- Accepts message processor via dependency injection
- Clean lifecycle methods and error handling

### BaseRMQMessageProcessor
- Abstract base class for all message processors
- Provides common error handling and logging
- Callable interface for RMQ consumer callbacks

### Message Processors
- **AgentRMQMessageProcessor**: Handles agent chat requests
- **AssetNotificationRMQMessageProcessor**: Handles asset notifications
- Each processor implements specific business logic

### RMQ Services
- **AgentRMQService**: Agent-specific exchanges, queues, and bindings
- **AssetNotificationRMQService**: Asset notification infrastructure
- Each service is injected with its corresponding message processor

### RMQServiceFactory
- Creates services with their injected dependencies
- Manages singleton instances
- Registers services with task manager

### RMQTaskManager
- Coordinates multiple RMQ services
- Manages async tasks for each service
- Provides centralized start/stop control and health monitoring

## Dependency Injection Benefits

1. **Testability**: Easy to mock message processors for unit tests
2. **Separation of Concerns**: Transport logic separate from business logic
3. **Flexibility**: Can swap processors without changing services
4. **Maintainability**: Clear dependencies and responsibilities
5. **Extensibility**: Easy to add new features with new processor/service pairs

## Usage Examples

### Adding a New Feature

1. **Create the message processor:**
```python
class MyFeatureRMQMessageProcessor(BaseRMQMessageProcessor):
    async def process_message(self, message) -> None:
        # Implement your business logic
        pass
```

2. **Create the RMQ service:**
```python
class MyFeatureRMQService(BaseRMQService):
    def __init__(self, message_processor: BaseRMQMessageProcessor):
        super().__init__(message_processor)
    
    async def setup_infrastructure(self):
        # Setup exchanges, queues, bindings
        pass
```

3. **Update the factory:**
```python
# In rmq_service_factory.py
def create_my_feature_service(self) -> MyFeatureRMQService:
    processor = MyFeatureRMQMessageProcessor()
    return MyFeatureRMQService(processor)
```

4. **Register with task manager:**
```python
# In factory's register_all_services method
my_service = self.create_my_feature_service()
rmq_task_manager.register_service("my_feature", my_service)
```

### Publishing Messages

```python
# Get service from factory
service = rmq_service_factory.get_agent_service()
await service.publish_response(response_data)

# Publish asset notification
asset_service = rmq_service_factory.get_asset_notification_service()
await asset_service.publish_asset_notification("created", asset_data)
```

### Health Monitoring

```bash
# Check all services
GET /health

# Check RMQ specifically  
GET /health/rmq
```

## Message Processing Flow

1. **Message arrives** at RMQ queue
2. **Service consumer** receives message
3. **Injected processor** is called via `__call__` method
4. **Processor** executes `process_message` with business logic
5. **Error handling** managed by base processor class
6. **Message acknowledgment** handled appropriately

## Testing Strategy

```python
# Mock the processor for testing
mock_processor = Mock(spec=BaseRMQMessageProcessor)
service = AgentRMQService(mock_processor)

# Test service logic without processor complexity
await service.setup_infrastructure()

# Verify processor was called
mock_processor.assert_called_with(test_message)
```

## Best Practices

1. **Keep processors focused**: One processor per feature/message type
2. **Use dependency injection**: Always inject processors into services
3. **Handle errors gracefully**: Override `handle_processing_error` if needed
4. **Log appropriately**: Use the built-in logging in base classes
5. **Test independently**: Mock dependencies for isolated testing
6. **Monitor health**: Use provided health check endpoints

## Environment Variables

```bash
RABBITMQ_URL=amqp://guest:guest@localhost:5672/
```

## Migration Benefits

- **Cleaner Architecture**: Dependencies are explicit and manageable
- **Better Testing**: Easy to mock and test components in isolation
- **Easier Maintenance**: Clear separation between transport and business logic
- **Flexible Scaling**: Add new features by creating new processor/service pairs