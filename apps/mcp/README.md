# Ignitic AI MCP Server

The **MCP Server** is the tool-exposure layer of the [Ignitic AI](https://igniticai.com) platform. It implements the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) using **FastMCP 2.x** and exposes 190+ domain-specific tools that AI agents (running in the AI Engine) call to interact with e-commerce, CRM, marketing, and analytics platforms.

---

## Architecture

The server is a **Starlette** application that composes **15 independent FastMCP servers**, each mounted at its own path. It sits between the AI Engine (which orchestrates agents) and the external services those agents need to operate.

```
AI Engine (FastAPI + LangGraph)
        │
        │  HTTP · Streamable MCP Transport
        ▼
MCP Server (Starlette + FastMCP) — port 8011
        ├── /product_researcher     ←  8 tools  — Market & product research
        ├── /business_analyst       ←  7 tools  — Financial calculations
        ├── /marketer               ←  4 tools  — Social media & competitor intel
        ├── /seo_agent              ←  3 tools  — SEO analysis
        ├── /shopify_agent          ←  6 tools  — Shopify product management
        ├── /hubspot_agent          ← 34 tools  — HubSpot CRM
        ├── /gdrive_agent           ← 13 tools  — Google Drive
        ├── /facebook_page_agent    ←  8 tools  — Facebook Page management
        ├── /instagram_agent        ←  4 tools  — Instagram management
        ├── /email_marketing_agent  ← 42 tools  — Brevo + Mailchimp campaigns
        ├── /customer_support_agent ← 15 tools  — Zendesk ticket management
        ├── /analytics_agent        ← 10 tools  — Shopify + GA4 analytics
        ├── /meta_ads_agent         ← 13 tools  — Meta (Facebook/Instagram) Ads
        ├── /google_ads_agent       ← 14 tools  — Google Ads
        └── /custom                 ← 155+ tools — All tools + dynamic n8n workflows
```

### Key Design Decisions

- **Multi-server isolation** — each domain is an independent FastMCP app that can be tested, scaled, or deployed independently.
- **Shared middleware** — every server uses the same `AuthenticationMiddleware` + `ExecutionLoggingMiddleware` pipeline.
- **No credential storage** — third-party API credentials (Shopify tokens, HubSpot keys, etc.) are never stored on the MCP Server. They are fetched at invocation time from the AI Engine on behalf of the authenticated user.
- **Dynamic tools** — n8n workflow templates are registered as MCP tools at server startup, with Pydantic models generated automatically from the template schema.

---

## MCP Servers & Tools

### Product Researcher (`/product_researcher`)

| Tool | Description |
|------|-------------|
| `google_dork_search` | Advanced Google search using dork operators |
| `apify_amazon_search` | Amazon product search via Apify |
| `apify_ebay_search` | eBay product listing scraper via Apify |
| `apify_alibaba_supplier_search` | Alibaba supplier search via Apify |
| `apify_alibaba_product_search` | Alibaba product search via Apify |
| `apify_aliexpress_search` | AliExpress product scraper via Apify |
| `google_trends` | Google Trends analysis via PyTrends |
| `shopify_product_scraper` | Scrape product data from a Shopify storefront |

### Business Analyst (`/business_analyst`)

| Tool | Description |
|------|-------------|
| `ba_unit_economics_breakeven` | Calculate break-even point |
| `ba_price_series_summary` | Statistical summary of a price series |
| `ba_landed_unit_cost` | Total landed cost calculation |
| `ba_tam_from_assumptions` | TAM/SAM/SOM estimation |
| `ba_financial_scenario_grid` | Financial scenario grid (vary two parameters) |
| `ba_weighted_decision_matrix` | Weighted decision matrix scoring |
| `ba_compound_growth_projection` | CAGR-based growth projection |

### Marketer (`/marketer`)

| Tool | Description |
|------|-------------|
| `twitter_trends` | Trending topics on X (Twitter) |
| `tiktok_trends` | TikTok trending sounds and hashtags |
| `facebook_ads_scraper` | Scrape Facebook Ads Library data |
| `site_domain_authority_seo` | Domain authority and SEO metrics |

### SEO Agent (`/seo_agent`)

| Tool | Description |
|------|-------------|
| `site_domain_authority_seo` | Domain authority score |
| `meta_tags_scraper_seo` | Scrape meta tags from a URL |
| `shopify_product_scraper` | Product SEO data from Shopify storefront |

### Shopify Agent (`/shopify_agent`)

| Tool | Description |
|------|-------------|
| `create_product` | Create a new Shopify product |
| `get_product_by_id` | Get a product by ID |
| `get_products` | List products with pagination |
| `delete_product` | Delete a product |
| `publish_product` | Publish product to storefront |
| `unpublish_product` | Unpublish product from storefront |

### HubSpot Agent (`/hubspot_agent`) — 34 tools

Full HubSpot CRM management: contacts, companies, deals, tickets, notes, batch operations, associations, lists, files, forms, pipelines, owners, and marketing emails. See [Tools Reference](docs/tools-reference.md#6-hubspot-agent-hubspot_agent) for the full list.

### Google Drive Agent (`/gdrive_agent`) — 13 tools

Search, read, write, copy, move, delete files and folders; manage sharing permissions. See [Tools Reference](docs/tools-reference.md#7-google-drive-agent-gdrive_agent).

### Facebook Page Agent (`/facebook_page_agent`) — 8 tools

Create/delete posts, post images, manage comments, count engagement. See [Tools Reference](docs/tools-reference.md#8-facebook-page-agent-facebook_page_agent).

### Instagram Agent (`/instagram_agent`) — 4 tools

Get profile info, list media posts, retrieve insights, publish media. See [Tools Reference](docs/tools-reference.md#9-instagram-agent-instagram_agent).

### Email Marketing Agent (`/email_marketing_agent`) — 42 tools

Full contact and campaign management for **Brevo** (20 tools) and **Mailchimp** (22 tools). See [Tools Reference](docs/tools-reference.md#10-email-marketing-agent-email_marketing_agent).

### Customer Support Agent (`/customer_support_agent`) — 15 tools

Zendesk ticket lifecycle: create, update, close, search; manage comments, users, views, and metrics. See [Tools Reference](docs/tools-reference.md#11-customer-support-agent-customer_support_agent).

### Analytics Agent (`/analytics_agent`) — 10 tools

Shopify revenue/customer/inventory metrics (5 tools) and Google Analytics 4 traffic/conversion data (5 tools). See [Tools Reference](docs/tools-reference.md#12-analytics-agent-analytics_agent).

### Meta Ads Agent (`/meta_ads_agent`) — 13 tools

End-to-end Meta advertising: discover accounts, create/update campaigns, ad sets, creatives, ads, and retrieve insights. See [Tools Reference](docs/tools-reference.md#13-meta-ads-agent-meta_ads_agent).

### Google Ads Agent (`/google_ads_agent`) — 14 tools

Full Google Ads management: campaigns, ad groups, ads, creative assets, and performance metrics. See [Tools Reference](docs/tools-reference.md#14-google-ads-agent-google_ads_agent).

### Custom Agent (`/custom`)

Exposes all tools above as a flat catalog plus **dynamically registered n8n workflow tools** fetched from the AI Engine at startup. Enables user-defined custom agents to use any combination of tools.

---

## Getting Started

### Prerequisites

- Python 3.12+
- `uv` package manager: `pip install uv`
- A running AI Engine instance (for credential retrieval and tool execution logging)

### Installation

```bash
cd mcp/

# Install all dependencies
uv sync
```

### Configuration

Copy the example environment file and fill in the required values:

```bash
cp .env.example .env
```

**Required environment variables:**

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Port the server listens on | `8011` |
| `JWT_SECRET` | Shared JWT secret (must match Backend API and AI Engine) | *(min 32 chars)* |
| `JWT_ALGORITHM` | JWT algorithm | `HS256` |
| `AI_ENGINE_BASE_URL` | Base URL of the AI Engine | `http://localhost:8010` |

**Optional environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Bind address |
| `DEBUG` | `false` | Enable uvicorn auto-reload |

### Running the Server

```bash
uv run python main.py
```

The server starts on `http://0.0.0.0:8011`.

**Health check:**

```bash
curl http://localhost:8011/health
# {"status": "ok", "service": "mcp", "version": "1.0.0"}
```

---

## Authentication

Every tool call requires a JWT Bearer token:

```
Authorization: Bearer <jwt>
```

Optionally, associate the call with a chat session for log correlation:

```
X-Chat-ID: <chat_session_id>
```

The `AuthenticationMiddleware` extracts these headers and stores them in the FastMCP request context. The `ExecutionLoggingMiddleware` then uses them to log every tool invocation to the AI Engine (status: `running` → `succeeded` / `failed`).

---

## Middleware Pipeline

Every tool call passes through two middleware layers:

```
HTTP request
    │
    ▼ AuthenticationMiddleware
    │   Extract Authorization + X-Chat-ID → store in context
    │
    ▼ ExecutionLoggingMiddleware
    │   Log ToolExecution (status: running) → AI Engine
    │
    ▼ Tool function executes
    │
    ▼ ExecutionLoggingMiddleware (post)
        Update ToolExecution (status: succeeded / failed)
```

Logging failures never block tool execution — if the AI Engine is temporarily unreachable, the tool call completes normally.

---

## Repository Structure

```
mcp/
├── main.py                        # Starlette app entry point; mounts all 15 MCP servers
├── core/
│   └── auth.py                    # JWT extraction helper
├── models/
│   ├── agent.py                   # Agent enum (server path names)
│   ├── credential.py              # Credential model
│   ├── tool_execution.py          # ToolExecution model
│   ├── user.py                    # User model
│   └── automations/               # Automation models
│       ├── workflow_template.py   # n8n WorkflowTemplate + WorkflowInput/Output
│       └── workflow_session.py    # WorkflowSession model
├── servers/
│   ├── middlewares.py             # AuthenticationMiddleware + ExecutionLoggingMiddleware
│   ├── analytics_mcp.py
│   ├── business_analyst_mcp.py
│   ├── custom_mcp.py
│   ├── customer_support_mcp.py
│   ├── email_marketing_mcp.py
│   ├── facebook_page_mcp.py
│   ├── gdrive_mcp.py
│   ├── google_ads_mcp.py
│   ├── hubspot_mcp.py
│   ├── instagram_mcp.py
│   ├── marketer_mcp.py
│   ├── meta_ads_mcp.py
│   ├── product_researcher_mcp.py
│   ├── seo_mcp.py
│   ├── shopify_mcp.py
│   └── tools/                     # Tool implementations by domain
│       ├── advertising/           # Meta Ads + Google Ads tools
│       ├── analytics/             # Shopify analytics + GA4 tools
│       ├── business_analyst/      # Financial calculation tools
│       ├── crm/                   # Shopify + HubSpot CRM tools
│       ├── customer_support/      # Zendesk tools
│       ├── email_marketing/       # Brevo + Mailchimp tools
│       ├── google_drive/          # Google Drive tools
│       ├── product_researcher/    # Apify + Google Trends tools
│       ├── reviews/               # Trustpilot scraper
│       ├── Seo/                   # SEO analysis tools
│       ├── social_media_marketing/# Facebook Pages + Instagram tools
│       └── workflow_tools.py      # Dynamic n8n workflow tool registration
├── services/
│   └── ai_engine_client.py        # HTTP client for AI Engine internal API
├── utils/
│   ├── dynamic_models.py          # Runtime Pydantic model generation for workflow tools
│   ├── exception_handling.py      # Custom exceptions (UnauthorizedError, NotFoundError)
│   ├── http_client.py             # Shared async HTTP client
│   └── lifespan.py                # Combines multiple Starlette lifespans
├── tests/
│   ├── servers/                   # Unit tests for middleware, mounts, server registrations
│   └── integration/               # Live integration tests (require real credentials)
├── scripts/
│   ├── run_live_mcp_smoke.py      # CLI smoke test runner
│   └── live_tool_payloads.example.json
├── docs/                          # Full documentation (see below)
├── Dockerfile
├── pyproject.toml
└── .env.example
```

---

## Adding New Tools

1. Create a tool function file in `servers/tools/<domain>/`:
   ```python
   # servers/tools/crm/shopify/inventory.py
   async def get_inventory_levels(location_id: str) -> list[dict]:
       """Retrieve inventory levels for all products at a location."""
       ...
   ```

2. Import and register in the appropriate MCP server file:
   ```python
   # servers/shopify_mcp.py
   from servers.tools.crm.shopify.inventory import get_inventory_levels
   app.tool(
       get_inventory_levels,
       meta={"ignitic_identifier": "tools.shopify_agent.get_inventory_levels"}
   )
   ```

3. Update the tool count in `tests/servers/test_mcp_server_registrations.py`.

4. Run tests: `uv run pytest`

---

## Testing

```bash
# Run all unit tests
uv run pytest

# Run specific test file
uv run pytest tests/servers/test_middlewares.py -v

# Run with coverage
uv run pytest --cov=. --cov-report=term-missing
```

For live integration smoke tests, see [docs/testing.md](docs/testing.md).

---

## Docker

```bash
# Build from the repository root (the image also bundles apps/ai-engine)
docker build -f apps/mcp/Dockerfile -t ignitic-mcp .

# Run
docker run -d --name ignitic-mcp -p 8011:8011 --env-file apps/mcp/.env ignitic-mcp
```

---

To run the whole platform, use `docker compose up` from the [repository root](../../README.md#quickstart).

---

## Technology Stack

| Category | Technology |
|----------|-----------|
| Runtime | Python 3.12 |
| Package manager | `uv` |
| Web framework | Starlette |
| MCP framework | FastMCP 2.11 |
| MCP transport | Streamable HTTP (SSE) |
| Authentication | JWT (PyJWT) |
| Shopify | `shopifyapi` SDK |
| HubSpot | HubSpot REST API v3 |
| Google | `google-api-python-client`, `google-ads`, `google-auth` |
| Meta/Facebook | Facebook Graph API |
| Email | Brevo REST API, Mailchimp Marketing API |
| Customer Support | Zendesk REST API |
| Scraping | Apify, BeautifulSoup4, PyTrends |
| Containerisation | Docker |
| CI/CD | GitHub Actions |

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/introduction.md](docs/introduction.md) | Project introduction and quick-start |
| [docs/tools-reference.md](docs/tools-reference.md) | Full catalog of all 190+ tools |
| [docs/api-reference.md](docs/api-reference.md) | MCP transport, endpoints, headers, and protocol |
| [docs/database-schema.md](docs/database-schema.md) | Data models (ToolExecution, Credential, WorkflowTemplate, etc.) |
| [docs/testing.md](docs/testing.md) | Unit tests, integration tests, live smoke tests |

---

## Troubleshooting

**Server won't start:**
- Check port 8011 is not in use: `lsof -i :8011`
- Verify Python 3.12+: `python --version`
- Confirm all dependencies installed: `uv sync`
- Check `PORT` is set in `.env`

**Authentication errors on tool calls:**
- Confirm `JWT_SECRET` and `JWT_ALGORITHM` match the Backend API and AI Engine
- Ensure the `Authorization: Bearer <jwt>` header is included in requests

**Tool execution failures:**
- Check container logs for error messages
- Verify `AI_ENGINE_BASE_URL` is reachable from the MCP Server
- Confirm the user has valid credentials stored in the AI Engine for the relevant platform

**Dynamic tools not registering:**
- Check AI Engine is reachable at startup (`AI_ENGINE_BASE_URL`)
- Check `GET /api/v1/workflow-template/` returns templates
- Non-fatal: the server starts even if workflow tool registration fails
