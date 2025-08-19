from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
import os

load_dotenv()


OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")



llm = ChatOpenAI(
    model="deepseek/deepseek-chat-v3-0324:free",
    api_key=OPENROUTER_API_KEY,
    base_url="https://openrouter.ai/api/v1",
    temperature=0.1,
    max_tokens=4096,
)

