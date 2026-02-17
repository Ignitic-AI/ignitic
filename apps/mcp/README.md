# Ignitic AI Engine - MCP Server

A comprehensive Model Context Protocol (MCP) server that provides AI-powered marketing and product research capabilities through multiple specialized MCP servers.

## Overview

This project implements a multi-server MCP architecture that exposes powerful tools for:
- **Marketing Intelligence**: Social media trends, advertising insights, and SEO analysis
- **Product Research**: Amazon/eBay product search, Google trends, and advanced web scraping

The system is built using [FastMCP](https://github.com/jlopp/FastMCP) and provides HTTP-based access to all tools through a unified Starlette application.

## Architecture

### Multi-Server Design

The project consists of two main MCP servers:

1. **Product Researcher MCP** (`/product_researcher`)
   - Google Dorks search capability
   - Amazon product search (via Apify)
   - eBay product scraping (via Apify)
   - Google Trends analysis

2. **Marketer MCP** (`/marketer`)
   - Twitter trends monitoring
   - TikTok trends analysis
   - Facebook ads scraping
   - Domain authority and SEO metrics

### Directory Structure

```
.
├── core/                          # Core authentication and utilities
│   └── auth.py                   # JWT authentication
├── models/                        # Data models
│   ├── agent.py                  # Agent type definitions
│   ├── user.py                   # User model
│   └── automations/              # Automation workflows
│       └── n8n/                  # n8n integration
├── servers/                       # MCP server implementations
│   ├── marketer_mcp.py           # Marketing MCP server
│   ├── product_researcher_mcp.py # Product research MCP server
│   └── tools/                    # Tool implementations
│       ├── workflow_tools.py     # Workflow management tools
│       ├── advertising/          # Ad-related tools
│       ├── product_researcher/   # Product search tools
│       ├── Seo/                  # SEO analysis tools
│       └── social_media_marketing/  # Social media tools
├── services/                      # External service integrations
│   └── ai_engine_client.py       # AI Engine API client
├── utils/                         # Utility modules
│   ├── dynamic_models.py         # Dynamic model generation
│   ├── exception_handling.py     # Custom exceptions
│   └── http_client.py            # HTTP client utilities
├── main.py                        # Application entry point
└── pyproject.toml                # Project dependencies
```

## Features

### Marketing Tools
- **Twitter Trends**: Monitor trending topics and hashtags on Twitter
- **TikTok Trends**: Track viral content and trending sounds on TikTok
- **Facebook Ads Scraper**: Extract and analyze Facebook advertising data
- **SEO Metrics**: Analyze domain authority and search engine optimization metrics

### Product Research Tools
- **Google Dorks**: Advanced Google search using specialized search operators
- **Amazon Search**: Search and retrieve product information from Amazon via Apify
- **eBay Scraper**: Scrape product listings and details from eBay via Apify
- **Google Trends**: Analyze search trends and interest over time

## Getting Started

### Prerequisites
- Python 3.12+
- `.env` file with required credentials

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd mcp
```

2. Install dependencies using `uv`:
```bash
uv add -r .\\requirements.txt
```

Or, to sync the project environment (if you use `uv` for environment management):
```bash
uv sync
```

3. Configure environment variables:
Create a `.env` file in the project root:
```env
HOST=0.0.0.0
PORT=8011
DEBUG=false
JWT_SECRET=your_jwt_secret
JWT_ALGORITHM=HS256
```

### Running the Server

Start the server:
```bash
python main.py
```

The server will start on `http://0.0.0.0:8011` and provide:
- Product Researcher MCP at `http://localhost:8011/product_researcher`
- Marketer MCP at `http://localhost:8011/marketer`

### Stopping the Server

**On Windows (PowerShell):**
```bash
.\stop-server.ps1
```

**On Windows (Batch):**
```bash
.\stop-server.bat
```

**On Unix/Linux/macOS:**
```bash
./stop-server.sh
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HOST` | Server host address | `0.0.0.0` |
| `PORT` | Server port | `8011` |
| `DEBUG` | Enable debug mode and auto-reload | `false` |
| `JWT_SECRET` | Secret key for JWT token signing | `` |
| `JWT_ALGORITHM` | Algorithm for JWT token generation | `` |

## API Usage

### Accessing Tools via HTTP

Each MCP server exposes tools that can be called via HTTP endpoints. Tools are automatically documented and accessible through the MCP protocol.

Example structure:
```
POST /product_researcher/<tool_name>
POST /marketer/<tool_name>
```

## Authentication

The system uses JWT-based authentication for securing API endpoints. The `auth.py` module handles:
- Token validation
- User extraction from JWT claims
- Authorization checks

## External Integrations

- **Apify**: Used for Amazon and eBay product searching/scraping
- **n8n**: Workflow automation integration
- **Google APIs**: For trends and advanced search capabilities
- **PyTrends**: For Google Trends analysis
- **BeautifulSoup4**: For web scraping capabilities

## Development

### Adding New Tools

1. Create a tool file in the appropriate subdirectory under `servers/tools/`
2. Implement your tool using the FastMCP framework
3. Import and register the tool in the corresponding MCP server file:
   ```python
   from servers.tools.your_category.your_tool import your_tool_function
   app.tool(your_tool_function)
   ```

### Project Dependencies

Key dependencies include:
- `fastmcp` - MCP server framework
- `starlette` - Web framework
- `pydantic` - Data validation
- `motor` - Async MongoDB driver
- `apify-client` - Apify API client
- `requests` - HTTP library
- `beautifulsoup4` - Web scraping
- `pytrends` - Google Trends scraper

## Logging

The application uses Python's built-in logging module configured to output:
- Level: INFO and above
- Format: `%(asctime)s - %(name)s - %(levelname)s - %(message)s`

## Performance

- **Graceful Shutdown**: 5-second timeout for graceful shutdown
- **Keep-Alive**: 5-second keep-alive timeout for HTTP connections
- **Async Support**: Full async/await support for non-blocking operations

## Troubleshooting

### Server won't start
- Check if port 8011 is already in use
- Verify Python 3.12+ is installed
- Ensure all dependencies are installed: `uv sync`

### Authentication errors
- Verify JWT_SECRET and JWT_ALGORITHM are set in `.env`
- Check token format in Authorization header

### Tool execution failures
- Check logs for specific error messages
- Verify external API credentials (Apify, Google APIs)
- Ensure internet connectivity for external services

## License

[Add your license information here]

## Support

For issues and questions, please create an issue in the repository or contact the development team.
