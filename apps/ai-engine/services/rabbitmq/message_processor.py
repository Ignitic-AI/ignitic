"""
Fixed Message Processor - Addresses event loop and authentication issues
"""

import json
import logging
from typing import List, Optional
from datetime import datetime
from uuid import uuid4
from langchain.load.dump import dumps
from fastapi.security import HTTPAuthorizationCredentials
from core.auth import AuthProvider
from models.chat import Agent, Chat
from services.agents.agents import ainvoke_agents
from services.agents.chat_service import ChatService

logger = logging.getLogger(__name__)


class MessageProcessor:
    def __init__(self):
        pass

    async def process_agent_request(self, message):
        """Process incoming agent request from RabbitMQ (fully async)"""
        request_data = {}
        try:
            # Parse the message body
            request_data: dict = json.loads(message.body.decode("utf-8"))

            logger.info(f"📨 Processing request: {request_data.get('request_id')}")

            # Extract request details with validation
            request_id = request_data.get("request_id")
            message_content = request_data.get("message")
            agents = request_data.get("agents", []) or []
            model = request_data.get("model", "gpt-4")
            user_id = request_data.get("user_id")
            chat_id = request_data.get("chat_id")
            auth_token = request_data.get("auth_token")

            # Validate required fields
            if not request_id:
                raise ValueError("Missing required field: request_id")
            if not message_content:
                raise ValueError("Missing required field: message")
            if not user_id:
                raise ValueError("Missing required field: user_id")
            if not auth_token:
                raise ValueError("Missing required field: auth_token")

            # Create AuthProvider with validation
            try:
                auth = AuthProvider(
                    auth=HTTPAuthorizationCredentials(
                        scheme="Bearer", credentials=auth_token
                    )
                )
                # Validate the token by trying to get user info
                _ = auth.get_user()
            except Exception as e:
                raise ValueError(f"Invalid authentication token: {str(e)}")

            # Convert agent strings to Agent enum with validation
            agent_enums = []
            for agent_name in agents:
                try:
                    if agent_name == "product_researcher":
                        agent_enums.append(Agent.PRODUCT_RESEARCHER)
                    elif agent_name == "marketer":
                        agent_enums.append(Agent.MARKETER)
                    else:
                        logger.warning(f"Unknown agent: {agent_name}, skipping")
                except Exception as e:
                    logger.warning(f"Error converting agent {agent_name}: {e}")

            # Process with AI agents
            chat_id, response = await self._process_with_agents(
                message=message_content,
                agents=agent_enums if agent_enums != [] else list(Agent),
                model=model,
                user_id=user_id,
                request_id=request_id,
                chat_id=chat_id,
                auth=auth,
            )

            # Send response back to response queue
            response_data = {
                "request_id": request_id,
                "response": response,
                "status": "completed",
                "user_id": user_id,
                "chat_id": chat_id,
                "timestamp": datetime.now().isoformat(),
            }

            # Import here to avoid circular imports
            from services.rabbitmq.rabbitmq_service import rabbitmq_service

            await rabbitmq_service.publish_response(response_data)

            # Acknowledge the message
            await message.ack()
            logger.info(f"✅ Processed request: {request_id}")

        except ValueError as ve:
            logger.error(f"❌ Validation error: {ve}")
            await self._send_error_response(request_data, str(ve), "validation_error")
            await message.reject(requeue=False)  # Don't requeue validation errors

        except Exception as e:
            logger.error(f"❌ Error processing request: {e}")
            import traceback

            traceback.print_exc()

            await self._send_error_response(request_data, str(e), "processing_error")
            await message.reject(requeue=False)  # Requeue for potential retry

    async def _send_error_response(
        self, request_data: dict, error_msg: str, error_type: str
    ):
        """Send error response to response queue"""
        try:
            error_response = {
                "request_id": request_data.get("request_id", "unknown"),
                "response": f"Error processing request: {error_msg}",
                "status": "error",
                "error_type": error_type,
                "error": error_msg,
                "user_id": request_data.get("user_id", "unknown"),
                "timestamp": datetime.now().isoformat(),
            }

            from services.rabbitmq.rabbitmq_service import rabbitmq_service

            await rabbitmq_service.publish_response(error_response)

        except Exception as pub_error:
            logger.error(f"❌ Error publishing error response: {pub_error}")

    async def _process_with_agents(
        self,
        message: str,
        agents: List[Agent],
        model: str,
        user_id: str,
        request_id: str,
        auth: AuthProvider,
        chat_id: Optional[str],
    ) -> tuple[str, str]:
        """Process message with AI agents"""
        try:
            chat = None
            if chat_id:
                try:
                    chat = await ChatService(auth=auth).get_chat(chat_id)
                except Exception as e:
                    logger.warning(f"Could not retrieve chat {chat_id}: {e}")

            if not chat:
                # Create a unique thread_id for this request
                thread_id = f"rabbitmq_{request_id}_{uuid4()}"

                # Create chat session for tracking
                chat = Chat(
                    u_id=user_id,
                    org_id=None,  # No org for RabbitMQ requests
                    thread_id=thread_id,
                    agents=agents,
                    name=f"RabbitMQ Chat - {request_id[:8]}",
                )
                await chat.insert()

            logger.info(
                f"🤖 Processing with agents: {[agent.value for agent in agents]}"
            )

            # Get response from agents
            agent_response = await ainvoke_agents(
                agents=agents,
                message=message,
                thread_id=chat.thread_id,
                model=model,
                auth=auth,
            )

            # Extract the response text properly
            if agent_response and "messages" in agent_response:
                return (str(chat.id), dumps(agent_response["messages"]))

            # Fallback if no proper response found
            return (str(chat.id), "No response from agents")

        except Exception as e:
            logger.error(f"❌ Error in agent processing: {e}")
            import traceback

            traceback.print_exc()
            raise Exception(f"Agent processing failed: {str(e)}")


# Global instance
message_processor = MessageProcessor()
