from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
import os
from typing import Optional

from pydantic import SecretStr

load_dotenv()


OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_DEFAULT_MODEL = "z-ai/glm-4.5-air:free"
SUMMARIZATION_DEFAULT_MODEL = "openai/gpt-4o-mini"


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
        },
    )


def get_summarization_llm(temperature: float = 0.1) -> ChatOpenAI:
    """Return a cheap, fast LLM for summarization tasks.

    Reads SUMMARIZATION_MODEL from the environment; falls back to
    ``openai/gpt-4o-mini`` when not set.
    """
    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY not set in environment variables")

    model = os.getenv("SUMMARIZATION_MODEL", SUMMARIZATION_DEFAULT_MODEL)
    return ChatOpenAI(
        model=model,
        api_key=SecretStr(OPENROUTER_API_KEY),
        base_url="https://openrouter.ai/api/v1",
        temperature=temperature,
        extra_body={
            "include_usage": True,
        },
    )


INTENT_CLASSIFIER_MODEL = "openai/gpt-4o-mini"


def get_intent_classifier_llm(temperature: float = 0.0) -> ChatOpenAI:
    """Return a fast, cheap LLM for binary intent classification.

    Used by the router_node's Intent Interceptor to decide whether to
    teleport the user back to the previously-active sub-agent or reset
    to the super_agent for a fresh routing decision.
    """
    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY not set in environment variables")

    model = os.getenv("INTENT_CLASSIFIER_MODEL", INTENT_CLASSIFIER_MODEL)
    return ChatOpenAI(
        model=model,
        api_key=SecretStr(OPENROUTER_API_KEY),
        base_url="https://openrouter.ai/api/v1",
        temperature=temperature,
        extra_body={
            "include_usage": True,
        },
    )
