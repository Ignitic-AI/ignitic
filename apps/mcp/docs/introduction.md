# Ignitic AI MCP Server — Project Introduction

## Overview

The **Ignitic AI MCP Server** is the tool-exposure layer of the Ignitic AI platform. It implements the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) using the **FastMCP** framework and exposes a collection of domain-specific tool servers that AI agents (running in the AI Engine) call to interact with third-party services.

Each MCP server is a focused, independently mountable application providing tools for a single domain (e.g., Shopify, HubSpot, SEO analysis). All servers are composed into a single Starlette application and served under path-based routes.

---

## Context in the Ignitic Architecture

```
AI Engine (FastAPI + LangGraph)
        │
        │  HTTP (Streamable HTTP Transport)
        ▼
MCP Server (Starlette + FastMCP)
        ├── /product_researcher   ←  Product Research tools
        ├── /business_analyst     ←  Business analysis calculators
        ├── /marketer             ←  Marketing orchestrator tools
        ├── /seo_agent            ←  SEO analysis tools
        ├── /shopify_agent        ←  Shopify management tools
        ├── /hubspot_agent        ←  HubSpot CRM tools
        ├── /gdrive_agent         ←  Google Drive tools
        ├── /facebook_page_agent  ←  Facebook Page tools
        ├── /instagram_agent      ←  Instagram tools
        ├── /email_marketing_agent←  Email campaign tools
        ├── /customer_support_agent← Zendesk tools
        ├── /analytics_agent      ←  Shopify + GA4 analytics
        ├── /meta_ads_agent       ←  Meta Ads tools
        ├── /google_ads_agent     ←  Google Ads tools
        └── /custom               ←  User-defined workflow tools
```

---

## MCP Servers

### Product Researcher (`/product_researcher`)
Tools for market and product research:
- Amazon product search (via Apify)
- eBay product scraping (via Apify)
- Google Dorks advanced search
- Google Trends analysis (via PyTrends)

### Business Analyst (`/business_analyst`)
Tools for commercial analysis (no external API calls):
- Unit economics calculations
- TAM/SAM/SOM estimation
- Scenario grids
- Weighted decision matrices
- Landed-cost estimates

### Marketer (`/marketer`)
Parent orchestrator for social marketing tools:
- Twitter/X trends
- TikTok trends
- Domain authority and SEO metrics
- Facebook Ads scraping

### SEO Agent (`/seo_agent`)
- Domain authority checks
- Keyword analysis
- SEO recommendations

### Shopify Agent (`/shopify_agent`)
Full product management on Shopify:
- `create_product`, `get_products`, `get_product_by_id`
- `delete_product`, `publish_product`, `unpublish_product`

### HubSpot Agent (`/hubspot_agent`)
HubSpot CRM (Developer API):
- Contacts, companies, deals, tickets, notes
- Custom objects, batch APIs, associations
- Pipelines, properties, owners

### Google Drive Agent (`/gdrive_agent`)
- Search files and folders
- Read and write file contents

### Facebook Page Agent (`/facebook_page_agent`)
- Create posts, respond to comments
- Page insights

### Instagram Agent (`/instagram_agent`)
- Create posts, manage captions
- Account insights and engagement

### Email Marketing Agent (`/email_marketing_agent`)
Brevo and Mailchimp:
- Manage contacts and lists
- Create and send campaigns
- Track open/click statistics
- Transactional emails

### Customer Support Agent (`/customer_support_agent`)
Zendesk:
- Handle tickets, respond to customers
- Search tickets, manage customer info
- Track support metrics

### Analytics Agent (`/analytics_agent`)
- Shopify revenue and customer metrics
- Google Analytics 4 traffic and conversion data

### Meta Ads (`/meta_ads_agent`)
- Campaign management
- Ad set and creative management
- Performance insights

### Google Ads (`/google_ads_agent`)
- Campaign management
- Keyword planning
- Performance reporting

### Custom (`/custom`)
Dynamically registered workflow tools from the AI Engine's deployed n8n workflows. These tools are registered at server startup by calling the AI Engine's workflow template API.

---

## Key Design Decisions

### Multi-Server Architecture
Each domain is an independent FastMCP `app` that can be tested, deployed, or scaled independently. They are composed at the Starlette routing level without coupling their business logic.

### Middleware Pipeline
Every MCP server has two middleware layers applied:

1. **`AuthenticationMiddleware`** — Extracts and stores the `Authorization: Bearer <jwt>` header and optional `X-Chat-ID` header from incoming HTTP requests into the FastMCP request context.

2. **`ExecutionLoggingMiddleware`** — Wraps every tool call to:
   - Log a `ToolExecution` record (status: `running`) to the AI Engine before the call
   - Capture the tool result or error
   - Update the `ToolExecution` record to `succeeded` or `failed` with the response payload

This ensures complete observability for every tool invocation, regardless of which agent triggered it.

### Tool Identification
Each tool registration includes an `ignitic_identifier` metadata field:
```python
app.tool(
    get_products,
    meta={"ignitic_identifier": "tools.shopify_agent.get_products"}
)
```
This identifier propagates to `ToolExecution` records for cross-service tracing.

---

## Technology Stack

| Category | Technology |
|----------|-----------|
| Runtime | Python 3.12 |
| Package manager | `uv` |
| Web framework | Starlette |
| MCP framework | FastMCP 2.x |
| Transport | Streamable HTTP (SSE) |
| Authentication | JWT (PyJWT) |
| External integrations | Shopify SDK, HubSpot API, Google APIs, Meta/Facebook Graph API, Zendesk, Brevo, Mailchimp, Apify |
| Web scraping | BeautifulSoup4, Apify |
| SEO/Trends | PyTrends |
| Containerization | Docker |
| Deployment | Docker / Docker Compose |

---

## Repository Structure

```
mcp/
├── main.py                    # Starlette application entry point
├── core/
│   └── auth.py                # JWT verification helper
├── models/
│   ├── agent.py               # Agent enum (server path names)
│   └── automations/           # Shared automation models
├── servers/
│   ├── __init__.py
│   ├── middlewares.py         # AuthenticationMiddleware + ExecutionLoggingMiddleware
│   ├── product_researcher_mcp.py
│   ├── business_analyst_mcp.py
│   ├── marketer_mcp.py
│   ├── seo_mcp.py
│   ├── shopify_mcp.py
│   ├── hubspot_mcp.py
│   ├── gdrive_mcp.py
│   ├── facebook_page_mcp.py
│   ├── instagram_mcp.py
│   ├── email_marketing_mcp.py
│   ├── customer_support_mcp.py
│   ├── analytics_mcp.py
│   ├── meta_ads_mcp.py
│   ├── google_ads_mcp.py
│   ├── custom_mcp.py
│   └── tools/                 # Tool implementations organized by domain
│       ├── crm/
│       │   ├── shopify/       # Shopify product tools
│       │   └── hubspot/       # HubSpot CRM tools
│       ├── social_media_marketing/
│       ├── advertising/
│       ├── analytics/
│       ├── Seo/
│       ├── product_researcher/
│       ├── business_analyst/
│       ├── customer_support/
│       ├── email_marketing/
│       ├── google_drive/
│       ├── reviews/
│       └── workflow_tools.py  # Dynamic n8n workflow tool registration
├── services/
│   └── ai_engine_client.py    # HTTP client for the AI Engine API
├── utils/
│   ├── dynamic_models.py      # Pydantic model generation for workflow inputs
│   ├── exception_handling.py  # Custom exception types
│   ├── http_client.py         # Shared HTTP client utilities
│   └── lifespan.py            # Combines multiple Starlette lifespans
├── tests/
│   ├── conftest.py
│   ├── servers/               # MCP server unit tests
│   └── integration/           # Live integration tests
├── scripts/
│   ├── run_live_mcp_smoke.py  # Live smoke test runner
│   └── live_tool_payloads.example.json
├── docs/                      # ← This documentation
├── Dockerfile
├── pyproject.toml
└── .env.example
```

---

## Quick Start

```bash
cd apps/mcp/

# Install dependencies
uv sync

# Configure environment
cp .env.example .env
# Edit .env — set JWT_SECRET, JWT_ALGORITHM, AI_ENGINE_BASE_URL, etc.

# Start the server
uv run python main.py
```

The server starts on `http://0.0.0.0:8011` with all MCP servers mounted at their respective paths.
