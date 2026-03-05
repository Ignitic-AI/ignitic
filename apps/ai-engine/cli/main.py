"""
AI Engine CLI – entry point.

Usage
-----
    ai-engine login              Prompt for JWT token and save it locally
    ai-engine start              Open an interactive chat session
    ai-engine config show        Print current configuration
    ai-engine config set-server  Change the target server URL
    ai-engine config reset-chat  Clear the persisted active chat ID
"""

from __future__ import annotations

from typing import List, Optional

import typer
from rich.console import Console
from rich.table import Table
from rich import print as rprint

from cli import config as cfg
from cli.chat_client import run_chat

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = typer.Typer(
    name="ai-engine",
    help="AI Engine CLI – interact with the AI Engine server from your terminal.",
    no_args_is_help=True,
    add_completion=False,
)

config_app = typer.Typer(
    name="config",
    help="Manage local CLI configuration.",
    no_args_is_help=True,
)
app.add_typer(config_app, name="config")

console = Console()

# ---------------------------------------------------------------------------
# ai-engine login
# ---------------------------------------------------------------------------


@app.command()
def login(
    token: Optional[str] = typer.Option(
        None,
        "--token",
        "-t",
        help="Provide the JWT token directly (skips interactive prompt).",
    ),
    server: Optional[str] = typer.Option(
        None,
        "--server",
        "-s",
        help="Server URL (default: http://localhost:8010).",
    ),
) -> None:
    """
    Save your JWT authentication token so the CLI can connect to the server.

    If you do not pass --token you will be prompted to enter it interactively.
    The token is stored in ~/.ai-engine/config.json.
    """
    if server:
        cfg.set_server_url(server.rstrip("/"))
        console.print(f"[dim]Server URL set to: {cfg.get_server_url()}[/dim]")

    if not token:
        token = typer.prompt(
            "Paste your JWT token",
            hide_input=True,
            confirmation_prompt=False,
        )

    token = token.strip()  # type: ignore
    if not token:
        console.print("[bold red]✗ Token cannot be empty.[/bold red]")
        raise typer.Exit(code=1)

    cfg.set_token(token)
    console.print("[bold green]✓ Token saved successfully.[/bold green]")
    console.print(f"[dim]Config stored at: {cfg.config_path()}[/dim]")
    console.print(
        "\nYou can now start a chat session with: [bold cyan]ai-engine start[/bold cyan]"
    )


# ---------------------------------------------------------------------------
# ai-engine start
# ---------------------------------------------------------------------------


@app.command()
def start(
    agents: Optional[List[str]] = typer.Option(
        None,
        "--agent",
        "-a",
        help="Agent identifier(s) to use. Can be specified multiple times. "
        "Defaults to the last-used agents stored in config.",
    ),
    model: Optional[str] = typer.Option(
        None,
        "--model",
        "-m",
        help="LLM model override (e.g. 'deepseek/deepseek-chat-v3-0324:free').",
    ),
    server: Optional[str] = typer.Option(
        None,
        "--server",
        "-s",
        help="Override server URL for this session only.",
    ),
    org: bool = typer.Option(
        False,
        "--org",
        help="Use organisation agents instead of personal agents.",
    ),
    resume: bool = typer.Option(
        False,
        "--resume",
        "-r",
        help="Resume the previous chat session instead of starting a new one.",
    ),
    chat_id: Optional[str] = typer.Option(
        None,
        "--chat-id",
        "-c",
        help="Continue a specific chat session by ID. Overrides --resume.",
    ),
) -> None:
    """Start an interactive CLI chat session with the AI Engine.

    The session connects to the running AI Engine server over WebSocket
    and streams agent responses in real-time.

    By default, each invocation starts a fresh chat. Use --resume to
    continue the previous conversation, or --chat-id <id> to continue
    a specific chat session.
    """
    token = cfg.get_token()
    if not token:
        console.print(
            "[bold red]✗ No authentication token found.[/bold red]\n"
            "Run [bold cyan]ai-engine login[/bold cyan] first to save your token."
        )
        raise typer.Exit(code=1)

    effective_server = (server or cfg.get_server_url()).rstrip("/")
    if server:
        # Temporary override – don't persist
        original = cfg.get_server_url()
        cfg.set_server_url(effective_server)

    effective_agents: list[str] = list(agents) if agents else cfg.get_active_agents()
    effective_model: Optional[str] = model or cfg.get_default_model()

    # Determine which chat to use: explicit chat_id > resume > new chat
    effective_resume = resume and chat_id is None
    if chat_id:
        cfg.set_active_chat_id(chat_id)

    if effective_agents:
        cfg.set_active_agents(effective_agents)

    try:
        run_chat(
            agents=effective_agents,
            server_url=effective_server,
            token=token,
            model=effective_model,
            resume=effective_resume,
            chat_id=chat_id,
        )
    finally:
        if server:
            cfg.set_server_url(original)  # type: ignore[possibly-undefined]


# ---------------------------------------------------------------------------
# ai-engine config *
# ---------------------------------------------------------------------------


@config_app.command("show")
def config_show() -> None:
    """Print the current CLI configuration."""
    table = Table(title="AI Engine CLI Configuration", show_header=True)
    table.add_column("Key", style="cyan", no_wrap=True)
    table.add_column("Value", style="white")

    table.add_row("config file", str(cfg.config_path()))
    table.add_row("server_url", cfg.get_server_url())
    _token = cfg.get_token()
    table.add_row(
        "token",
        f"{'*' * 12}…{_token[-6:]}" if _token else "[dim]not set[/dim]",
    )
    table.add_row(
        "active_chat_id",
        cfg.get_active_chat_id() or "[dim]none[/dim]",
    )
    agents = cfg.get_active_agents()
    table.add_row(
        "active_agents",
        ", ".join(agents) if agents else "[dim]none (use server default)[/dim]",
    )
    table.add_row(
        "default_model",
        cfg.get_default_model() or "[dim]none (use server default)[/dim]",
    )

    console.print(table)


@config_app.command("set-server")
def config_set_server(
    url: str = typer.Argument(..., help="Server URL, e.g. http://localhost:8010"),
) -> None:
    """Update the AI Engine server URL."""
    url = url.rstrip("/")
    cfg.set_server_url(url)
    console.print(
        f"[bold green]✓[/bold green] Server URL updated to [cyan]{url}[/cyan]"
    )


@config_app.command("reset-chat")
def config_reset_chat() -> None:
    """Clear the persisted active chat ID so the next session starts fresh."""
    cfg.set_active_chat_id(None)
    console.print("[bold green]✓[/bold green] Active chat cleared.")


@config_app.command("set-model")
def config_set_model(
    model: Optional[str] = typer.Argument(
        None,
        help="Default model ID to persist (e.g. 'deepseek/deepseek-chat-v3-0324:free'). Pass nothing to clear.",
    ),
) -> None:
    """Set (or clear) the default LLM model used when starting a chat."""
    cfg.set_default_model(model or None)
    if model:
        console.print(
            f"[bold green]✓[/bold green] Default model set to: [cyan]{model}[/cyan]"
        )
    else:
        console.print(
            "[bold green]✓[/bold green] Default model cleared (server will use its default)."
        )


@config_app.command("set-agents")
def config_set_agents(
    agents: List[str] = typer.Argument(
        ...,
        help="Agent identifier(s) to persist as default, e.g. my-agent researcher",
    ),
) -> None:
    """Set the default agent(s) used when starting a chat."""
    cfg.set_active_agents(list(agents))
    console.print(
        f"[bold green]✓[/bold green] Default agents set to: [cyan]{', '.join(agents)}[/cyan]"
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    """Invoke the Typer app.  Registered as the ``ai-engine`` console script."""
    app()


if __name__ == "__main__":
    main()
