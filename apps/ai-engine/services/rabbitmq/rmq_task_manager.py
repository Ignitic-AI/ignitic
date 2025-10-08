"""
RMQ Task Manager - Coordinates multiple RabbitMQ services with dependency injection
"""

import asyncio
import logging
from typing import Dict
from .base_rmq_service import BaseRMQService

logger = logging.getLogger(__name__)


class RMQTaskManager:
    """Manages multiple RabbitMQ services and their async tasks with dependency injection"""

    def __init__(self):
        self.services: Dict[str, BaseRMQService] = {}
        self.tasks: Dict[str, asyncio.Task] = {}
        self.is_running = False

    def register_service(self, name: str, service: BaseRMQService):
        """Register a RabbitMQ service with its injected dependencies"""
        self.services[name] = service
        logger.info(
            f"📝 Registered RMQ service: {name} with processor: {service.message_processor.processor_name}"
        )

    async def start_service_consumer(self, name: str):
        """Start consuming for a specific service using its injected processor"""
        try:
            if name not in self.services:
                raise ValueError(f"Service {name} not registered")

            service = self.services[name]

            # Setup infrastructure
            await service.setup_infrastructure()

            # Start consuming using the service's injected processor
            await service.start_consuming()

            logger.info(f"✅ Started consumer for service: {name}")

        except Exception as e:
            logger.error(f"❌ Failed to start consumer for {name}: {e}")
            raise

    async def start_all_services(self):
        """Start all registered services"""
        try:
            self.is_running = True

            for service_name in self.services.keys():
                # Create task for each service
                task = asyncio.create_task(
                    self.start_service_consumer(service_name),
                    name=f"rmq_{service_name}",
                )
                self.tasks[service_name] = task
                logger.info(f"🚀 Created task for service: {service_name}")

            logger.info(f"✅ Started {len(self.tasks)} RMQ service tasks")

        except Exception as e:
            logger.error(f"❌ Error starting RMQ services: {e}")
            raise

    async def stop_all_services(self):
        """Stop all RabbitMQ services and tasks"""
        try:
            self.is_running = False

            # Stop all consuming
            for name, service in self.services.items():
                try:
                    await service.stop_consuming()
                    logger.info(f"🛑 Stopped consuming for service: {name}")
                except Exception as e:
                    logger.error(f"❌ Error stopping service {name}: {e}")

            # Cancel all tasks
            for name, task in self.tasks.items():
                if not task.done():
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        logger.info(f"🛑 Cancelled task for service: {name}")
                    except Exception as e:
                        logger.error(f"❌ Error cancelling task {name}: {e}")

            # Close all channels
            for name, service in self.services.items():
                try:
                    await service.close_channel()
                    logger.info(f"🔌 Closed channel for service: {name}")
                except Exception as e:
                    logger.error(f"❌ Error closing channel {name}: {e}")

            # Close shared connection
            await BaseRMQService.close_shared_connection()

            self.tasks.clear()
            logger.info("✅ All RMQ services stopped")

        except Exception as e:
            logger.error(f"❌ Error stopping RMQ services: {e}")

    def get_service_status(self) -> Dict[str, Dict]:
        """Get status of all services"""
        status = {}
        for name, service in self.services.items():
            task = self.tasks.get(name)
            status[name] = {
                "is_consuming": service.is_consuming,
                "task_running": task is not None and not task.done() if task else False,
                "consumer_count": len(service.consumer_tags),
                "channel_open": service.channel is not None
                and not service.channel.is_closed
                if service.channel
                else False,
                "processor": service.message_processor.processor_name,
            }
        return status


# Global task manager instance
rmq_task_manager = RMQTaskManager()
