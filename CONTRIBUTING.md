# Contributing to Ignitic

Thanks for helping build Ignitic. This guide covers how to set up the repo, make a change and get it merged.

## Ways to contribute

- **Report bugs** and **request features** through [issues](https://github.com/Ignitic-AI/ignitic/issues/new/choose).
- **Improve docs** — setup gaps, typos and missing examples are all welcome.
- **Add MCP tools or integrations** — see [Adding New Tools](apps/mcp/README.md#adding-new-tools).
- **Pick up an issue** labeled [`good first issue`](https://github.com/Ignitic-AI/ignitic/labels/good%20first%20issue) or [`help wanted`](https://github.com/Ignitic-AI/ignitic/labels/help%20wanted).

For large changes (new agents, schema changes, new services), open an issue first so we can agree on the approach before you invest the time.

## Repository layout

| Path | Stack | Toolchain |
|------|-------|-----------|
| `apps/frontend` | Next.js 15, TypeScript | Node 20, npm |
| `apps/backend` | Go 1.23, Gin, PostgreSQL | Go 1.23 (CGO for SQLite tests) |
| `apps/ai-engine` | Python 3.12, FastAPI, LangGraph | [uv](https://docs.astral.sh/uv/) |
| `apps/mcp` | Python 3.12, FastMCP | uv |

## Development setup

1. Fork and clone the repo.
2. Start the infrastructure:

   ```bash
   cp .env.example .env
   docker compose up -d postgres redis rabbitmq mongo neo4j
   ```

3. Run the app(s) you're working on natively. Each app has a `.env.example` preconfigured for `localhost`:

   ```bash
   # Backend
   cd apps/backend && cp .env.example .env && go run .

   # AI Engine
   cd apps/ai-engine && cp .env.example .env && uv sync --extra test && uv run python main.py

   # MCP server
   cd apps/mcp && cp .env.example .env && uv sync && uv run python main.py

   # Frontend
   cd apps/frontend && cp .env.example .env.local && npm ci && npm run dev
   ```

   Or run everything in containers with `docker compose up -d --build`.

## Checks

Run the checks for every app you touched before opening a PR. CI runs the same commands.

| App | Command |
|-----|---------|
| Frontend | `npm run lint && npx tsc --noEmit && npm test && npm run build` |
| Backend | `go vet ./... && go build ./... && go test ./tests/unit/...` |
| AI Engine | `uv run pytest tests/unit` |
| MCP | `uv run pytest tests/servers` |
| Python lint | `uvx ruff check apps/ai-engine apps/mcp --select E9,F63,F7,F82` |

MCP live integration tests call real third-party APIs and are skipped unless `RUN_LIVE_INTEGRATION=1`.

## Making a change

1. Create a branch from `main`: `feat/<short-name>`, `fix/<short-name>` or `docs/<short-name>`.
2. Keep PRs focused — one logical change per PR. Split refactors from behavior changes.
3. Add or update tests for behavior changes.
4. Update the relevant README or `docs/` when you change setup, config, APIs or env variables. New env variables go in the app's `.env.example` and, if the container needs them, in the root `.env.example` and `docker-compose.yml`.
5. Never commit secrets, `.env` files, customer data or generated reports.

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) with the app as scope:

```
feat(mcp): add Klaviyo list tools
fix(backend): return 404 for missing organization invite
docs(ai-engine): document Neo4j configuration
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`, `chore`.

### Code style

- **Go** — `gofmt`; follow the existing `api/<domain>/{router,service}.go` layout.
- **Python** — follow the existing service-layer patterns; type hints on public functions; async I/O in request paths.
- **TypeScript** — ESLint config in `apps/frontend`; UI conventions in [`apps/frontend/docs/styles.md`](apps/frontend/docs/styles.md).

## Pull requests

- Fill in the PR template, link the issue (`Closes #123`) and include screenshots for UI changes.
- CI must be green. A maintainer will review; please respond to feedback or tell us if you need a hand.
- PRs are squash-merged, so the PR title should be a good Conventional Commit message.

## Licensing of contributions

By submitting a contribution you agree that it is licensed under the project's [LICENSE](LICENSE), including its additional conditions, and that you have the right to submit it.

## Getting help

Open a [discussion](https://github.com/Ignitic-AI/ignitic/discussions) or comment on the issue you're working on. Please follow our [Code of Conduct](CODE_OF_CONDUCT.md).
