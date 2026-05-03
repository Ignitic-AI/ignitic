# Performance Testing the AI Engine

## Objective
The goal of this performance testing suite is to validate the internal throughput of the FastAPI server, routing logic, and MongoDB connection pooling under high concurrent load. 

To ensure the test remains **cost-free**, we explicitly exclude any LLM execution endpoints (e.g., `/chat`), which would otherwise burn OpenRouter credits and hit third-party API rate limits. 

## Target Endpoints
The performance test is implemented using [k6](https://k6.io/) and targets the following internal CRUD and health endpoints:

1. **`GET /health`** - Validates baseline server availability and response time.
2. **`GET /api/v1/agents/`** - Measures throughput of agent retrieval and tool caching mechanisms.
3. **`GET /api/v1/assets/`** - Validates asset document retrieval.
4. **`GET /api/v1/workflow/`** - Validates workflow template retrieval.
5. **`GET /api/v1/workflow-session/`** - Validates workflow session retrieval.
6. **`GET /api/v1/analytics/agent/runs/`** - Validates MongoDB aggregation pipeline and analytics performance.

## Initial Test Configuration
- **Max VUs (Virtual Users)**: 50
- **Duration**: ~3.5 minutes (ramping up, holding, ramping down)
- **Tooling**: k6 with Web Dashboard enabled

## First Run Results & Discovered Issues

During our first major load test with 50 VUs, we observed a severe bottleneck at the `GET /api/v1/agents/` endpoint.

### Threshold Failures
- **`http_req_duration`**: `p(95) = 59.95s` (Target was `< 500ms`)
- **`http_req_failed`**: `rate = 10.00%` (Target was `< 1%`)

### Metrics Summary
```text
  █ TOTAL RESULTS
    checks_total.......: 589    2.995821/s
    checks_succeeded...: 83.19% 490 out of 589
    checks_failed......: 16.80% 99 out of 589

    ✓ GET /health status is 200
    ✗ GET /api/v1/agents status is 200
      ↳  10% — ✓ 11 / ✗ 99
    ✓ GET /api/v1/assets status is 200
    ✓ GET /api/v1/workflow status is 200
    ✓ GET /api/v1/workflow-session status is 200
    ✓ GET /api/v1/analytics status is 200

    HTTP
    http_req_duration..............: avg=8.6s  min=509.9µs med=2.18s max=1m0s   p(90)=17.55s p(95)=59.95s
      { expected_response:true }...: avg=2.94s min=509.9µs med=1.34s max=13.12s p(90)=8.47s  p(95)=10.51s
    http_req_failed................: 10.00% 99 out of 990
    http_reqs......................: 990    5.03542/s
```

### The Problem: The "Thundering Herd"
The timeout errors on the `GET /api/v1/agents/` endpoint were caused by a classic "Thundering Herd" problem. 
When the k6 script ramped up, 50 Virtual Users hit the `/api/v1/agents/` endpoint simultaneously. This endpoint queries an internal MCP (Model Context Protocol) Server to list the tools available to each agent.

While there was an in-memory cache implemented (`_TOOLS_CACHE`), it was completely empty on the very first request. Because all 50 concurrent requests checked the cache at the exact same millisecond, they all saw an empty cache. This caused the FastAPI server to fire off 50 concurrent HTTP requests to the MCP Server simultaneously. The MCP server became overwhelmed and failed to respond in time, resulting in the 60-second HTTP request timeouts reported by k6.

### The Resolution
To fix this, we implemented a **Double-Checked Locking Pattern** using `asyncio.Lock` keyed by the `server_name` in `services/agents/mcp_client.py`:

```python
# Fast path: check cache without lock
if server_name in _TOOLS_CACHE:
    # return cached tools...

# Get or create lock for this server
if server_name not in _TOOLS_CACHE_LOCKS:
    _TOOLS_CACHE_LOCKS[server_name] = asyncio.Lock()
    
lock = _TOOLS_CACHE_LOCKS[server_name]

async with lock:
    # Check cache again inside the lock (in case another task populated it)
    if server_name in _TOOLS_CACHE:
        # return cached tools...
            
    # Fetch fresh data from MCP server
    tools = await self._client.get_tools(server_name=server_name)
    # Update cache...
```

**Why this works:**
When 50 concurrent requests hit the server, only the *first* request acquires the lock and queries the MCP Server. The other 49 requests safely wait at the lock. Once the first request finishes and populates the cache, the lock is released. The remaining requests then acquire the lock one by one, immediately find the populated data in the cache, and return the cached tools without hammering the MCP server.

## Final Run Results

After implementing the `asyncio.Lock` to resolve the thundering herd issue, we observed a **100% success rate** and a massive increase in throughput.

### Key Improvements
- **Success Rate**: `100%` (Up from 83.19%)
- **Request Failures**: `0` (Down from 99)
- **Throughput**: `129.2 reqs/s` (Up from 5.03 reqs/s)
- **Avg. Request Duration**: `194.41ms` (Down from 8.6s)
- **p(95) Request Duration**: `747.03ms` (Down from 59.95s)

### Metrics Summary (Run #2)
```text
  █ TOTAL RESULTS
    checks_total.......: 14250   77.547554/s
    checks_succeeded...: 100.00% 14250 out of 14250
    checks_failed......: 0.00%   0 out of 14250

    ✓ GET /health status is 200
    ✓ GET /api/v1/agents status is 200
    ✓ GET /api/v1/assets status is 200
    ✓ GET /api/v1/workflow status is 200
    ✓ GET /api/v1/workflow-session status is 200
    ✓ GET /api/v1/analytics status is 200

    HTTP
    http_req_duration..............: avg=194.41ms min=0s    med=68.45ms max=27.38s p(90)=466.93ms p(95)=747.03ms
    http_req_failed................: 0.00%  0 out of 23750
    http_reqs......................: 23750  129.245924/s
```

### Conclusion
The performance testing suite successfully identified a critical concurrency bottleneck in our MCP tool retrieval logic. By implementing a locking mechanism for the in-memory cache, we effectively mitigated the "Thundering Herd" problem, allowing the system to handle 50 concurrent users with zero failures and significantly improved latency. 

While the p(95) duration (747ms) still slightly exceeds our aggressive 500ms threshold under peak load (50 VUs), the system remains stable and reliable.
