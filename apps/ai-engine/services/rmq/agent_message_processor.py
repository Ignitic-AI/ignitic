"""
Agent RMQ Message Processor - Handles agent chat requests
"""

import json
from typing import List, Optional
from datetime import datetime
from langchain.load.dump import dumps
from fastapi.security import HTTPAuthorizationCredentials
from core.auth import AuthProvider
from services.agents.agents_service import AgentService, ainvoke_agents
from services.agents.agents_service import astream_agents
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
            image_urls = request_data.get("image_urls")

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
                        scheme="Bearer",
                        credentials=auth_token,  # type: ignore
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

            # Always use streaming for all requests
            chat_id = await self._process_with_streaming(
                message=message_content,  # type: ignore
                agents=agents,
                model=model,
                user_id=user_id,  # type: ignore
                request_id=request_id,  # type: ignore
                chat_id=chat_id,
                is_org=is_org,
                auth=auth,
                image_urls=image_urls,
            )

            # Acknowledge the message
            await message.ack()
            self._logger.info(
                "✅ Processed agent request with streaming",
                request_id=request_id,
            )

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
            self._logger.exception(f"❌ Failed to publish agent response, {e}")
            raise

    async def _publish_stream_chunk(self, chunk_data: dict):
        """Publish a streaming chunk using the agent RMQ service"""
        try:
            from .rmq_service_factory import rmq_service_factory

            agent_service = rmq_service_factory.get_agent_service()
            await agent_service.publish_stream_chunk(chunk_data)
        except Exception as e:
            self._logger.exception(f"❌ Failed to publish stream chunk, {e}")
            raise

    async def _send_error_response(
        self, request_data: dict, error_msg: str, error_type: str
    ):
        """Send error response to response queue"""
        try:
            error_chunk = {
                "request_id": request_data.get("request_id", "unknown"),
                "chunk_index": 0,
                "content": f"Error: {error_msg}",
                "is_final": True,
                "agent_name": "System",
                "user_id": request_data.get("user_id", "unknown"),
                "chat_id": request_data.get("chat_id", "unknown"),
                "timestamp": datetime.now().isoformat(),
                "error_type": error_type,
            }
            self._logger.debug(
                "Sending error response to stream",
                request_id=error_chunk.get("request_id"),
                error_type=error_type,
            )
            await self._publish_stream_chunk(error_chunk)

        except Exception as e:
            self._logger.exception(f"❌ Error publishing error response, {e}")

    async def _process_with_streaming(
        self,
        message: str,
        agents: List[str],
        model: str,
        user_id: str,
        request_id: str,
        is_org: bool,
        auth: AuthProvider,
        chat_id: Optional[str],
        image_urls: Optional[List[str]] = None,
    ) -> str:
        """Process message with AI agents using streaming"""
        try:
            chat = await ChatService(auth=auth).resolve_chat(
                message=message,
                agents=agents,
                chat_id=chat_id,
                is_org=is_org,
                request_id=request_id,
            )
            self._logger.info(
                "Resolved chat for streaming",
                chat_id=str(chat.id),
                thread_id=chat.thread_id,
            )

            self._logger.info(
                "🌊 Processing with streaming agents",
                agents=agents,
                request_id=request_id,
            )

            agent_service = AgentService(auth=auth)

            if is_org:
                chat_agents = await agent_service.get_org_agents(identifiers=agents)
            else:
                chat_agents = await agent_service.get_user_agents(identifiers=agents)

            self._logger.debug(
                "Fetched agent configs for streaming",
                agent_count=len(chat_agents) if chat_agents else 0,
            )

            # Stream response chunks
            async for chunk in astream_agents(
                agents=chat_agents,
                message=message,
                thread_id=chat.thread_id,
                chat_id=str(chat.id),
                model=model,
                auth=auth,
                image_urls=image_urls,
            ):
                # Build chunk data with metadata
                chunk_data = {
                    "request_id": request_id,
                    "chunk_index": chunk["chunk_index"],
                    "content": chunk["content"],
                    "is_final": chunk["is_final"],
                    "agent_name": chunk.get("agent_name", "Assistant"),
                    "user_id": user_id,
                    "chat_id": str(chat.id),
                    "timestamp": datetime.now().isoformat(),
                }

                # Publish each chunk to the stream queue
                await self._publish_stream_chunk(chunk_data)

            self._logger.info("✅ Completed streaming response", request_id=request_id)
            return str(chat.id)

        except Exception as e:
            self._logger.exception("❌ Error in streaming agent processing")
            # Send error as final chunk
            error_chunk = {
                "request_id": request_id,
                "chunk_index": 0,
                "content": f"Error: {str(e)}",
                "is_final": True,
                "agent_name": "System",
                "user_id": user_id,
                "chat_id": chat_id or "unknown",
                "timestamp": datetime.now().isoformat(),
            }
            await self._publish_stream_chunk(error_chunk)
            raise Exception(f"Streaming agent processing failed: {str(e)}")

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
        image_urls: Optional[List[str]] = None,
    ) -> tuple[str, str]:
        """Process message with AI agents"""
        try:
            chat = await ChatService(auth=auth).resolve_chat(
                message=message,
                agents=agents,
                chat_id=chat_id,
                is_org=is_org,
                request_id=request_id,
            )
            self._logger.info(
                "Resolved chat",
                chat_id=str(chat.id),
                thread_id=chat.thread_id,
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
                chat_id=str(chat.id),
                model=model,
                auth=auth,
                image_urls=image_urls,
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
