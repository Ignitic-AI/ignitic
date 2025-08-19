from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
import os
from typing import Optional

load_dotenv()


OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_DEFAULT_MODEL ="deepseek/deepseek-chat-v3-0324:free"



def get_llm(
    model: Optional[str] = None,
    temperature: float = 0.1,
    max_tokens: int = 4096,
):
    """Return a ChatOpenAI client configured for OpenRouter, using the given model.

    If model is None, falls back to  free default.
    """
    selected_model = model or OPENROUTER_DEFAULT_MODEL
    return ChatOpenAI(
        model=selected_model,
        api_key=OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1",
        temperature=temperature,
        max_tokens=max_tokens,
    )


llm = get_llm()

