"""
Unit tests for utils/n8n_workflow_summary.py – workflow summarisation helpers.
"""

import pytest
from utils.n8n_workflow_summary import (
    summarize_n8n_json,
    summary_line_from_description,
    enrich_template_dict,
    _norm,
    _type_suffix,
    _humanize_suffix,
    _is_workflow_logic_node,
    _label_and_domain,
    _n8n_to_dict,
)


# ── _norm ─────────────────────────────────────────────────────────────
class TestNorm:
    def test_lowercase_and_strip(self):
        assert _norm("OpenAI-API") == "openaiapi"

    def test_empty(self):
        assert _norm("") == ""

    def test_none(self):
        assert _norm(None) == ""


# ── _type_suffix ──────────────────────────────────────────────────────
class TestTypeSuffix:
    def test_n8n_type(self):
        assert _type_suffix("n8n-nodes-base.googleSheets") == "googleSheets"

    def test_langchain_type(self):
        assert _type_suffix("@n8n/n8n-nodes-langchain.lmChatOpenAi") == "lmChatOpenAi"

    def test_no_dot(self):
        assert _type_suffix("code") == "code"

    def test_empty(self):
        assert _type_suffix("") == ""


# ── _humanize_suffix ─────────────────────────────────────────────────
class TestHumanizeSuffix:
    def test_camel_case(self):
        assert _humanize_suffix("googleSheets") == "Google Sheets"

    def test_underscores(self):
        assert _humanize_suffix("split_in_batches") == "Split In Batches"

    def test_empty(self):
        assert _humanize_suffix("") == "Step"


# ── _is_workflow_logic_node ──────────────────────────────────────────
class TestIsWorkflowLogicNode:
    def test_if_is_logic(self):
        assert _is_workflow_logic_node("n8n-nodes-base.if") is True

    def test_google_sheets_is_not_logic(self):
        assert _is_workflow_logic_node("n8n-nodes-base.googleSheets") is False

    def test_code_is_logic(self):
        assert _is_workflow_logic_node("n8n-nodes-base.code") is True


# ── _label_and_domain ────────────────────────────────────────────────
class TestLabelAndDomain:
    def test_known_override(self):
        label, domain = _label_and_domain("n8n-nodes-base.googleSheets")
        assert label == "Google Sheets"
        assert domain == "google.com"

    def test_unknown_type(self):
        label, domain = _label_and_domain("n8n-nodes-base.myCustomNode")
        assert label == "My Custom Node"
        assert domain is None

    def test_empty_type(self):
        label, domain = _label_and_domain("")
        assert label == "Step"
        assert domain is None


# ── _n8n_to_dict ─────────────────────────────────────────────────────
class TestN8nToDict:
    def test_dict_passthrough(self):
        assert _n8n_to_dict({"nodes": []}) == {"nodes": []}

    def test_json_string(self):
        import json
        assert _n8n_to_dict(json.dumps({"a": 1})) == {"a": 1}

    def test_none(self):
        assert _n8n_to_dict(None) == {}

    def test_invalid_string(self):
        assert _n8n_to_dict("not json") == {}


# ── summary_line_from_description ────────────────────────────────────
class TestSummaryLine:
    def test_first_sentence(self):
        desc = "Automates lead capture. Then enriches the data."
        assert summary_line_from_description(desc) == "Automates lead capture."

    def test_truncation(self):
        desc = "A" * 200
        line = summary_line_from_description(desc)
        assert len(line) <= 140

    def test_empty(self):
        assert summary_line_from_description("") == ""

    def test_none(self):
        assert summary_line_from_description(None) == ""


# ── summarize_n8n_json ───────────────────────────────────────────────
class TestSummarizeN8nJson:
    def test_empty_nodes(self):
        result = summarize_n8n_json({"nodes": []})
        assert result["integrations"] == []
        assert result["flow_steps"] == []
        # Empty nodes → no raw_nodes → trigger_hint is None
        assert result["trigger_hint"] is None
        assert result["integration_count"] == 0

    def test_webhook_trigger_detected(self):
        result = summarize_n8n_json({
            "nodes": [{"type": "n8n-nodes-base.webhook"}]
        })
        assert result["trigger_hint"] == "Webhook"

    def test_schedule_trigger_detected(self):
        result = summarize_n8n_json({
            "nodes": [{"type": "n8n-nodes-base.scheduleTrigger"}]
        })
        assert result["trigger_hint"] == "Scheduled"

    def test_google_sheets_integration(self):
        result = summarize_n8n_json({
            "nodes": [{"type": "n8n-nodes-base.googleSheets"}]
        })
        assert any(i["label"] == "Google Sheets" for i in result["integrations"])

    def test_disabled_nodes_skipped(self):
        result = summarize_n8n_json({
            "nodes": [
                {"type": "n8n-nodes-base.googleSheets", "disabled": True},
            ]
        })
        assert result["integrations"] == []

    def test_skip_types_ignored(self):
        result = summarize_n8n_json({
            "nodes": [{"type": "n8n-nodes-base.stickyNote"}]
        })
        assert result["integrations"] == []

    def test_credential_integration(self):
        result = summarize_n8n_json({
            "nodes": [
                {
                    "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi",
                    "credentials": {"openAiApi": {"id": "1"}},
                },
            ]
        })
        assert any("OpenAI" in i["label"] for i in result["integrations"])

    def test_none_input(self):
        result = summarize_n8n_json(None)
        assert result["integrations"] == []
        assert result["trigger_hint"] is None


# ── enrich_template_dict ─────────────────────────────────────────────
class TestEnrichTemplateDict:
    def test_enriches_fields(self):
        data = {
            "description": "Automates lead capture.",
            "n8n_json": {"nodes": [{"type": "n8n-nodes-base.googleSheets"}]},
        }
        enriched = enrich_template_dict(data)
        assert "summary_line" in enriched
        assert "integrations" in enriched
        assert "flow_steps" in enriched
        assert "trigger_hint" in enriched
        assert "integration_count" in enriched
        # Original keys preserved
        assert enriched["description"] == "Automates lead capture."
