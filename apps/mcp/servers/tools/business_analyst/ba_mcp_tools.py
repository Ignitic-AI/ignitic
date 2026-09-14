"""MCP entrypoints for business analyst calculators (import ai-engine calculators)."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Optional

_MCP_DIR = Path(__file__).resolve().parents[3]
_OUTER_AI_ENGINE = _MCP_DIR.parent
_AI_ENGINE_SRC = _OUTER_AI_ENGINE / "ai-engine"
if _AI_ENGINE_SRC.is_dir() and str(_AI_ENGINE_SRC) not in sys.path:
    sys.path.append(str(_AI_ENGINE_SRC))

from services.agents.tools.business_analyst_tools.calculators import (  # noqa: E402
    apply_financial_scenarios,
    compound_growth,
    compute_landed_unit_cost,
    compute_unit_economics,
    estimate_tam_revenue,
    summarize_price_series,
    weighted_option_matrix,
)


def ba_unit_economics_breakeven(
    selling_price: float,
    variable_cost_per_unit: float,
    monthly_fixed_costs: float,
    units_sold_per_month: Optional[float] = None,
) -> str:
    """
    Contribution margin, CM%, monthly breakeven units, optional operating profit.
    All currency-agnostic; uses user-supplied numbers only (no APIs).

    Args:
        selling_price: Retail or net selling price per unit.
        variable_cost_per_unit: COGS + commissions + variable logistics per unit.
        monthly_fixed_costs: Rent, salaries, tooling amortization, etc. for a month.
        units_sold_per_month: If set, returns estimated monthly operating profit.
    """
    out = compute_unit_economics(
        selling_price=selling_price,
        variable_cost_per_unit=variable_cost_per_unit,
        monthly_fixed_costs=monthly_fixed_costs,
        units_sold_per_month=units_sold_per_month,
    )
    return json.dumps(out, ensure_ascii=False)


def ba_price_series_summary(prices_text: str) -> str:
    """
    Descriptive stats (min, max, mean, median, quartiles, stdev) from pasted numbers.
    Accepts comma-separated lists, multi-line pastes, or text with embedded prices.

    Args:
        prices_text: Raw string containing numeric prices (e.g. from a sheet or scrape).
    """
    return json.dumps(summarize_price_series(prices_text), ensure_ascii=False)


def ba_landed_unit_cost(
    ex_works_unit_cost: float,
    freight_per_unit: float = 0.0,
    duty_rate_pct: float = 0.0,
    insurance_rate_pct: float = 0.0,
    handling_per_unit: float = 0.0,
) -> str:
    """
    Simplified landed cost per unit from ex-works + freight + duty/insurance % + handling.
    Duty/insurance bases are (ex_works + freight)—a teaching simplification.
    """
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


def ba_tam_from_assumptions(
    addressable_units: float,
    adoption_rate_pct: float,
    average_revenue_per_unit: float,
) -> str:
    """
    TAM revenue from addressable_units * adoption% * average revenue per buying unit.
    Units can be people, firms, households—caller defines the denominator.
    """
    return json.dumps(
        estimate_tam_revenue(
            addressable_units=addressable_units,
            adoption_rate_pct=adoption_rate_pct,
            average_revenue_per_unit=average_revenue_per_unit,
        ),
        ensure_ascii=False,
    )


def ba_financial_scenario_grid(base_json: str, scenarios_json: str) -> str:
    """
    Compare operating profit under revenue / cost / fixed-cost scenarios.

    base_json example:
        {"monthly_revenue": 100000, "variable_cost_ratio": 0.55, "fixed_costs": 20000}

    scenarios_json example:
        [{"name": "revenue_down_10", "revenue_mult": 0.9},
         {"name": "margin_squeeze", "variable_cost_ratio_delta": 0.05}]
    """
    return json.dumps(
        apply_financial_scenarios(base_json, scenarios_json),
        ensure_ascii=False,
    )


def ba_weighted_decision_matrix(criteria_json: str) -> str:
    """
    Multi-criteria scoring with normalized weights.

    criteria_json example:
        [{"criterion": "Cost", "weight": 0.4, "scores": {"SupplierA": 8, "SupplierB": 6}},
         {"criterion": "Lead_time", "weight": 0.6, "scores": {"SupplierA": 5, "SupplierB": 9}}]
    Scores should be 0-10; weights are normalized to sum to 1 automatically.
    """
    return json.dumps(weighted_option_matrix(criteria_json), ensure_ascii=False)


def ba_compound_growth_projection(
    starting_value: float,
    periods: int,
    growth_rate_pct_per_period: float,
) -> str:
    """
    Ending value after discrete compounding each period (e.g. CAGR-style checks).

    Args:
        starting_value: Base amount (revenue, cost, units, etc.).
        periods: Number of compounding steps (e.g. years).
        growth_rate_pct_per_period: Percent growth each step (5 means +5% per period).
    """
    return json.dumps(
        compound_growth(starting_value, periods, growth_rate_pct_per_period),
        ensure_ascii=False,
    )


TARGET_AGENTS = ["business_analyst_agent"]
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
