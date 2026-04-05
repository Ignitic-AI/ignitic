"""LangChain @tool wrappers mirroring Business Analyst MCP tools."""

from __future__ import annotations

import json
from typing import Optional

from langchain_core.tools import tool

from services.agents.tools.business_analyst_tools.calculators import (
    apply_financial_scenarios,
    compound_growth,
    compute_landed_unit_cost,
    compute_unit_economics,
    estimate_tam_revenue,
    summarize_price_series,
    weighted_option_matrix,
)


@tool("ba_unit_economics_breakeven", return_direct=False)
def ba_unit_economics_breakeven(
    selling_price: float,
    variable_cost_per_unit: float,
    monthly_fixed_costs: float,
    units_sold_per_month: Optional[float] = None,
) -> str:
    """Contribution margin, breakeven units, optional monthly profit. User numbers only; no APIs."""
    return json.dumps(
        compute_unit_economics(
            selling_price=selling_price,
            variable_cost_per_unit=variable_cost_per_unit,
            monthly_fixed_costs=monthly_fixed_costs,
            units_sold_per_month=units_sold_per_month,
        ),
        ensure_ascii=False,
    )


@tool("ba_price_series_summary", return_direct=False)
def ba_price_series_summary(prices_text: str) -> str:
    """Summary stats for pasted price lists (comma-separated or free text with numbers)."""
    return json.dumps(summarize_price_series(prices_text), ensure_ascii=False)


@tool("ba_landed_unit_cost", return_direct=False)
def ba_landed_unit_cost(
    ex_works_unit_cost: float,
    freight_per_unit: float = 0.0,
    duty_rate_pct: float = 0.0,
    insurance_rate_pct: float = 0.0,
    handling_per_unit: float = 0.0,
) -> str:
    """Simplified landed cost per unit (duty/insurance on ex-works + freight)."""
    return json.dumps(
        compute_landed_unit_cost(
            ex_works_unit_cost=ex_works_unit_cost,
            freight_per_unit=freight_per_unit,
            duty_rate_pct=duty_rate_pct,
            insurance_rate_pct=insurance_rate_pct,
            handling_per_unit=handling_per_unit,
        ),
        ensure_ascii=False,
    )


@tool("ba_tam_from_assumptions", return_direct=False)
def ba_tam_from_assumptions(
    addressable_units: float,
    adoption_rate_pct: float,
    average_revenue_per_unit: float,
) -> str:
    """TAM revenue = addressable_units × adoption % × ARPU (user-defined units)."""
    return json.dumps(
        estimate_tam_revenue(
            addressable_units=addressable_units,
            adoption_rate_pct=adoption_rate_pct,
            average_revenue_per_unit=average_revenue_per_unit,
        ),
        ensure_ascii=False,
    )


@tool("ba_financial_scenario_grid", return_direct=False)
def ba_financial_scenario_grid(base_json: str, scenarios_json: str) -> str:
    """Operating-profit grid from JSON base + JSON scenario deltas (revenue_mult, cost ratio, fixed)."""
    return json.dumps(
        apply_financial_scenarios(base_json, scenarios_json),
        ensure_ascii=False,
    )


@tool("ba_weighted_decision_matrix", return_direct=False)
def ba_weighted_decision_matrix(criteria_json: str) -> str:
    """Normalized weighted scores across options (JSON criteria with weights and per-option scores)."""
    return json.dumps(weighted_option_matrix(criteria_json), ensure_ascii=False)


@tool("ba_compound_growth_projection", return_direct=False)
def ba_compound_growth_projection(
    starting_value: float,
    periods: int,
    growth_rate_pct_per_period: float,
) -> str:
    """Compound growth: ending_value = start × (1 + r)^periods."""
    return json.dumps(
        compound_growth(starting_value, periods, growth_rate_pct_per_period),
        ensure_ascii=False,
    )


AGENT_TOOLS = {
    "business_analyst_agent": [
        ba_unit_economics_breakeven,
        ba_price_series_summary,
        ba_landed_unit_cost,
        ba_tam_from_assumptions,
        ba_financial_scenario_grid,
        ba_weighted_decision_matrix,
        ba_compound_growth_projection,
    ],
}
