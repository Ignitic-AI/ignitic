import asyncio
import json
import logging
from typing import Dict, Any, List
from datetime import datetime
from uuid import uuid4
from models.chat import Agent, Chat
from services.agents.agents import ainvoke_agents
from services.rabbitmq.rabbitmq_service import rabbitmq_service

logger = logging.getLogger(__name__)

class MessageProcessor:
    def __init__(self):
        pass
    
    def process_agent_request(self, channel, method, properties, body):
        """Process incoming agent request from RabbitMQ (sync wrapper)"""
        try:
            # Run the async processing in the event loop
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(
                self._async_process_agent_request(channel, method, properties, body)
            )
            loop.close()
        except Exception as e:
            logger.error(f"❌ Error in sync wrapper: {e}")
            # Reject the message and requeue on error
            channel.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
    
    async def _async_process_agent_request(self, channel, method, properties, body):
        """Process incoming agent request from RabbitMQ (async)"""
        try:
            # Parse the message
            request_data = json.loads(body.decode('utf-8'))
            logger.info(f"📨 Processing request: {request_data.get('request_id')}")
            
            # Extract request details
            request_id = request_data.get('request_id')
            message = request_data.get('message')
            agents = request_data.get('agents', [])
            model = request_data.get('model', 'gpt-4')
            user_id = request_data.get('user_id')
            
            # Validate required fields
            if not request_id or not message or not user_id:
                raise ValueError("Missing required fields: request_id, message, or user_id")
            
            # Convert agent strings to Agent enum
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
            
            # If no valid agents, use default
            if not agent_enums:
                agent_enums = [Agent.PRODUCT_RESEARCHER]
            
            # Process with AI agents
            response = await self._process_with_agents(
                message=message,
                agents=agent_enums,
                model=model,
                user_id=user_id,
                request_id=request_id
            )
            
            # Send response back to response queue
            await rabbitmq_service.publish_response({
                "request_id": request_id,
                "response": response,
                "status": "completed",
                "user_id": user_id,
                "timestamp": datetime.now().isoformat()
            })
            
            # Acknowledge the message
            channel.basic_ack(delivery_tag=method.delivery_tag)
            logger.info(f"✅ Processed request: {request_id}")
            
        except Exception as e:
            logger.error(f"❌ Error processing request: {e}")
            # Send error response
            try:
                await rabbitmq_service.publish_response({
                    "request_id": request_data.get('request_id', 'unknown'),
                    "response": f"Error processing request: {str(e)}",
                    "status": "error",
                    "error": str(e),
                    "user_id": request_data.get('user_id', 'unknown'),
                    "timestamp": datetime.now().isoformat()
                })
            except Exception as pub_error:
                logger.error(f"❌ Error publishing error response: {pub_error}")
            
            # Reject the message and don't requeue to prevent infinite loops
            channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
    
    async def _process_with_agents(self, message: str, agents: List[Agent], model: str, user_id: str, request_id: str) -> str:
        """Process message with AI agents"""
        try:
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
            
            logger.info(f"🤖 Processing with agents: {[agent.value for agent in agents]}")
            
            # Get response from agents
            agent_response = await ainvoke_agents(
                agents=agents,
                message=message,
                thread_id=thread_id,
                model=model
            )
            
            # Extract the response text from the agent response
            if agent_response and "messages" in agent_response:
                messages = agent_response["messages"]
                if messages:
                    # Get the last message (which should be the agent's response)
                    last_message = messages[-1]
                    if hasattr(last_message, 'content'):
                        return last_message.content
                    elif isinstance(last_message, dict) and 'content' in last_message:
                        return last_message['content']
            
            # Fallback if no proper response found
            return "Agent processed the request but no response was generated."
            
        except Exception as e:
            logger.error(f"❌ Error in agent processing: {e}")
            import traceback
            traceback.print_exc()
            raise Exception(f"Agent processing failed: {str(e)}")

# Global instance
message_processor = MessageProcessor()
