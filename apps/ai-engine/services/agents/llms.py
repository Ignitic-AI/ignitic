from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
import os
from typing import Optional

from pydantic import SecretStr

load_dotenv()


OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_DEFAULT_MODEL ="z-ai/glm-4.5-air:free"



def get_llm(
    model: Optional[str] = None,
    temperature: float = 0.1,
    max_tokens: int = 4096,
):
    """Return a ChatOpenAI client configured for OpenRouter, using the given model.

    If model is None, falls back to  free default.
    """

    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY not set in environment variables")
    

    selected_model = model or OPENROUTER_DEFAULT_MODEL
    return ChatOpenAI(
        model=selected_model,
        api_key=SecretStr(OPENROUTER_API_KEY),
        base_url="https://openrouter.ai/api/v1",
        temperature=temperature,
        # max_tokens=max_tokens,
        extra_body={
            "include_usage": True,
        }
    )




