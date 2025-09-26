import asyncio
import json
import logging
import os
from typing import Dict, Any, Optional, Callable
import pika
from pika.adapters.asyncio_connection import AsyncioConnection
from pika.exchange_type import ExchangeType
from pika.spec import BasicProperties
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)

class RabbitMQService:
    def __init__(self):
        self.connection: Optional[AsyncioConnection] = None
        self.channel = None
        self.request_queue = "agent_request_queue"
        self.response_queue = "agent_response_queue"
        self.exchange = "agent_exchange"
        self.is_consuming = False
        
        # RabbitMQ connection parameters
        self.rabbitmq_url = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
        
    async def connect(self) -> bool:
        """Connect to RabbitMQ"""
        try:
            parameters = pika.URLParameters(self.rabbitmq_url)
            
            # Create connection using blocking connection for simplicity
            connection = pika.BlockingConnection(parameters)
            self.channel = connection.channel()
            
            # Declare exchange
            self.channel.exchange_declare(
                exchange=self.exchange,
                exchange_type=ExchangeType.direct,
                durable=True
            )
            
            # Declare queues
            self.channel.queue_declare(queue=self.request_queue, durable=True)
            self.channel.queue_declare(queue=self.response_queue, durable=True)
            
            # Bind queues to exchange
            self.channel.queue_bind(
                exchange=self.exchange,
                queue=self.request_queue,
                routing_key="request"
            )
            self.channel.queue_bind(
                exchange=self.exchange,
                queue=self.response_queue,
                routing_key="response"
            )
            
            logger.info("✅ RabbitMQ connected successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ RabbitMQ connection failed: {e}")
            return False
    
    async def start_consuming(self, process_callback: Callable):
        """Start consuming from request queue"""
        try:
            if not self.channel:
                await self.connect()
            
            if not self.channel:
                logger.error("❌ Cannot start consuming: No channel available")
                return
            
            # Set up consumer
            self.channel.basic_consume(
                queue=self.request_queue,
                on_message_callback=process_callback,
                auto_ack=False
            )
            
            logger.info(f"🔄 Started consuming from {self.request_queue}")
            self.is_consuming = True
            
            # Start consuming in a loop
            while self.is_consuming:
                try:
                    self.channel.connection.process_data_events(time_limit=1)
                    await asyncio.sleep(0.1)  # Small delay to prevent busy waiting
                except Exception as e:
                    logger.error(f"❌ Error in consuming loop: {e}")
                    await asyncio.sleep(1)  # Wait before retrying
            
        except Exception as e:
            logger.error(f"❌ Error consuming messages: {e}")
    
    async def publish_response(self, response_data: Dict[str, Any]):
        """Publish response to response queue"""
        try:
            if not self.channel:
                await self.connect()
                
            message = json.dumps(response_data)

            if not self.channel:
                await self.connect()

            if not self.channel:
                logger.error("❌ Cannot publish response: No channel available")
                return
            
            self.channel.basic_publish(
                exchange=self.exchange,
                routing_key="response",
                body=message,
                properties=BasicProperties(
                    delivery_mode=2,  # Make message persistent
                    message_id=str(uuid.uuid4()),
                    timestamp=int(datetime.now().timestamp())
                )
            )
            
            logger.info(f"📤 Published response for request: {response_data.get('request_id')}")
            
        except Exception as e:
            logger.error(f"❌ Error publishing response: {e}")
    
    def stop_consuming(self):
        """Stop consuming messages"""
        self.is_consuming = False
        logger.info("🛑 Stopping RabbitMQ consumer")
    
    async def close(self):
        """Close RabbitMQ connection"""
        try:
            self.stop_consuming()
            if self.channel and self.channel.connection and not self.channel.connection.is_closed:
                self.channel.connection.close()
                logger.info("🔌 RabbitMQ connection closed")
        except Exception as e:
            logger.error(f"❌ Error closing RabbitMQ connection: {e}")

# Global instance
rabbitmq_service = RabbitMQService()
