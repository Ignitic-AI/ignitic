"""
Pure-python business / financial calculators .


"""

from __future__ import annotations

import json
import math
import re
import statistics
from typing import Any, Dict, List, Optional


def _parse_numbers_from_text(text: str) -> List[float]:
    if not text or not str(text).strip():
        return []
    raw = re.findall(r"[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?", str(text))
    out: List[float] = []
    for x in raw:
        try:
            out.append(float(x))
        except ValueError:
            continue
    return out


def compute_unit_economics(
    selling_price: float,
    variable_cost_per_unit: float,
    monthly_fixed_costs: float,
    units_sold_per_month: Optional[float] = None,
) -> Dict[str, Any]:
    """Contribution margin, CM%, breakeven units, optional monthly operating profit."""
    if selling_price <= 0:
        raise ValueError("selling_price must be positive")
    cm = selling_price - variable_cost_per_unit
    cm_pct = (cm / selling_price * 100.0) if selling_price else 0.0
    breakeven_units: Optional[float] = None
    if cm > 0 and monthly_fixed_costs >= 0:
        breakeven_units = math.ceil(monthly_fixed_costs / cm)
    elif cm <= 0:
        breakeven_units = None

    monthly_operating_profit: Optional[float] = None
    if units_sold_per_month is not None and units_sold_per_month >= 0:
        monthly_operating_profit = units_sold_per_month * cm - monthly_fixed_costs

    return {
        "selling_price": round(selling_price, 6),
        "variable_cost_per_unit": round(variable_cost_per_unit, 6),
        "contribution_margin_per_unit": round(cm, 6),
        "contribution_margin_pct": round(cm_pct, 4),
        "monthly_fixed_costs": round(monthly_fixed_costs, 6),
        "breakeven_units_per_month": breakeven_units,
        "units_sold_per_month_input": units_sold_per_month,
        "estimated_monthly_operating_profit": (
            round(monthly_operating_profit, 4)
            if monthly_operating_profit is not None
            else None
        ),
        "notes": (
            "Breakeven assumes a single product with linear unit economics. "
            "If contribution_margin_per_unit <= 0, breakeven is undefined."
        ),
    }


def summarize_price_series(prices_text: str) -> Dict[str, Any]:
    """Parse prices from pasted text (commas, spaces, currency symbols ignored except digits)."""
    vals = _parse_numbers_from_text(prices_text)
    if not vals:
        return {"error": "No numeric prices found in input", "count": 0}

    vals_sorted = sorted(vals)
    n = len(vals)
    mean = statistics.fmean(vals)
    median = statistics.median(vals)
    stdev = statistics.stdev(vals) if n > 1 else 0.0

    def pct(p: float) -> float:
        if n == 1:
            return vals_sorted[0]
        k = (n - 1) * p
        f = math.floor(k)
        c = math.ceil(k)
        if f == c:
            return vals_sorted[int(k)]
        d0 = vals_sorted[f] * (c - k)
        d1 = vals_sorted[c] * (k - f)
        return d0 + d1

    return {
        "count": n,
        "min": round(min(vals), 6),
        "max": round(max(vals), 6),
        "mean": round(mean, 6),
        "median": round(median, 6),
        "stdev": round(stdev, 6),
        "p25": round(pct(0.25), 6),
        "p75": round(pct(0.75), 6),
        "interpretation_hint": (
            "Use with listings pasted from spreadsheets or scrapes. "
            "This is descriptive stats only—not a demand model."
        ),
    }


def compute_landed_unit_cost(
    ex_works_unit_cost: float,
    freight_per_unit: float = 0.0,
    duty_rate_pct: float = 0.0,
    insurance_rate_pct: float = 0.0,
    handling_per_unit: float = 0.0,
) -> Dict[str, Any]:
    """
    Simplified landed cost: duty/insurance applied to (ex_works + freight).
    Rates are percentages (e.g. 5 for 5%).
    """
    if ex_works_unit_cost < 0 or freight_per_unit < 0:
        raise ValueError("Costs must be non-negative")
    cif_like = ex_works_unit_cost + freight_per_unit
    duty = cif_like * (duty_rate_pct / 100.0)
    insurance = cif_like * (insurance_rate_pct / 100.0)
    landed = cif_like + duty + insurance + handling_per_unit
    return {
        "ex_works_unit_cost": round(ex_works_unit_cost, 6),
        "freight_per_unit": round(freight_per_unit, 6),
        "duty_rate_pct": duty_rate_pct,
        "insurance_rate_pct": insurance_rate_pct,
        "handling_per_unit": round(handling_per_unit, 6),
        "estimated_duty_amount": round(duty, 6),
        "estimated_insurance_amount": round(insurance, 6),
        "landed_cost_per_unit": round(landed, 6),
        "assumption": "Duty/insurance base = ex_works + freight (teaching simplification; real customs may differ).",
    }


def estimate_tam_revenue(
    addressable_units: float,
    adoption_rate_pct: float,
    average_revenue_per_unit: float,
) -> Dict[str, Any]:
    """
    TAM-style revenue = addressable_units * (adoption_rate/100) * ARPU.
    addressable_units can be households, professionals, SMBs, etc.—user-defined.
    """
    if addressable_units < 0 or average_revenue_per_unit < 0:
        raise ValueError("addressable_units and average_revenue_per_unit must be non-negative")
    if not 0 <= adoption_rate_pct <= 100:
        raise ValueError("adoption_rate_pct must be between 0 and 100")
    buyers = addressable_units * (adoption_rate_pct / 100.0)
    tam = buyers * average_revenue_per_unit
    return {
        "addressable_units": addressable_units,
        "adoption_rate_pct": adoption_rate_pct,
        "average_revenue_per_unit": round(average_revenue_per_unit, 6),
        "estimated_active_buyers": round(buyers, 6),
        "estimated_tam_revenue": round(tam, 4),
        "notes": "All inputs are user assumptions—validate with independent market data when possible.",
    }


def apply_financial_scenarios(
    base_json: str,
    scenarios_json: str,
) -> Dict[str, Any]:
    """
    base_json keys: monthly_revenue (required), variable_cost_ratio (0-1), fixed_costs (>=0).
    scenarios_json: list of { "name": str, "revenue_mult"?: float, "variable_cost_ratio_delta"?: float,
                            "fixed_costs_delta"?: float }.
    Profit = revenue * (1 - variable_cost_ratio) - fixed_costs (before tax, simplified).
    """
    base = json.loads(base_json)
    scenarios = json.loads(scenarios_json)
    if not isinstance(base, dict) or not isinstance(scenarios, list):
        raise ValueError("base_json must be an object and scenarios_json a list")

    rev = float(base["monthly_revenue"])
    vc_ratio = float(base["variable_cost_ratio"])
    fixed = float(base["fixed_costs"])
    if not 0 <= vc_ratio <= 1:
        raise ValueError("variable_cost_ratio must be between 0 and 1")

    def profit(r: float, v: float, f: float) -> float:
        return r * (1.0 - v) - f

    rows: List[Dict[str, Any]] = [
        {
            "name": "base",
            "monthly_revenue": round(rev, 4),
            "variable_cost_ratio": round(vc_ratio, 6),
            "fixed_costs": round(fixed, 4),
            "monthly_operating_profit": round(profit(rev, vc_ratio, fixed), 4),
        }
    ]

    for sc in scenarios:
        if not isinstance(sc, dict) or "name" not in sc:
            continue
        r_mult = float(sc.get("revenue_mult", 1.0))
        dv = float(sc.get("variable_cost_ratio_delta", 0.0))
        df = float(sc.get("fixed_costs_delta", 0.0))
        r2 = rev * r_mult
        v2 = min(1.0, max(0.0, vc_ratio + dv))
        f2 = max(0.0, fixed + df)
        rows.append(
            {
                "name": sc["name"],
                "monthly_revenue": round(r2, 4),
                "variable_cost_ratio": round(v2, 6),
                "fixed_costs": round(f2, 4),
                "monthly_operating_profit": round(profit(r2, v2, f2), 4),
            }
        )

    return {"currency_agnostic": True, "rows": rows, "formula": "profit = revenue * (1 - variable_cost_ratio) - fixed_costs"}


def weighted_option_matrix(criteria_json: str) -> Dict[str, Any]:
    """
    criteria_json: list of { "criterion": str, "weight": number, "scores": { "OptionA": 0-10, ... } }.
    Weights need not sum to 1; they are normalized before scoring.
    """
    crit = json.loads(criteria_json)
    if not isinstance(crit, list) or not crit:
        raise ValueError("criteria_json must be a non-empty list")

    options: set[str] = set()
    total_w = 0.0
    normalized: List[Dict[str, Any]] = []
    for row in crit:
        if not isinstance(row, dict):
            continue
        name = row.get("criterion") or row.get("name")
        w = float(row.get("weight", 0.0))
        scores = row.get("scores") or {}
        if not isinstance(scores, dict) or name is None:
            continue
        total_w += max(0.0, w)
        normalized.append({"criterion": str(name), "weight": max(0.0, w), "scores": scores})
        options.update(str(k) for k in scores.keys())

    if total_w <= 0:
        raise ValueError("Sum of weights must be positive")

    totals: Dict[str, float] = {o: 0.0 for o in options}
    breakdown: List[Dict[str, Any]] = []
    for row in normalized:
        nw = row["weight"] / total_w
        part: Dict[str, Any] = {"criterion": row["criterion"], "normalized_weight": round(nw, 6)}
        for opt in options:
            raw = float(row["scores"].get(opt, row["scores"].get(str(opt), 0.0)))
            contrib = nw * raw
            totals[opt] = totals.get(opt, 0.0) + contrib
            part[f"score_{opt}"] = raw
            part[f"weighted_{opt}"] = round(contrib, 6)
        breakdown.append(part)

    ranked = sorted(totals.items(), key=lambda x: x[1], reverse=True)
    return {
        "option_totals": {k: round(v, 6) for k, v in totals.items()},
        "ranked": [{"option": k, "total_score": round(v, 6)} for k, v in ranked],
        "breakdown_by_criterion": breakdown,
        "scale": "Higher scores are better; scores are 0-10 per criterion in input.",
    }


def compound_growth(
    starting_value: float,
    periods: int,
    growth_rate_pct_per_period: float,
) -> Dict[str, Any]:
    """Ending value = start * (1 + r/100)^periods (e.g. periods=years for CAGR checks)."""
    if periods < 0:
        raise ValueError("periods must be non-negative")
    r = growth_rate_pct_per_period / 100.0
    ending = starting_value * ((1.0 + r) ** periods)
    cumulative_mult = ((1.0 + r) ** periods) if periods else 1.0
    return {
        "starting_value": starting_value,
        "periods": periods,
        "growth_rate_pct_per_period": growth_rate_pct_per_period,
        "ending_value": round(ending, 6),
        "cumulative_multiplier": round(cumulative_mult, 6),
    }
