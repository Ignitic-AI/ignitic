"""
Test script to resolve agents with hierarchy and display the graph structure.

Usage:
    python scripts/test_agent_hierarchy.py

Outputs:
    - Prints the Mermaid graph definition to the console.
    - Saves the graph as a PNG image to `examples/agent_hierarchy_graph.png`.
    - If running inside a Jupyter/IPython environment, displays inline.
"""

import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


async def main():
    from fastapi.security import HTTPAuthorizationCredentials

    from core.auth import AuthProvider
    from core.db import init_db
    from services.agents.agent_service import AgentService
    from services.agents.agent_resolver import AgentResolver
    from services.agents.checkpointers import init_mongo_checkpointer
    from services.agents.llms import get_llm
    from services.agents.memory_stores import init_mongo_memory_store

    # ── Initialise infrastructure ────────────────────────────────────────
    await init_db()
    await init_mongo_checkpointer()
    await init_mongo_memory_store()

    # ── Auth (use the same dev token as other test scripts) ──────────────
    auth = AuthProvider(
        auth=HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials="REDACTED",
        )
    )

    # ── Fetch all agents for the user ────────────────────────────────────
    agent_service = AgentService(auth=auth)
    agents = await agent_service.get_user_agents()

    print(f"\n📋 Loaded {len(agents)} agents:")
    for a in agents:
        print(f"   • {a.identifier:<30} parent={a.parent}")

    # ── Resolve into a compiled hierarchical graph ───────────────────────
    # Skip MCP tool fetching for visualization — we only need the hierarchy.
    from unittest.mock import AsyncMock, patch

    llm = get_llm()
    resolver = AgentResolver(model_llm=llm, auth=auth)

    # Patch MCPClientService.get_agent_tools to return empty tools instantly
    with patch(
        "services.agents.agents_service.MCPClientService"
    ) as MockMCPClientService:
        mock_instance = MockMCPClientService.return_value
        mock_instance.get_agent_tools = AsyncMock(return_value=[])
        compiled_graph = await resolver.resolve(agents)

    # ── Display the graph ────────────────────────────────────────────────
    import os
    import platform

    graph_drawable = compiled_graph.get_graph(xray=True)

    # 1. Save Mermaid text file (always works)
    mermaid_str = graph_drawable.draw_mermaid()
    mermaid_path = project_root / "examples" / "agent_hierarchy_graph.mmd"
    mermaid_path.parent.mkdir(parents=True, exist_ok=True)
    mermaid_path.write_text(mermaid_str, encoding="utf-8")
    print(f"\n📝 Mermaid definition saved to: {mermaid_path}")
    print("   (Paste into https://mermaid.live to visualise)\n")
    print(mermaid_str)

    # 2. Render PNG — try Pyppeteer (local), then API, then skip
    output_path = project_root / "examples" / "agent_hierarchy_graph.png"
    png_saved = False

    # Attempt 1: Pyppeteer (local headless browser — no URI-length limit)
    try:
        from langchain_core.runnables.graph import MermaidDrawMethod

        png_bytes = graph_drawable.draw_mermaid_png(
            draw_method=MermaidDrawMethod.PYPPETEER,
        )
        output_path.write_bytes(png_bytes)
        png_saved = True
        print(f"💾 Graph PNG saved (pyppeteer): {output_path}")
    except Exception as e:
        print(f"⚠️  Pyppeteer render failed: {e}")

    # Attempt 2: mermaid.ink API (works for small graphs)
    if not png_saved:
        try:
            png_bytes = graph_drawable.draw_mermaid_png(max_retries=3, retry_delay=2.0)
            output_path.write_bytes(png_bytes)
            png_saved = True
            print(f"💾 Graph PNG saved (API): {output_path}")
        except Exception as e:
            print(f"⚠️  API render failed: {e}")

    if not png_saved:
        print(
            "\nℹ️  Could not render PNG. Install pyppeteer (`pip install pyppeteer`) "
            "or view the .mmd file at https://mermaid.live"
        )

    # 3. Open the image if saved
    if png_saved:
        system = platform.system()
        if system == "Windows":
            os.startfile(str(output_path))  # type: ignore[attr-defined]
        elif system == "Darwin":
            os.system(f'open "{output_path}"')
        else:
            os.system(f'xdg-open "{output_path}"')
        print("🖼️  Opened graph image in default viewer.")


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
