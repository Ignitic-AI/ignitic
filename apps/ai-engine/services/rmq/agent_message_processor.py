"""
Agent RMQ Message Processor - Handles agent chat requests
"""

import json
import logging
from typing import List, Optional
from datetime import datetime
from uuid import uuid4
from langchain.load.dump import dumps
from fastapi.security import HTTPAuthorizationCredentials
from core.auth import AuthProvider
from models.chat import PrebuiltAgents, Chat
from services.agents.agents_service import AgentService, ainvoke_agents
from services.agents.chat_service import ChatService
from .base_message_processor import BaseRMQMessageProcessor

from loguru import logger


class AgentRMQMessageProcessor(BaseRMQMessageProcessor):
    """Message processor for agent chat requests"""

    def __init__(self):
        super().__init__("AgentRMQMessageProcessor")
        # component-specific logger
        self._logger = logger.bind(component="AgentRMQMessageProcessor")

    async def process_message(self, message) -> None:
        """Process incoming agent request from RabbitMQ"""
        request_data = {}
        try:
            # Parse the message body
            # parse message body
            raw_body = message.body
            try:
                request_data: dict = json.loads(raw_body.decode("utf-8"))
            except Exception:
                self._logger.exception("Failed to decode JSON from message body")
                raise

            self._logger.info(
                "📨 Received agent request", request_id=request_data.get("request_id")
            )

            # Extract request details with validation
            request_id = request_data.get("request_id")
            message_content = request_data.get("message")
            agents = request_data.get("agents", []) or []
            model = request_data.get("model", "gpt-4")
            user_id = request_data.get("user_id")
            chat_id = request_data.get("chat_id")
            is_org = request_data.get("is_org", False)
            auth_token = request_data.get("auth_token")

            # Validate required fields
            missing = []
            if not request_id:
                missing.append("request_id")
            if not message_content:
                missing.append("message")
            if not user_id:
                missing.append("user_id")
            if not auth_token or auth_token.strip() == "":
                missing.append("auth_token")
            if missing:
                err = f"Missing required field(s): {', '.join(missing)}"
                self._logger.warning(err, request_id=request_id, user_id=user_id)
                raise ValueError(err)

            # Create AuthProvider with validation
            try:
                self._logger.debug("Validating auth token", user_id=user_id)
                auth = AuthProvider(
                    auth=HTTPAuthorizationCredentials(
                        scheme="Bearer", credentials=auth_token # type: ignore
                    )
                )
                # Validate the token by trying to get user info
                _user = auth.get_user()
                self._logger.debug(
                    "Auth token validated", auth_user=str(getattr(_user, "id", None))
                )
            except Exception as e:
                self._logger.warning("Invalid authentication token", error=str(e))
                raise ValueError(f"Invalid authentication token: {str(e)}")

            # Process with AI agents
            chat_id, response = await self._process_with_agents(
                message=message_content, # type: ignore
                agents=agents,
                model=model,
                user_id=user_id, # type: ignore
                request_id=request_id, # type: ignore
                chat_id=chat_id,
                is_org=is_org,
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
            self._logger.debug(
                "Prepared response payload", request_id=request_id, chat_id=chat_id
            )

            # Get the RMQ service to publish response
            await self._publish_response(response_data)

            # Acknowledge the message
            await message.ack()
            self._logger.info("✅ Processed agent request", request_id=request_id)

        except ValueError as ve:
            self._logger.error(
                "❌ Validation error", error=str(ve), request_data=request_data
            )
            await self._send_error_response(request_data, str(ve), "validation_error")
            await message.reject(requeue=False)  # Don't requeue validation errors

        except Exception as e:
            self._logger.exception("❌ Error processing agent request")
            await self._send_error_response(request_data, str(e), "processing_error")
            await message.reject(requeue=False)  # Don't requeue to avoid infinite loops

    async def _publish_response(self, response_data: dict):
        """Publish response using the agent RMQ service"""
        try:
            # Import here to avoid circular imports
            from .rmq_service_factory import rmq_service_factory

            agent_service = rmq_service_factory.get_agent_service()
            await agent_service.publish_response(response_data)
            self._logger.debug(
                "Published response to RMQ", request_id=response_data.get("request_id")
            )
        except Exception as e:
            self._logger.exception("❌ Failed to publish agent response")
            raise

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
            self._logger.debug(
                "Sending error response",
                request_id=error_response.get("request_id"),
                error_type=error_type,
            )
            await self._publish_response(error_response)

        except Exception as pub_error:
            self._logger.exception("❌ Error publishing error response")

    async def _process_with_agents(
        self,
        message: str,
        agents: List[str],
        model: str,
        user_id: str,
        request_id: str,
        is_org: bool,
        auth: AuthProvider,
        chat_id: Optional[str],
    ) -> tuple[str, str]:
        """Process message with AI agents"""
        try:
            chat = None
            if chat_id:
                try:
                    chat = await ChatService(auth=auth).get_chat(chat_id)
                    self._logger.debug("Loaded existing chat", chat_id=chat_id)
                except Exception as e:
                    self._logger.warning(
                        "Could not retrieve chat", chat_id=chat_id, error=str(e)
                    )

            if not chat:
                # Create a unique thread_id for this request
                thread_id = f"rabbitmq_{request_id}_{uuid4()}"

                # Create chat session for tracking
                chat = Chat(
                    u_id=user_id,
                    org_id=auth.get_user().org_id if is_org else None,
                    thread_id=thread_id,
                    agents=agents,
                    name=f"RabbitMQ Chat - {request_id[:8]}",
                )
                await chat.insert()
                self._logger.info(
                    "Created new chat session",
                    chat_id=str(chat.id),
                    thread_id=thread_id,
                )

            self._logger.info(
                "🤖 Processing with agents", agents=agents, request_id=request_id
            )

            agent_service = AgentService(auth=auth)

            if is_org:
                chat_agents = await agent_service.get_org_agents(identifiers=agents)
            else:
                chat_agents = await agent_service.get_user_agents(identifiers=agents)

            self._logger.debug(
                "Fetched agent configs",
                agent_count=len(chat_agents) if chat_agents else 0,
            )

            # Get response from agents
            agent_response = await ainvoke_agents(
                agents=chat_agents,
                message=message,
                thread_id=chat.thread_id,
                model=model,
                auth=auth,
            )

            # Extract the response text properly
            if agent_response and "messages" in agent_response:
                msgs = agent_response["messages"]
                self._logger.debug(
                    "Received agent response messages", message_count=len(msgs)
                )
                return (str(chat.id), dumps(msgs))

            # Fallback if no proper response found
            self._logger.warning("No response from agents", request_id=request_id)
            return (str(chat.id), "No response from agents")

        except Exception as e:
            self._logger.exception("❌ Error in agent processing")
            raise Exception(f"Agent processing failed: {str(e)}")


# Global instance
agent_rmq_message_processor = AgentRMQMessageProcessor()
