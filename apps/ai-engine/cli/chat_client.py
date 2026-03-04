"""
WebSocket chat client for the AI Engine CLI.

Manages the persistent WebSocket connection to the server and drives
the interactive read-eval-print chat loop.
"""

from __future__ import annotations

import asyncio
import json
import sys
from typing import Optional

import websockets
from rich.console import Console
from rich.live import Live
from rich.markdown import Markdown
from rich.panel import Panel
from rich.prompt import Prompt
from rich.text import Text
from rich import print as rprint

from cli import config as cfg

console = Console()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

WELCOME_BANNER = """[bold cyan]
╔══════════════════════════════════════════╗
║        AI Engine CLI  –  Chat Mode       ║
║                                          ║
║  Type your message and press [Enter].    ║
║  Commands:  /quit  /clear  /agents       ║
║             /new   /server               ║
╚══════════════════════════════════════════╝
[/bold cyan]"""

COMMANDS = {
    "/quit": "Exit the chat session",
    "/clear": "Start a new chat (clears active chat ID)",
    "/agents": "Show or change the agent(s) in use",
    "/new": "Alias for /clear",
    "/server": "Show the server URL currently in use",
}


def _print_help() -> None:
    table_lines = [f"  [bold cyan]{k}[/bold cyan]  {v}" for k, v in COMMANDS.items()]
    console.print(
        "\n[bold]Available commands:[/bold]\n" + "\n".join(table_lines) + "\n"
    )


# ---------------------------------------------------------------------------
# Core async chat loop
# ---------------------------------------------------------------------------


async def _chat_loop(
    agents: list[str],
    server_url: str,
    token: str,
    model: Optional[str],
) -> None:
    console.print(WELCOME_BANNER)
    if agents:
        console.print(f"[dim]Agents: {', '.join(agents)}[/dim]")
    else:
        console.print("[dim]Agents: default (configured on server)[/dim]")
    console.print(f"[dim]Server: {server_url}[/dim]\n")

    ws_endpoint = f"{cfg.ws_url()}/api/v1/chat/ws"

    try:
        async with websockets.connect(
            ws_endpoint,
            additional_headers={"Authorization": f"Bearer {token}"},
            ping_interval=30,
            ping_timeout=60,
            open_timeout=15,
        ) as ws:
            # Wait for authentication confirmation
            auth_msg = json.loads(await ws.recv())
            if auth_msg.get("event") == "error":
                console.print(
                    f"[bold red]✗ Authentication failed:[/bold red] {auth_msg.get('detail')}"
                )
                return
            if auth_msg.get("event") != "authenticated":
                console.print(
                    f"[bold red]✗ Unexpected handshake message:[/bold red] {auth_msg}"
                )
                return

            console.print("[bold green]✓ Connected[/bold green]\n")

            current_chat_id = cfg.get_active_chat_id()
            current_agents = list(agents)

            while True:
                # ---- Read user input ----------------------------------------
                try:
                    user_input = await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda: Prompt.ask("[bold blue]You[/bold blue]"),
                    )
                except (EOFError, KeyboardInterrupt):
                    console.print("\n[dim]Bye![/dim]")
                    break

                user_input = user_input.strip()
                if not user_input:
                    continue

                # ---- Built-in commands ---------------------------------------
                if user_input.lower() in ("/quit", "/exit", "exit", "quit"):
                    console.print("[dim]Bye![/dim]")
                    break

                if user_input.lower() in ("/clear", "/new"):
                    current_chat_id = None
                    cfg.set_active_chat_id(None)
                    console.print(
                        "[dim]Chat cleared – next message starts a new conversation.[/dim]\n"
                    )
                    continue

                if user_input.lower() == "/agents":
                    if current_agents:
                        console.print(
                            f"[dim]Current agents: {', '.join(current_agents)}[/dim]"
                        )
                    else:
                        console.print("[dim]Using default agents[/dim]")
                    new_agents_raw = await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda: Prompt.ask(
                            "[dim]Enter agent identifiers (comma-separated, blank to keep)[/dim]",
                            default="",
                        ),
                    )
                    if new_agents_raw.strip():
                        current_agents = [
                            a.strip() for a in new_agents_raw.split(",") if a.strip()
                        ]
                        cfg.set_active_agents(current_agents)
                        console.print(
                            f"[dim]Agents updated: {', '.join(current_agents)}[/dim]\n"
                        )
                    continue

                if user_input.lower() == "/server":
                    console.print(f"[dim]Server: {server_url}[/dim]\n")
                    continue

                if user_input.lower() in ("/help", "?"):
                    _print_help()
                    continue

                # ---- Send message to server ----------------------------------
                request = {
                    "message": user_input,
                    "chat_id": current_chat_id,
                    "agents": current_agents,
                    "model": model,
                }
                await ws.send(json.dumps(request))

                # ---- Stream response ----------------------------------------
                response_text = ""
                agent_name = "Assistant"

                with Live(
                    console=console,
                    refresh_per_second=15,
                    transient=False,
                ) as live:
                    async for raw in _receive_stream(ws):
                        msg = json.loads(raw)
                        event = msg.get("event")

                        if event == "chat_resolved":
                            current_chat_id = msg.get("chat_id")
                            cfg.set_active_chat_id(current_chat_id)

                        elif event == "chunk":
                            content = msg.get("content", "")
                            if content:
                                response_text += content
                                agent_name = msg.get("agent_name", agent_name)
                                live.update(
                                    Panel(
                                        Markdown(response_text),
                                        title=f"[bold green]{agent_name}[/bold green]",
                                        border_style="green",
                                        expand=False,
                                    )
                                )

                        elif event == "done":
                            # Render final clean output
                            live.update(
                                Panel(
                                    Markdown(response_text),
                                    title=f"[bold green]{agent_name}[/bold green]",
                                    border_style="green",
                                    expand=False,
                                )
                            )
                            break

                        elif event == "error":
                            live.update(
                                Text(
                                    f"✗ Error: {msg.get('detail', 'unknown error')}",
                                    style="bold red",
                                )
                            )
                            break

                console.print()

    except websockets.exceptions.ConnectionClosedError as exc:
        console.print(f"\n[bold red]✗ Connection closed:[/bold red] {exc}")
    except (ConnectionRefusedError, OSError) as exc:
        console.print(
            f"\n[bold red]✗ Could not connect to server at [cyan]{server_url}[/cyan]:[/bold red] {exc}\n"
            "Make sure the AI Engine server is running and the URL is correct.\n"
            "You can update the server URL with: [bold]ai-engine config set-server <url>[/bold]"
        )


async def _receive_stream(ws):
    """
    Yield raw WebSocket messages until 'done' or 'error' is received,
    or the connection is closed.
    """
    while True:
        try:
            raw = await ws.recv()
            yield raw
            msg = json.loads(raw)
            if msg.get("event") in ("done", "error"):
                return
        except websockets.exceptions.ConnectionClosed:
            return


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def run_chat(
    agents: list[str],
    server_url: str,
    token: str,
    model: Optional[str] = None,
) -> None:
    """Block until the chat session ends."""
    try:
        asyncio.run(
            _chat_loop(
                agents=agents,
                server_url=server_url,
                token=token,
                model=model,
            )
        )
    except KeyboardInterrupt:
        console.print("\n[dim]Session interrupted.[/dim]")
