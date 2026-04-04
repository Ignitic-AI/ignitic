"""
Derive UI-friendly summaries from n8n workflow JSON (integrations, short line, flow steps).
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional, Set

_SKIP_TYPES: Set[str] = {
    "n8n-nodes-base.webhook",
    "n8n-nodes-base.respondToWebhook",
    "n8n-nodes-base.stickyNote",
    "n8n-nodes-base.noOp",
    "n8n-nodes-base.start",
    "n8n-nodes-base.executeWorkflowTrigger",
    "@n8n/n8n-nodes-langchain.toolThink",
    "@n8n/n8n-nodes-langchain.toolCalculator",
}

# Node type suffixes that are n8n control-flow / data shaping — not "integrations" for UI.
_WORKFLOW_LOGIC_SUFFIXES: Set[str] = {
    "if",
    "switch",
    "set",
    "merge",
    "code",
    "splitInBatches",
    "aggregate",
    "sort",
    "limit",
    "wait",
    "itemLists",
    "itemList",
    "removeDuplicates",
    "duplicate",
    "compareDatabases",
    "compression",
    "crypto",
    "dateTime",
    "editImage",
    "executeWorkflow",
    "executionData",
    "filter",
    "html",
    "xml",
    "markdown",
    "renameKeys",
    "splitOut",
    "summarize",
    "extractFromFile",
    "convertToFile",
    "moveBinaryData",
    "readBinaryFile",
    "writeBinaryFile",
    "readWriteFile",
    "readPDF",
    "htmlExtract",
    "xmlParse",
    "jq",
    "rssFeedRead",
    "rssFeedCreate",
    "httpRequest",
    # LangChain / AI plumbing (vendor appears via credentials or lmChat* / openAi nodes)
    "agentTool",
    "toolCode",
    "toolHttpRequest",
    "toolWorkflow",
    "toolVectorStore",
    "textSplitter",
    "documentDefaultDataLoader",
    "documentBinaryInputLoader",
    "chainLlm",
    "chainSummarization",
    "chainRetrievalQa",
    "informationExtractor",
    "outputParserStructured",
    "outputParserAutofixing",
    "structuredOutputParser",
    "retrieverMultiQuery",
    "vectorStoreInMemory",
    "memoryBufferWindow",
    "memoryChat",
    "toolCalculator",
    "toolThink",
    "lmChain",
    "reranker",
}

_TYPE_OVERRIDES: Dict[str, tuple[str, Optional[str]]] = {
    "openAi": ("OpenAI", "openai.com"),
    "openai": ("OpenAI", "openai.com"),
    "chatOpenAi": ("OpenAI", "openai.com"),
    "openAiAssistant": ("OpenAI Assistant", "openai.com"),
    "lmChatOpenAi": ("OpenAI", "openai.com"),
    "lmChatAnthropic": ("Anthropic", "anthropic.com"),
    "anthropic": ("Anthropic", "anthropic.com"),
    "googleSheets": ("Google Sheets", "google.com"),
    "googleDrive": ("Google Drive", "google.com"),
    "gmail": ("Gmail", "google.com"),
    "googleCalendar": ("Google Calendar", "google.com"),
    "googleBigQuery": ("BigQuery", "google.com"),
    "googleAds": ("Google Ads", "google.com"),
    "slack": ("Slack", "slack.com"),
    "notion": ("Notion", "notion.so"),
    "airtable": ("Airtable", "airtable.com"),
    "hubspot": ("HubSpot", "hubspot.com"),
    "shopify": ("Shopify", "shopify.com"),
    "stripe": ("Stripe", "stripe.com"),
    "twilio": ("Twilio", "twilio.com"),
    "httpRequest": ("HTTP Request", None),
    "code": ("Code", None),
    "set": ("Set", None),
    "merge": ("Merge", None),
    "if": ("If", None),
    "switch": ("Switch", None),
    "splitInBatches": ("Loop", None),
    "agent": ("AI Agent", None),
    "toolAgent": ("AI Agent", None),
    "emailSend": ("Email (SMTP)", None),
    "microsoftOutlook": ("Microsoft Outlook", "microsoft.com"),
    "microsoftTeams": ("Microsoft Teams", "microsoft.com"),
    "discord": ("Discord", "discord.com"),
    "telegram": ("Telegram", "telegram.org"),
    "twitter": ("X / Twitter", "x.com"),
    "linkedIn": ("LinkedIn", "linkedin.com"),
    "facebookGraphApi": ("Facebook", "facebook.com"),
    "instagram": ("Instagram", "instagram.com"),
    "woocommerce": ("WooCommerce", "woocommerce.com"),
    "mysql": ("MySQL", None),
    "postgres": ("PostgreSQL", None),
    "mongoDb": ("MongoDB", "mongodb.com"),
    "redis": ("Redis", "redis.io"),
    "webhook": ("Webhook", None),
    "respondToWebhook": ("Respond to Webhook", None),
}

_CREDENTIAL_OVERRIDES: Dict[str, tuple[str, Optional[str]]] = {
    "openaiapi": ("OpenAI", "openai.com"),
    "anthropicapi": ("Anthropic", "anthropic.com"),
    "geminiapi": ("Google Gemini", "google.com"),
    "googlesheetsoauth2api": ("Google Sheets", "google.com"),
    "googledriveoauth2api": ("Google Drive", "google.com"),
    "gmailoauth2": ("Gmail", "google.com"),
    "googletasksoauth2api": ("Google Tasks", "google.com"),
    "slackapi": ("Slack", "slack.com"),
    "notionapi": ("Notion", "notion.so"),
    "hubspotprivateapp": ("HubSpot", "hubspot.com"),
    "hubspotoauth2api": ("HubSpot", "hubspot.com"),
    "shopifyoauth2api": ("Shopify", "shopify.com"),
    "shopifyaccesstokenapi": ("Shopify", "shopify.com"),
    "stripeapi": ("Stripe", "stripe.com"),
    "twilioapi": ("Twilio", "twilio.com"),
    "airtabletokenapi": ("Airtable", "airtable.com"),
    "facebookgraphapi": ("Facebook", "facebook.com"),
    "mailchimpapi": ("Mailchimp", "mailchimp.com"),
    "sendinblueapi": ("Brevo", "brevo.com"),
    "microsoftoutlookoauth2api": ("Microsoft Outlook", "microsoft.com"),
    "microsoftteamsoauth2api": ("Microsoft Teams", "microsoft.com"),
    "discordapi": ("Discord", "discord.com"),
    "telegramapi": ("Telegram", "telegram.org"),
    "xapi": ("X / Twitter", "x.com"),
}

_CREDENTIAL_BRAND_HINTS: List[tuple[str, str, Optional[str]]] = [
    ("openai", "OpenAI", "openai.com"),
    ("anthropic", "Anthropic", "anthropic.com"),
    ("gemini", "Google Gemini", "google.com"),
    ("google", "Google", "google.com"),
    ("slack", "Slack", "slack.com"),
    ("notion", "Notion", "notion.so"),
    ("airtable", "Airtable", "airtable.com"),
    ("hubspot", "HubSpot", "hubspot.com"),
    ("shopify", "Shopify", "shopify.com"),
    ("stripe", "Stripe", "stripe.com"),
    ("twilio", "Twilio", "twilio.com"),
    ("mailchimp", "Mailchimp", "mailchimp.com"),
    ("sendinblue", "Brevo", "brevo.com"),
    ("brevo", "Brevo", "brevo.com"),
    ("outlook", "Microsoft Outlook", "microsoft.com"),
    ("microsoft", "Microsoft", "microsoft.com"),
    ("discord", "Discord", "discord.com"),
    ("telegram", "Telegram", "telegram.org"),
    ("twitter", "X / Twitter", "x.com"),
    ("linkedin", "LinkedIn", "linkedin.com"),
    ("facebook", "Facebook", "facebook.com"),
]


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower())


def _n8n_to_dict(n8n_json: Any) -> Dict[str, Any]:
    if n8n_json is None:
        return {}
    if hasattr(n8n_json, "model_dump"):
        return n8n_json.model_dump(mode="python")
    if isinstance(n8n_json, dict):
        return n8n_json
    if isinstance(n8n_json, str):
        try:
            parsed = json.loads(n8n_json)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


def _humanize_suffix(suffix: str) -> str:
    s = re.sub(r"([a-z])([A-Z])", r"\1 \2", suffix)
    return s.replace("_", " ").strip().title() or "Step"


def _type_suffix(node_type: str) -> str:
    if not node_type:
        return ""
    suffix = node_type.split(".")[-1] if "." in node_type else node_type
    if "langchain." in node_type:
        suffix = node_type.split("langchain.")[-1]
    return suffix


def _is_workflow_logic_node(node_type: str) -> bool:
    return _type_suffix(node_type) in _WORKFLOW_LOGIC_SUFFIXES


def _label_and_domain(node_type: str) -> tuple[str, Optional[str]]:
    if not node_type:
        return "Step", None
    suffix = _type_suffix(node_type)
    if suffix in _TYPE_OVERRIDES:
        return _TYPE_OVERRIDES[suffix]
    return _humanize_suffix(suffix), None


def _integration_key(node_type: str) -> str:
    if not node_type:
        return "unknown"
    if "langchain." in node_type:
        return "langchain:" + node_type.split("langchain.")[-1]
    if "." in node_type:
        return node_type.split(".", 1)[-1]
    return node_type


def _label_and_domain_from_credential_key(cred_key: str) -> tuple[str, Optional[str]]:
    raw = (cred_key or "").strip()
    if not raw:
        return "Integration", None
    norm = _norm(raw)
    if norm in _CREDENTIAL_OVERRIDES:
        return _CREDENTIAL_OVERRIDES[norm]
    for needle, label, domain in _CREDENTIAL_BRAND_HINTS:
        if needle in norm:
            return label, domain
    cleaned = re.sub(
        r"(oauth2?|api|token|private|app|credential|credentials|key)+$",
        "",
        raw,
        flags=re.IGNORECASE,
    )
    return _humanize_suffix(cleaned or raw), None


def _extract_node_credential_keys(node: Dict[str, Any]) -> List[str]:
    creds = node.get("credentials")
    if not isinstance(creds, dict):
        return []
    return [str(k).strip() for k in creds.keys() if str(k).strip()]


def _append_integration(
    integrations: List[Dict[str, Optional[str]]],
    seen: Set[str],
    key: str,
    label: str,
    domain: Optional[str],
    node_type: str,
) -> None:
    if key in seen:
        return
    seen.add(key)
    integrations.append(
        {
            "id": key,
            "label": label,
            "domain": domain,
            "node_type": node_type,
        }
    )


def summary_line_from_description(description: str, max_len: int = 140) -> str:
    if not description or not str(description).strip():
        return ""
    text = str(description).strip()
    line = text.split("\n")[0].strip()
    parts = re.split(r"(?<=[.!?])\s+", line, maxsplit=1)
    line = parts[0] if parts else line
    if len(line) > max_len:
        line = line[: max_len - 1].rstrip() + "…"
    return line


def summarize_n8n_json(n8n_json: Any) -> Dict[str, Any]:
    """
    Returns keys: integrations, flow_steps, trigger_hint, integration_count
    """
    data = _n8n_to_dict(n8n_json)
    raw_nodes: List[Dict[str, Any]] = data.get("nodes") or []
    if not raw_nodes and isinstance(data.get("workflow"), dict):
        raw_nodes = data["workflow"].get("nodes") or []
    integrations: List[Dict[str, Optional[str]]] = []
    seen: Set[str] = set()
    flow_steps: List[str] = []
    trigger_hint: Optional[str] = None

    for node in raw_nodes:
        if not isinstance(node, dict):
            continue
        if node.get("disabled"):
            continue
        ntype = (node.get("type") or "").strip()
        if not ntype:
            continue
        if ntype in ("n8n-nodes-base.webhook",):
            trigger_hint = trigger_hint or "Webhook"
            continue
        if ntype == "n8n-nodes-base.manualTrigger":
            trigger_hint = trigger_hint or "Manual"
            continue
        if ntype in ("n8n-nodes-base.scheduleTrigger", "n8n-nodes-base.cron"):
            trigger_hint = trigger_hint or "Scheduled"
            continue
        if ntype in _SKIP_TYPES:
            continue

        credential_labels: List[str] = []
        for cred_key in _extract_node_credential_keys(node):
            c_label, c_domain = _label_and_domain_from_credential_key(cred_key)
            c_key = f"credential:{_norm(cred_key)}"
            _append_integration(integrations, seen, c_key, c_label, c_domain, ntype)
            credential_labels.append(c_label)

        label, domain = _label_and_domain(ntype)
        key = _integration_key(ntype)
        logic_only = _is_workflow_logic_node(ntype)

        # Type-based chip only for real services / known app nodes — skip If, Set, Aggregate, parsers, etc.
        if not logic_only:
            if domain or not credential_labels:
                _append_integration(integrations, seen, key, label, domain, ntype)

        if len(flow_steps) < 8:
            if credential_labels:
                flow_steps.append(credential_labels[0])
            elif not logic_only:
                flow_steps.append(label)

    return {
        "integrations": integrations[:12],
        "flow_steps": flow_steps,
        "trigger_hint": trigger_hint or ("Manual" if raw_nodes else None),
        "integration_count": len(integrations),
    }


def enrich_template_dict(data: Dict[str, Any]) -> Dict[str, Any]:
    """Attach summary_line + n8n_ui summary fields to a template JSON dict."""
    desc = data.get("description") or ""
    summary = summarize_n8n_json(data.get("n8n_json"))
    summary_line = summary_line_from_description(desc)
    return {
        **data,
        "summary_line": summary_line,
        "integrations": summary["integrations"],
        "flow_steps": summary["flow_steps"],
        "trigger_hint": summary["trigger_hint"],
        "integration_count": summary["integration_count"],
    }
