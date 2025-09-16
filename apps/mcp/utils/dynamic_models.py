from typing import Any, List, Dict
from pydantic import create_model, Field
import requests

from models.automations.workflow_template import WorkflowInput, WorkflowOutput


def register_dynamic_model(schema: Dict[str, WorkflowInput | WorkflowOutput], model_name: str = "DynamicModel"):
    def resolve_type(type_str: str):
        return eval(type_str)

    fields = {}
    for name, info in schema.items():
        py_type = resolve_type(info.type)
        if isinstance(info, WorkflowInput) and info.required:
            fields[name] = (
                py_type,
                Field(..., description=info.description),
            )
        else:
            fields[name] = (
                py_type,
                Field(None, description=info.description),
            )

    model = create_model(model_name, **fields)

    # ⚡ make it global
    globals()[model_name] = model

    return model



