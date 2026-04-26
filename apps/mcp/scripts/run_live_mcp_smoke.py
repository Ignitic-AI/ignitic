import argparse
import asyncio
import json
import os
import re
import sys
import inspect
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from servers.analytics_mcp import app as analytics_mcp
from servers.business_analyst_mcp import app as business_analyst_mcp
from servers.customer_support_mcp import app as customer_support_mcp
from servers.email_marketing_mcp import app as email_marketing_mcp
from servers.facebook_page_mcp import app as facebook_page_mcp
from servers.gdrive_mcp import app as gdrive_mcp
from servers.google_ads_mcp import app as google_ads_mcp
from servers.hubspot_mcp import app as hubspot_mcp
from servers.instagram_mcp import app as instagram_mcp
from servers.marketer_mcp import app as marketer_mcp
from servers.meta_ads_mcp import app as meta_ads_mcp
from servers.product_researcher_mcp import app as product_researcher_mcp
from servers.seo_mcp import app as seo_mcp
from servers.shopify_mcp import app as shopify_mcp

SERVER_APPS = {
    "analytics": analytics_mcp,
    "business_analyst": business_analyst_mcp,
    "customer_support": customer_support_mcp,
    "email_marketing": email_marketing_mcp,
    "facebook_page": facebook_page_mcp,
    "gdrive": gdrive_mcp,
    "google_ads": google_ads_mcp,
    "hubspot": hubspot_mcp,
    "instagram": instagram_mcp,
    "marketer": marketer_mcp,
    "meta_ads": meta_ads_mcp,
    "product_researcher": product_researcher_mcp,
    "seo": seo_mcp,
    "shopify": shopify_mcp,
}


@dataclass
class ToolExecutionResult:
    server: str
    tool_name: str
    ignitic_identifier: str
    function_path: str
    status: str
    duration_ms: int
    arguments: dict[str, Any]
    report_file: str | None = None
    error: str | None = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run live MCP smoke tests against real integrations."
    )
    parser.add_argument(
        "--payload-file",
        default="scripts/live_tool_payloads.json",
        help="Path to JSON payload file.",
    )
    parser.add_argument(
        "--server",
        action="append",
        default=[],
        help="Run only selected server key(s). Can be provided multiple times.",
    )
    parser.add_argument(
        "--tool-name",
        action="append",
        default=[],
        help="Run only specific tool name(s). Can be provided multiple times.",
    )
    parser.add_argument(
        "--identifier",
        action="append",
        default=[],
        help="Run only specific ignitic identifier(s). Can be provided multiple times.",
    )
    parser.add_argument(
        "--tool-regex",
        default="",
        help="Regex filter applied to tool name or ignitic identifier.",
    )
    parser.add_argument(
        "--chat-id",
        default="live-smoke",
        help="X-Chat-ID header value.",
    )
    parser.add_argument(
        "--fail-fast",
        action="store_true",
        help="Stop at first failed tool execution.",
    )
    parser.add_argument(
        "--report-file",
        default="",
        help="Optional explicit report file path.",
    )
    parser.add_argument(
        "--reports-dir",
        default="live-reports",
        help="Directory used for generated reports.",
    )
    parser.add_argument(
        "--separate-reports",
        action="store_true",
        help="Write one report file per tool execution.",
    )
    parser.add_argument(
        "--strict-payloads",
        action="store_true",
        help="Treat missing required args as test failures instead of skipped.",
    )
    parser.add_argument(
        "--list-tools",
        action="store_true",
        help="List selected tools and exit.",
    )
    parser.add_argument(
        "--generate-payload-template",
        default="",
        help="Generate payload template JSON for selected tools and exit.",
    )
    return parser.parse_args()


def load_payloads(path: str) -> dict[str, Any]:
    payload_path = Path(path)
    if not payload_path.exists():
        return {"by_name": {}, "by_identifier": {}}

    return json.loads(payload_path.read_text(encoding="utf-8"))


def required_params_missing(fn: Any, arguments: dict[str, Any]) -> list[str]:
    signature = inspect.signature(fn)
    missing: list[str] = []

    for param in signature.parameters.values():
        if param.kind not in (
            inspect.Parameter.POSITIONAL_OR_KEYWORD,
            inspect.Parameter.KEYWORD_ONLY,
        ):
            continue
        if param.default is inspect.Parameter.empty and param.name not in arguments:
            missing.append(param.name)

    return missing


def inject_headers_into_tool(tool_fn: Any, auth_header: str, chat_id: str) -> None:
    def _headers(_include_all: bool = False) -> dict[str, str]:
        return {
            "Authorization": auth_header,
            "X-Chat-ID": chat_id,
        }

    tool_fn.__globals__["get_http_headers"] = _headers


def pick_arguments(
    payloads: dict[str, Any], tool_name: str, ignitic_identifier: str
) -> dict[str, Any]:
    by_identifier = payloads.get("by_identifier", {})
    by_name = payloads.get("by_name", {})

    if ignitic_identifier in by_identifier:
        return by_identifier[ignitic_identifier]

    if tool_name in by_name:
        return by_name[tool_name]

    return {}


async def collect_unique_tools(server_filter: set[str], tool_regex: str) -> list[tuple]:
    return await _collect_tools(server_filter, set(), set(), tool_regex)


def _signature_payload_template(fn: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    signature = inspect.signature(fn)

    for param in signature.parameters.values():
        if param.kind not in (
            inspect.Parameter.POSITIONAL_OR_KEYWORD,
            inspect.Parameter.KEYWORD_ONLY,
        ):
            continue

        if param.default is inspect.Parameter.empty:
            payload[param.name] = "<required>"

    return payload


async def _collect_tools(
    server_filter: set[str],
    tool_names: set[str],
    identifiers: set[str],
    tool_regex: str,
) -> list[tuple]:
    compiled = re.compile(tool_regex) if tool_regex else None
    seen_functions: set[str] = set()
    selected: list[tuple] = []

    for server_name, app in SERVER_APPS.items():
        if server_filter and server_name not in server_filter:
            continue

        tools = await app._tool_manager.list_tools()
        for tool in tools:
            function_path = f"{tool.fn.__module__}.{tool.fn.__name__}"
            if function_path in seen_functions:
                continue

            ignitic_identifier = (tool.meta or {}).get("ignitic_identifier", "")

            if tool_names and tool.name not in tool_names:
                continue

            if identifiers and ignitic_identifier not in identifiers:
                continue

            searchable = f"{tool.name} {ignitic_identifier}"
            if compiled and not compiled.search(searchable):
                continue

            selected.append((server_name, tool, ignitic_identifier, function_path))
            seen_functions.add(function_path)

    return selected


def _safe_file_segment(value: str) -> str:
    safe = re.sub(r"[^a-zA-Z0-9_.-]+", "_", value)
    return safe.strip("_") or "tool"


async def run() -> int:
    load_dotenv()
    args = parse_args()
    payloads = load_payloads(args.payload_file)

    server_filter = set(args.server)
    selected_tools = await _collect_tools(
        server_filter=server_filter,
        tool_names=set(args.tool_name),
        identifiers=set(args.identifier),
        tool_regex=args.tool_regex,
    )

    if not selected_tools:
        print("No tools matched current filters.")
        return 0

    if args.list_tools:
        for server_name, tool, ignitic_identifier, function_path in selected_tools:
            print(f"{server_name}\t{tool.name}\t{ignitic_identifier}\t{function_path}")
        return 0

    if args.generate_payload_template:
        template = {
            "by_identifier": {},
            "by_name": {},
        }
        for _, tool, ignitic_identifier, _ in selected_tools:
            template["by_identifier"][ignitic_identifier] = _signature_payload_template(
                tool.fn
            )
        output_path = Path(args.generate_payload_template)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(template, indent=2), encoding="utf-8")
        print(f"Wrote payload template: {output_path}")
        return 0

    auth_header = os.getenv("JWT_BEARER", "").strip()
    if not auth_header:
        print("Missing JWT_BEARER environment variable.")
        return 2

    if not auth_header.lower().startswith("bearer "):
        auth_header = f"Bearer {auth_header}"

    print(f"Selected {len(selected_tools)} unique MCP tool functions.")

    started_at = datetime.now(timezone.utc)
    results: list[ToolExecutionResult] = []
    failures = 0
    skipped = 0

    for server_name, tool, ignitic_identifier, function_path in selected_tools:
        arguments = pick_arguments(payloads, tool.name, ignitic_identifier)
        missing = required_params_missing(tool.fn, arguments)

        if missing:
            status = (
                "failed_missing_args"
                if args.strict_payloads
                else "skipped_missing_args"
            )
            if status.startswith("failed"):
                failures += 1
            else:
                skipped += 1
            results.append(
                ToolExecutionResult(
                    server=server_name,
                    tool_name=tool.name,
                    ignitic_identifier=ignitic_identifier,
                    function_path=function_path,
                    status=status,
                    duration_ms=0,
                    arguments=arguments,
                    error=f"Missing required args: {', '.join(missing)}",
                )
            )
            print(
                f"{status.upper()}  {server_name}.{tool.name} -> Missing required args: {', '.join(missing)}"
            )
            if args.fail_fast and status.startswith("failed"):
                break
            continue

        inject_headers_into_tool(tool.fn, auth_header, args.chat_id)

        t0 = datetime.now(timezone.utc)
        try:
            await tool.run(arguments)
            duration_ms = int((datetime.now(timezone.utc) - t0).total_seconds() * 1000)
            results.append(
                ToolExecutionResult(
                    server=server_name,
                    tool_name=tool.name,
                    ignitic_identifier=ignitic_identifier,
                    function_path=function_path,
                    status="passed",
                    duration_ms=duration_ms,
                    arguments=arguments,
                )
            )
            print(f"PASS  {server_name}.{tool.name} ({duration_ms} ms)")
        except Exception as exc:  # noqa: BLE001
            failures += 1
            duration_ms = int((datetime.now(timezone.utc) - t0).total_seconds() * 1000)
            error_message = f"{type(exc).__name__}: {exc}"
            results.append(
                ToolExecutionResult(
                    server=server_name,
                    tool_name=tool.name,
                    ignitic_identifier=ignitic_identifier,
                    function_path=function_path,
                    status="failed",
                    duration_ms=duration_ms,
                    arguments=arguments,
                    error=error_message,
                )
            )
            print(
                f"FAIL  {server_name}.{tool.name} ({duration_ms} ms) -> {error_message}"
            )
            if args.fail_fast:
                break

    finished_at = datetime.now(timezone.utc)

    reports_dir = Path(args.reports_dir)
    if args.separate_reports:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        per_tool_dir = reports_dir / f"mcp_live_smoke_cases_{stamp}"
        per_tool_dir.mkdir(parents=True, exist_ok=True)
        for item in results:
            case_file = per_tool_dir / (
                f"{_safe_file_segment(item.server)}__{_safe_file_segment(item.tool_name)}.json"
            )
            case_file.write_text(json.dumps(asdict(item), indent=2), encoding="utf-8")
            item.report_file = str(case_file)

    report = {
        "started_at": started_at.isoformat(),
        "finished_at": finished_at.isoformat(),
        "total_selected": len(selected_tools),
        "passed": len([r for r in results if r.status == "passed"]),
        "failed": failures,
        "skipped_missing_args": skipped,
        "results": [asdict(item) for item in results],
    }

    report_path = (
        Path(args.report_file)
        if args.report_file
        else reports_dir
        / f"mcp_live_smoke_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"
    )
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print("\nSummary")
    print(f"  Selected: {report['total_selected']}")
    print(f"  Passed:   {report['passed']}")
    print(f"  Failed:   {report['failed']}")
    print(f"  Skipped:  {report['skipped_missing_args']}")
    print(f"  Report:   {report_path}")

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(run()))
