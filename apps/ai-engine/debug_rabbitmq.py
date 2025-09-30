"""
RabbitMQ Debug Utilities - Helper functions to debug message publishing
"""

import asyncio
import json
from services.rabbitmq.rabbitmq_service import rabbitmq_service


async def debug_rabbitmq_status():
    """Debug function to check RabbitMQ status"""
    print("🔍 === RabbitMQ Debug Status Check ===")

    try:
        # Check connection
        if not rabbitmq_service.connection or rabbitmq_service.connection.is_closed:
            print("📡 Connecting to RabbitMQ...")
            await rabbitmq_service.connect()

        # Run debug status
        await rabbitmq_service.debug_queue_status()

        # Test publishing a simple message
        print("\n🧪 Testing message publishing...")
        await rabbitmq_service.test_publish_simple_message()

        print("\n✅ Debug check completed")

    except Exception as e:
        print(f"❌ Debug check failed: {e}")
        import traceback

        traceback.print_exc()


async def publish_test_message():
    """Publish a test message to verify queue functionality"""
    test_data = {
        "request_id": "manual-test-123",
        "response": "This is a manual test message",
        "status": "test",
        "user_id": "debug-user",
        "timestamp": "2025-09-30T10:00:00Z",
    }

    try:
        print("🧪 Publishing manual test message...")
        await rabbitmq_service.publish_response(test_data)
        print("✅ Manual test message published")
    except Exception as e:
        print(f"❌ Failed to publish test message: {e}")


if __name__ == "__main__":
    print("Starting RabbitMQ Debug Tool...")
    asyncio.run(debug_rabbitmq_status())
