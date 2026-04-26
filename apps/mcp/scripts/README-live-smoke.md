# Live MCP Smoke Runner

This runner executes each unique MCP tool function against real integrations.

## Safety
- This is not a unit test.
- It performs live network calls to AI Engine and third-party APIs.
- Run it manually in controlled environments.

## Prerequisites
1. AI Engine is reachable from this machine.
2. Third-party credentials exist in AI Engine for the authenticated user.
3. Environment variables are configured:
   - `JWT_BEARER` (full bearer token, with or without `Bearer ` prefix)
   - `JWT_SECRET` and `JWT_ALGORITHM` should also be present for tool flows that decode JWT.
4. Create payload file with required parameters:
   - Copy `scripts/live_tool_payloads.example.json` to `scripts/live_tool_payloads.json`.
   - Fill required arguments for all tools you want to run.

## Usage

Run all unique tools (deduplicated by function path):

```powershell
.\.venv\Scripts\python.exe scripts\run_live_mcp_smoke.py --payload-file scripts\live_tool_payloads.json
```

List tools first (server, tool, identifier, function path):

```powershell
.\.venv\Scripts\python.exe scripts\run_live_mcp_smoke.py --list-tools
```

Generate payload template for all selected tools:

```powershell
.\.venv\Scripts\python.exe scripts\run_live_mcp_smoke.py --generate-payload-template scripts\live_tool_payloads.json
```

Run only selected servers:

```powershell
.\.venv\Scripts\python.exe scripts\run_live_mcp_smoke.py --server analytics --server business_analyst --payload-file scripts\live_tool_payloads.json
```

Run filtered tools by regex:

```powershell
.\.venv\Scripts\python.exe scripts\run_live_mcp_smoke.py --tool-regex "shopify|hubspot" --payload-file scripts\live_tool_payloads.json
```

Run one tool as a separate integration test case:

```powershell
.\.venv\Scripts\python.exe scripts\run_live_mcp_smoke.py --tool-name ba_unit_economics_breakeven --strict-payloads --separate-reports --payload-file scripts\live_tool_payloads.json
```

Run all tools with separate per-tool case files:

```powershell
.\.venv\Scripts\python.exe scripts\run_live_mcp_smoke.py --strict-payloads --separate-reports --payload-file scripts\live_tool_payloads.json
```

Stop on first failure:

```powershell
.\.venv\Scripts\python.exe scripts\run_live_mcp_smoke.py --fail-fast --payload-file scripts\live_tool_payloads.json
```

## Report
A JSON report is written to `live-reports/` with pass/fail/skipped results per tool.

With `--separate-reports`, each tool also gets its own JSON case file in a timestamped folder.

Skipped tools are those missing required arguments in payload config.
