"""
Simple RabbitMQ Consumer for Testing - Consumes messages from agent_response_queue
"""

import asyncio
import json
import aio_pika
import os
from dotenv import load_dotenv

load_dotenv()


async def consume_responses():
    """Simple consumer to test if messages are being published"""

    rabbitmq_url = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")

    try:
        # Connect to RabbitMQ
        connection = await aio_pika.connect_robust(rabbitmq_url)
        channel = await connection.channel()

        # Declare the response queue
        response_queue = await channel.declare_queue(
            "agent_response_queue", durable=True
        )

        print(
            f"📡 Connected to RabbitMQ. Waiting for messages from 'agent_response_queue'..."
        )
        print("🛑 Press Ctrl+C to stop")

        async def on_message(message):
            async with message.process():
                try:
                    # Parse message
                    body = json.loads(message.body.decode())

                    print(f"\n📨 Received message:")
                    print(f"   Request ID: {body.get('request_id')}")
                    print(f"   Status: {body.get('status')}")
                    print(f"   User ID: {body.get('user_id')}")
                    print(f"   Timestamp: {body.get('timestamp')}")
                    print(f"   Response: {body.get('response', '')[:100]}...")
                    print(f"   Message ID: {message.message_id}")
                    print(f"   Delivery Tag: {message.delivery_tag}")

                except Exception as e:
                    print(f"❌ Error processing message: {e}")
                    print(f"   Raw body: {message.body.decode()[:200]}...")

        # Start consuming
        await response_queue.consume(on_message)

        # Keep running
        await asyncio.Future()  # Run forever

    except KeyboardInterrupt:
        print("\n🛑 Consumer stopped by user")
    except Exception as e:
        print(f"❌ Consumer error: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(consume_responses())
