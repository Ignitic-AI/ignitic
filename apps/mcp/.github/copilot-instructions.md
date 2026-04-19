# Ignitic AI Engine MCP - Copilot Onboarding Instructions

## Mission
You are working in a multi-server MCP codebase. Your default job is to make safe, minimal changes and keep all MCP server registrations, middleware behavior, and mounts consistent.

Primary goals for this repository:
- Keep MCP server modules declarative and deterministic.
- Prefer unit tests over integration tests for tool registration and middleware behavior.
- Avoid network calls in tests (mock AI Engine and all external APIs).

## Project Map
- `main.py`: Starlette app composition and MCP mount routing.
- `servers/*_mcp.py`: one FastMCP app per business domain.
- `servers/middlewares.py`: auth + execution logging middleware.
- `servers/tools/**`: tool implementations called by MCP servers.
- `servers/tools/workflow_tools.py`: dynamic workflow tool registration at startup.
- `models/agent.py`: canonical agent route names used by `main.py` mounts.

## MCP Servers In Scope
All of these are mounted in `main.py` and must be unit-tested:

1. `servers/product_researcher_mcp.py`
2. `servers/business_analyst_mcp.py`
3. `servers/marketer_mcp.py`
4. `servers/seo_mcp.py`
5. `servers/shopify_mcp.py`
6. `servers/hubspot_mcp.py`
7. `servers/gdrive_mcp.py`
8. `servers/facebook_page_mcp.py`
9. `servers/instagram_mcp.py`
10. `servers/email_marketing_mcp.py`
11. `servers/customer_support_mcp.py`
12. `servers/analytics_mcp.py`
13. `servers/meta_ads_mcp.py`
14. `servers/google_ads_mcp.py`
15. `servers/custom_mcp.py`

Current registration counts (`app.tool(...)`) for sanity checks:
- analytics: 10
- business_analyst: 7
- custom: 157
- customer_support: 15
- email_marketing: 42
- facebook_page: 8
- gdrive: 13
- google_ads: 14
- hubspot: 34
- instagram: 4
- marketer: 4
- meta_ads: 13
- product_researcher: 8
- seo: 3
- shopify: 6

## Runtime Architecture Notes
- Every MCP server uses `FastMCP(..., streamable_http_path="/")`.
- Every MCP server adds both middleware classes:
	- `AuthenticationMiddleware()`
	- `ExecutionLoggingMiddleware()`
- `main.py` mounts each server via `Agent` enum values plus `/custom`.
- `main.py` lifespan calls `register_workflow_tools()`; failures are logged and do not stop startup.

## Unit Testing Requirements
When asked to implement or update tests, cover these layers:

### 1) Server Module Registration Tests
For each `servers/*_mcp.py` file:
- Assert app exists and is `FastMCP`.
- Assert expected number of tools is registered.
- Assert all expected tool names are present.
- Assert every registered tool has `meta["ignitic_identifier"]`.
- Assert both middlewares are attached.

### 2) Mounting and Lifespan Tests (`main.py`)
- Assert all expected mount paths are present.
- Assert custom route is mounted at `/custom`.
- Assert startup calls `register_workflow_tools()`.
- Assert startup continues if workflow registration raises (error is logged).

### 3) Middleware Tests (`servers/middlewares.py`)
- `AuthenticationMiddleware`:
	- raises when Authorization header is missing.
	- sets `auth_header` and `chat_id` in context state when headers exist.
- `ExecutionLoggingMiddleware`:
	- logs start/success/failure without crashing on logging API failures.
	- updates execution status correctly for success and exception paths.
	- re-raises tool exception after failed execution.
- `get_tool_info`:
	- returns metadata for valid tool.
	- raises when tool missing.
	- raises when `ignitic_identifier` is missing.

### 4) Workflow Registration Tests (`servers/tools/workflow_tools.py`)
- Registers dynamic tools into targeted MCP app and custom MCP.
- Skips unknown agent keys safely.
- Uses dynamic input/output models and calls workflow URL.
- Mocks `AIEngineClient`, `requests.post`, and auth header retrieval.

## Live Integration Testing Requirements
Use a dedicated integration folder under `tests/integration/` for opt-in, real API validations.

### Scope Required Now
- `tests/integration/tools/advertising/google_ads/test_tools_integration.py`
- `tests/integration/tools/advertising/meta_ads/test_tools_integration.py`
- `tests/integration/tools/analytics/google_analytics/test_tools_integration.py`
- `tests/integration/tools/analytics/shopify/test_tools_integration.py`

### Expected Behavior
- One separate pytest case per tool function (parametrized is acceptable).
- Real credentials fetched through normal runtime flow (no mocking of provider clients).
- JWT bearer auth passed via environment (`JWT_BEARER`) and injected as Authorization header.
- Payloads loaded from JSON fixtures under `tests/integration/live_payloads/`.
- Integration tests are gated and skipped unless `RUN_LIVE_INTEGRATION=1`.

### Payload Files
- `tests/integration/live_payloads/ads_tool_payloads.json` for editable run payloads.
- `tests/integration/live_payloads/ads_tool_payloads.example.json` as template.
- `tests/integration/live_payloads/analytics_tool_payloads.json` for editable analytics payloads.
- `tests/integration/live_payloads/analytics_tool_payloads.example.json` as template.

## Test Layout Convention
Use this structure:
- `tests/servers/test_<server_name>_mcp.py` for each server module.
- `tests/servers/test_main_mounts.py` for mount/lifespan checks.
- `tests/servers/test_middlewares.py` for middleware unit tests.
- `tests/servers/tools/test_workflow_tools.py` for dynamic workflow registration.
- `tests/integration/tools/advertising/google_ads/test_tools_integration.py` for live Google Ads tools.
- `tests/integration/tools/advertising/meta_ads/test_tools_integration.py` for live Meta Ads tools.
- `tests/integration/tools/analytics/google_analytics/test_tools_integration.py` for live Google Analytics tools.
- `tests/integration/tools/analytics/shopify/test_tools_integration.py` for live Shopify Analytics tools.

Keep tests isolated and fast:
- No live external HTTP calls.
- No dependency on real environment variables.
- Patch external clients at module import/use boundaries.

## Mocking Rules
- Mock `services.ai_engine_client.AIEngineClient` in middleware and workflow tests.
- Mock `fastmcp.server.dependencies.get_http_headers` for auth scenarios.
- Mock `requests.post` in workflow tool execution path.
- Never call real Google, Meta, HubSpot, Shopify, Zendesk, Brevo, Mailchimp, Apify, or Trustpilot APIs in unit tests.

## Change Safety Rules
- Do not refactor tool modules while adding tests unless required.
- Keep production behavior unchanged unless a failing test exposes a bug.
- If you discover a mismatch between mounted agent paths and workflow agent keys, document it and add regression coverage before fixing.

## Known Gotcha
- In `servers/tools/workflow_tools.py`, `AGENT_MCPS` uses key `"instagram_mcp"` while mounted route naming is based on `instagram_agent` in `models/agent.py`. Treat this as a potential mismatch and add a focused test case before any behavior change.

## Recommended Test Dependencies
If missing in project config, use:
- `pytest`
- `pytest-asyncio`
- `pytest-mock` (optional)

Default run command:
- `pytest -q`

## Implementation Style
- Keep new tests explicit over clever.
- Prefer table-driven assertions for repeated server registration checks.
- Use clear assertion messages for registration-count failures.
- Minimize fixture scope; avoid global mutable state.
