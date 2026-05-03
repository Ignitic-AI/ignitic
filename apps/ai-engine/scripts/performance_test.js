import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";
import exec from 'k6/execution';

export const options = {
  scenarios: {
    ramping_vus: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 }, // Stage 1: ramp up to 50 VUs over 30s
        { duration: '2m', target: 50 },  // Stage 2: hold at 50 VUs for 2m
        { duration: '30s', target: 0 },  // Stage 3: ramp down to 0 over 30s
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests must be < 1000ms
    http_req_failed: ['rate<0.01'],   // failure rate must be < 1%
  },
};

export function setup() {
  const token = __ENV.JWT_TOKEN;
  if (!token) {
    console.warn("JWT_TOKEN environment variable is not set!");
  }
  return { token: token };
}

export default function (data) {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:8010';
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.token}`,
    },
  };

  // Group 1: GET /health
  let resHealth = http.get(`${baseUrl}/health`);
  check(resHealth, {
    'GET /health status is 200': (r) => r.status === 200,
  });

  // Group 2: GET /api/v1/agents
  let resGetAgents = http.get(`${baseUrl}/api/v1/agents`, params);
  check(resGetAgents, {
    'GET /api/v1/agents status is 200': (r) => r.status === 200,
  });

  // Group 3: GET /api/v1/assets (List Assets)
  let resGetAssets = http.get(`${baseUrl}/api/v1/assets`, params);
  check(resGetAssets, {
    'GET /api/v1/assets status is 200': (r) => r.status === 200,
  });

  // Group 4: GET /api/v1/workflow (Get Workflows)
  let resGetWorkflows = http.get(`${baseUrl}/api/v1/workflow`, params);
  check(resGetWorkflows, {
    'GET /api/v1/workflow status is 200': (r) => r.status === 200,
  });

  // Group 5: GET /api/v1/workflow-session (List User Sessions)
  let resGetSessions = http.get(`${baseUrl}/api/v1/workflow-session`, params);
  check(resGetSessions, {
    'GET /api/v1/workflow-session status is 200': (r) => r.status === 200,
  });

  // Group 6: GET /api/v1/analytics/agent/runs (Get Analytics)
  let resGetAnalytics = http.get(`${baseUrl}/api/v1/analytics/agent/runs`, params);
  check(resGetAnalytics, {
    'GET /api/v1/analytics status is 200': (r) => r.status === 200,
  });

  // Random sleep between 0.5 and 2 seconds
  sleep(Math.random() * 1.5 + 0.5);
}

export function handleSummary(data) {
  return {
    "report.html": htmlReport(data),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}
