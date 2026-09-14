import importlib
import pkgutil
from typing import Dict, List, Any


_TOOLS_BY_AGENT_CACHE: Dict[str, List[Any]] | None = None


def _iter_tool_modules(base_package: str):
    pkg = importlib.import_module(base_package)
    for modinfo in pkgutil.walk_packages(pkg.__path__, prefix=pkg.__name__ + "."):
        yield modinfo.name


def load_tools_by_agent(force_reload: bool = False) -> Dict[str, List[Any]]:
    global _TOOLS_BY_AGENT_CACHE
    if _TOOLS_BY_AGENT_CACHE is not None and not force_reload:
        return _TOOLS_BY_AGENT_CACHE

    tools_by_agent: Dict[str, List[Any]] = {}
    base_package = "services.agents.tools"

    for module_name in _iter_tool_modules(base_package):
        try:
            mod = importlib.import_module(module_name)
        except Exception:
            continue

        # Preferred: module defines AGENT_TOOLS = {agent_name: [tool, ...]}
        agent_tools = getattr(mod, "AGENT_TOOLS", None)
        if isinstance(agent_tools, dict):
            for agent, tools in agent_tools.items():
                if not isinstance(tools, list):
                    continue
                tools_by_agent.setdefault(agent, []).extend(tools)
            continue

        # Fallback: module defines TARGET_AGENTS and exposes BaseTool-like attributes
        target_agents = getattr(mod, "TARGET_AGENTS", None)
        if isinstance(target_agents, list) and target_agents:
            candidate_tools: List[Any] = []
            for attr_name in dir(mod):
                if attr_name.startswith("__"):
                    continue
                attr = getattr(mod, attr_name)
                # Heuristic: LangChain tools usually have .name and .description
                if hasattr(attr, "name") and hasattr(attr, "description"):
                    candidate_tools.append(attr)
            if candidate_tools:
                for agent in target_agents:
                    tools_by_agent.setdefault(agent, []).extend(candidate_tools)

    _TOOLS_BY_AGENT_CACHE = tools_by_agent
    return tools_by_agent


def get_tools_for_agent(agent_name: str, force_reload: bool = False) -> List[Any]:
    return load_tools_by_agent(force_reload=force_reload).get(agent_name, [])


