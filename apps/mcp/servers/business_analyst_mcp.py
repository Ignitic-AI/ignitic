from fastmcp import FastMCP

from servers.middlewares import AuthenticationMiddleware, ExecutionLoggingMiddleware
from servers.tools.business_analyst.ba_mcp_tools import (
    ba_compound_growth_projection,
    ba_financial_scenario_grid,
    ba_landed_unit_cost,
    ba_price_series_summary,
    ba_tam_from_assumptions,
    ba_unit_economics_breakeven,
    ba_weighted_decision_matrix,
)

app = FastMCP("Business Analyst MCP", streamable_http_path="/")

app.tool(
    ba_unit_economics_breakeven,
    meta={"ignitic_identifier": "tools.business_analyst.ba_unit_economics_breakeven"},
)
app.tool(
    ba_price_series_summary,
    meta={"ignitic_identifier": "tools.business_analyst.ba_price_series_summary"},
)
app.tool(
    ba_landed_unit_cost,
    meta={"ignitic_identifier": "tools.business_analyst.ba_landed_unit_cost"},
)
app.tool(
    ba_tam_from_assumptions,
    meta={"ignitic_identifier": "tools.business_analyst.ba_tam_from_assumptions"},
)
app.tool(
    ba_financial_scenario_grid,
    meta={"ignitic_identifier": "tools.business_analyst.ba_financial_scenario_grid"},
)
app.tool(
    ba_weighted_decision_matrix,
    meta={"ignitic_identifier": "tools.business_analyst.ba_weighted_decision_matrix"},
)
app.tool(
    ba_compound_growth_projection,
    meta={"ignitic_identifier": "tools.business_analyst.ba_compound_growth_projection"},
)

app.add_middleware(AuthenticationMiddleware())
app.add_middleware(ExecutionLoggingMiddleware())
