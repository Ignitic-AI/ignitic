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
from loguru import logger

import websockets
from rich.console import Console
from rich.prompt import Prompt

from cli import config as cfg

console = Console()

# Suppress loguru stderr output in CLI to keep the UI clean.
# Optionally log to a file instead if debugging is needed.
logger.remove()  # Remove default stderr handler
# Uncomment the line below to log to a file for debugging:
# logger.add("~/.ai-engine/cli.log", level="DEBUG")

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
    resume: bool = False,
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

            current_chat_id = cfg.get_active_chat_id() if resume else None
            if not resume:
                cfg.set_active_chat_id(None)
            current_agents = list(agents)

            while True:
                # ---- Read user input ----------------------------------------
                try:
                    user_input = await asyncio.get_running_loop().run_in_executor(
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
                    new_agents_raw = await asyncio.get_running_loop().run_in_executor(
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
                logger.debug(f"📤 Sending message to server: {user_input[:50]}...")
                await ws.send(json.dumps(request))

                # ---- Stream response ----------------------------------------
                agent_name = "Assistant"
                header_printed = False
                chunk_count = 0

                async for raw in _receive_stream(ws):
                    msg = json.loads(raw)
                    event = msg.get("event")

                    if event == "chat_resolved":
                        current_chat_id = msg.get("chat_id")
                        cfg.set_active_chat_id(current_chat_id)

                    elif event == "chunk":
                        chunk_type = msg.get("chunk_type", "text")
                        chunk_idx = msg.get("chunk_index", -1)

                        if chunk_type == "tool_call":
                            tool_name = msg.get("tool_name", "")
                            tool_args = msg.get("tool_args") or {}
                            # Filter out InjectedState noise — only show
                            # scalar / short args that are user-meaningful
                            display_args = {
                                k: v
                                for k, v in tool_args.items()
                                if k != "state"
                                and not isinstance(v, dict)
                                or (isinstance(v, dict) and len(str(v)) < 120)
                            }
                            args_str = (
                                f"({', '.join(f'{k}={repr(v)}' for k, v in display_args.items())})"
                                if display_args
                                else "()"
                            )
                            # Print on its own line, dim so it doesn't clutter
                            sys.stdout.write("\n")
                            console.print(
                                f"  [dim]\u2699\ufe0f  {msg.get('agent_name', agent_name)} \u2192 [bold]{tool_name}[/bold]{args_str}[/dim]"
                            )

                        elif chunk_type == "tool_result":
                            tool_name = msg.get("tool_name", "")
                            console.print(f"  [dim]\u2713  {tool_name} done[/dim]")

                        else:  # "text"
                            content = msg.get("content", "")
                            if content:
                                if not header_printed:
                                    agent_name = msg.get("agent_name", agent_name)
                                    console.print(
                                        f"\n[bold green]{agent_name}[/bold green]"
                                    )
                                    header_printed = True
                                chunk_count += 1
                                logger.debug(
                                    f"📥 Received chunk #{chunk_idx}: {len(content)} chars"
                                )
                                sys.stdout.write(content)
                                sys.stdout.flush()

                    elif event == "done":
                        logger.info(
                            f"✅ Stream complete: received {chunk_count} chunks"
                        )
                        sys.stdout.write("\n\n")
                        sys.stdout.flush()
                        break

                    elif event == "error":
                        console.print(
                            f"\n[bold red]✗ Error:[/bold red] {msg.get('detail', 'unknown error')}\n"
                        )
                        break

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
    resume: bool = False,
) -> None:
    """Block until the chat session ends."""
    try:
        asyncio.run(
            _chat_loop(
                agents=agents,
                server_url=server_url,
                token=token,
                model=model,
                resume=resume,
            )
        )
    except KeyboardInterrupt:
        console.print("\n[dim]Session interrupted.[/dim]")
