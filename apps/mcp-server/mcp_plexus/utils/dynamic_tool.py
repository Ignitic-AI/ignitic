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
    # Extract parameters from input schema
    properties = webhook_tool.inputs or {}

    # Generate function signature
    params = []
    param_types = {}

    for param_name, param_def in properties.items():
        param_type = json_type_to_python_type(param_def.type)
        param_types[param_name] = param_type

        # Add parameter with default value if not required
        if param_def.required:
            params.append(f"{param_name}: {param_type.__name__}")
        else:
            default_val = get_default_value_for_type(param_type)
            params.append(f"{param_name}: {param_type.__name__} = {repr(default_val)}")

    # Determine return type from output schema
    return_type = Any

    # Create function signature
    func_signature = f"def {webhook_tool.name}({', '.join(params)}) -> {return_type.__name__}:"

    func_body = generate_mock_implementation(
        tool_name=webhook_tool.name,
        param_types=param_types,
        return_type=return_type,
        output_schema=output_schema,
    )

    # Combine signature and body
    full_function_code = f"{func_signature}\n{func_body}"

    logger.debug(f"Generated function code for '{tool_name}':\n{full_function_code}")

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
        return local_namespace[tool_name]
    except Exception as e:
        logger.error(f"Failed to create function '{tool_name}': {e}")
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


def generate_mock_implementation(
    tool_name: str,
    param_types: Dict[str, type],
    return_type: type,
    output_schema: Dict[str, Any],
) -> str:
    """Generate a mock implementation for the function."""

    # Create parameter documentation
    param_docs = []
    for param_name, param_type in param_types.items():
        param_docs.append(
            f"        {param_name} ({param_type.__name__}): Input parameter"
        )

    # Generate return value based on output schema
    if return_type is str:
        return_value = f'"Mock result from {tool_name}"'
    elif return_type is int:
        return_value = "42"
    elif return_type is float:
        return_value = "3.14"
    elif return_type is bool:
        return_value = "True"
    elif return_type is list:
        return_value = "[]"
    elif return_type is dict:
        # Try to create a dict based on output schema properties
        if "properties" in output_schema:
            mock_dict = {}
            for prop_name, prop_def in output_schema["properties"].items():
                prop_type = prop_def.get("type", "string")
                if prop_type == "string":
                    mock_dict[prop_name] = f"mock_{prop_name}"
                elif prop_type == "integer":
                    mock_dict[prop_name] = 0
                elif prop_type == "boolean":
                    mock_dict[prop_name] = True
                else:
                    mock_dict[prop_name] = f"mock_{prop_name}"
            return_value = repr(mock_dict)
        else:
            return_value = f'{{"result": "Mock result from {tool_name}"}}'
    else:
        return_value = f'"Mock result from {tool_name}"'

    # Generate function body
    body = f'''    """
{tool_name} - Dynamically generated tool

Args:
{chr(10).join(param_docs) if param_docs else "        No parameters"}

Returns:
    {return_type.__name__}: Mock implementation result
"""
# This is a mock implementation generated from schemas
# Replace this with your actual implementation logic
return {return_value}'''

    return body
