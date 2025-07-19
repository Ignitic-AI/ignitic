import logging
from typing import Any, Callable, Dict, List, Optional
from services.models import WebhookTool

logger = logging.getLogger(__name__)


def create_webhook_invoker(
    webhook_tool: WebhookTool,
) -> Callable[..., Any]:
    """
    Create a Python function from input/output JSON schemas.

    Args:
        webhook_tool (WebhookTool): The WebhookTool instance containing input/output schemas.

    Returns:
        A callable function created from the schemas
    """
    input_model = generate_pydantic_model(
        f"{webhook_tool.name}InputModel", webhook_tool.inputs or {}
    )

    output_model = generate_pydantic_model(
        f"{webhook_tool.name}OutputModel", webhook_tool.outputs or {}
    )

    # Create function signature
    func_signature = f"def {webhook_tool.name}(input: {webhook_tool.name}InputModel) -> {webhook_tool.name}OutputModel:"

    func_body = '''
    """
    Description: {webhook_tool.description}

    Args:
        input ({webhook_tool.name}InputModel): The input data for the webhook. {input_model}

    Returns:
        {webhook_tool.name}OutputModel: The output data from the webhook. {output_model}
    """
    import requests
    try:
        response = requests.post(
            url={webhook_tool.webhook_url},
            json=input.model_dump(),
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        return {k: v for k, v in response.json().items() if k in output.model_fields}
    except requests.RequestException as e:
        logger.error(f"Error invoking webhook {webhook_tool.name}: {e}")
        raise ToolError(f"Failed to invoke webhook: {e}")
'''

    # Combine signature and body
    full_function_code = f"{input_model}\n{output_model}\n{func_signature}\n{func_body}"

    logger.debug(f"Generated function code for '{webhook_tool.name}':\n{full_function_code}")

    # Execute the function code to create the actual function
    local_namespace = {}
    global_namespace = {
        "Any": Any,
        "Dict": Dict,
        "List": List,
        "Optional": Optional,
        "str": str,
        "int": int,
        "float": float,
        "bool": bool,
        "list": list,
        "dict": dict,
    }

    try:
        exec(full_function_code, global_namespace, local_namespace)
        return local_namespace[webhook_tool.name]
    except Exception as e:
        logger.error(f"Failed to create function '{webhook_tool.name}': {e}")
        raise ValueError(f"Failed to create function from schemas: {e}")


def json_type_to_python_type(json_type: str) -> type:
    """Convert JSON schema type to Python type."""
    # Handle complex types like "List[str]", "Dict[str, Any]", etc.
    if "[" in json_type and "]" in json_type:
        try:
            # Use eval with a safe namespace to parse complex types
            safe_namespace = {
                "List": List,
                "Dict": Dict,
                "Optional": Optional,
                "Any": Any,
                "str": str,
                "int": int,
                "float": float,
                "bool": bool,
                "list": list,
                "dict": dict,
            }
            return eval(json_type, {"__builtins__": {}}, safe_namespace)
        except Exception:
            # Fall back to str if parsing fails
            return str

    # Handle simple types
    type_mapping = {
        "List": List,
        "Dict": Dict,
        "Optional": Optional,
        "Any": Any,
        "str": str,
        "int": int,
        "float": float,
        "bool": bool,
        "list": list,
        "dict": dict,
        "null": type(None),
    }
    return type_mapping.get(json_type.lower(), str)


def get_default_value_for_type(param_type: type) -> Any:
    """Get default value for a parameter type."""
    defaults = {
        str: "",
        int: 0,
        float: 0.0,
        bool: False,
        list: [],
        dict: {},
        type(None): None,
    }
    return defaults.get(param_type, None)


def generate_pydantic_model(name: str, properties: Dict[str, Any]) -> str:
    """
    Generate a Pydantic model class from input properties.

    Args:
        name (str): The name of the model.
        properties (Dict[str, Any]): The properties of the model.

    Returns:
        str: The generated Pydantic model class code.
    """
    fields = []
    for prop_name, prop_def in properties.items():
        fields.append(f"{prop_name}: Annotated[{prop_def.type}, Field(description='{prop_def.description}', required={prop_def.required}, default={repr(prop_def.default)})]")

    fields_str = "\n    ".join(fields)
    return f"class {name}(BaseModel):\n    {fields_str}\n"
