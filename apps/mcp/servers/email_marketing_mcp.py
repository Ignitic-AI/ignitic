from fastmcp import FastMCP

from servers.middlewares import AuthenticationMiddleware, ExecutionLoggingMiddleware

# Brevo tools
from servers.tools.email_marketing.brevo.tools import (
    brevo_get_account_info,
    brevo_get_contacts,
    brevo_create_contact,
    brevo_update_contact,
    brevo_delete_contact,
    brevo_list_contact_lists,
    brevo_create_contact_list,
    brevo_add_contacts_to_list,
    brevo_remove_contacts_from_list,
    brevo_list_campaigns,
    brevo_get_campaign,
    brevo_create_campaign,
    brevo_send_campaign_now,
    brevo_schedule_campaign,
    brevo_get_campaign_stats,
    brevo_delete_campaign,
    brevo_send_transactional_email,
    brevo_list_templates,
    brevo_get_template,
    brevo_get_smtp_events,
)

# Mailchimp tools
from servers.tools.email_marketing.mailchimp.tools import (
    mailchimp_ping,
    mailchimp_get_account_info,
    mailchimp_list_audiences,
    mailchimp_get_audience,
    mailchimp_list_members,
    mailchimp_get_member,
    mailchimp_add_member,
    mailchimp_update_member,
    mailchimp_archive_member,
    mailchimp_search_members,
    mailchimp_list_campaigns,
    mailchimp_get_campaign,
    mailchimp_create_campaign,
    mailchimp_set_campaign_content,
    mailchimp_send_campaign,
    mailchimp_schedule_campaign,
    mailchimp_unschedule_campaign,
    mailchimp_delete_campaign,
    mailchimp_get_campaign_report,
    mailchimp_list_campaign_reports,
    mailchimp_add_tags_to_member,
    mailchimp_remove_tags_from_member,
)

app = FastMCP("Email Marketing MCP", streamable_http_path="/")

_meta = "ignitic_identifier"

# ---------------------------------------------------------------------------
# Brevo tools
# ---------------------------------------------------------------------------
app.tool(brevo_get_account_info, meta={_meta: "tools.email_marketing_agent.brevo_get_account_info"})
app.tool(brevo_get_contacts, meta={_meta: "tools.email_marketing_agent.brevo_get_contacts"})
app.tool(brevo_create_contact, meta={_meta: "tools.email_marketing_agent.brevo_create_contact"})
app.tool(brevo_update_contact, meta={_meta: "tools.email_marketing_agent.brevo_update_contact"})
app.tool(brevo_delete_contact, meta={_meta: "tools.email_marketing_agent.brevo_delete_contact"})
app.tool(brevo_list_contact_lists, meta={_meta: "tools.email_marketing_agent.brevo_list_contact_lists"})
app.tool(brevo_create_contact_list, meta={_meta: "tools.email_marketing_agent.brevo_create_contact_list"})
app.tool(brevo_add_contacts_to_list, meta={_meta: "tools.email_marketing_agent.brevo_add_contacts_to_list"})
app.tool(brevo_remove_contacts_from_list, meta={_meta: "tools.email_marketing_agent.brevo_remove_contacts_from_list"})
app.tool(brevo_list_campaigns, meta={_meta: "tools.email_marketing_agent.brevo_list_campaigns"})
app.tool(brevo_get_campaign, meta={_meta: "tools.email_marketing_agent.brevo_get_campaign"})
app.tool(brevo_create_campaign, meta={_meta: "tools.email_marketing_agent.brevo_create_campaign"})
app.tool(brevo_send_campaign_now, meta={_meta: "tools.email_marketing_agent.brevo_send_campaign_now"})
app.tool(brevo_schedule_campaign, meta={_meta: "tools.email_marketing_agent.brevo_schedule_campaign"})
app.tool(brevo_get_campaign_stats, meta={_meta: "tools.email_marketing_agent.brevo_get_campaign_stats"})
app.tool(brevo_delete_campaign, meta={_meta: "tools.email_marketing_agent.brevo_delete_campaign"})
app.tool(brevo_send_transactional_email, meta={_meta: "tools.email_marketing_agent.brevo_send_transactional_email"})
app.tool(brevo_list_templates, meta={_meta: "tools.email_marketing_agent.brevo_list_templates"})
app.tool(brevo_get_template, meta={_meta: "tools.email_marketing_agent.brevo_get_template"})
app.tool(brevo_get_smtp_events, meta={_meta: "tools.email_marketing_agent.brevo_get_smtp_events"})

# ---------------------------------------------------------------------------
# Mailchimp tools
# ---------------------------------------------------------------------------
app.tool(mailchimp_ping, meta={_meta: "tools.email_marketing_agent.mailchimp_ping"})
app.tool(mailchimp_get_account_info, meta={_meta: "tools.email_marketing_agent.mailchimp_get_account_info"})
app.tool(mailchimp_list_audiences, meta={_meta: "tools.email_marketing_agent.mailchimp_list_audiences"})
app.tool(mailchimp_get_audience, meta={_meta: "tools.email_marketing_agent.mailchimp_get_audience"})
app.tool(mailchimp_list_members, meta={_meta: "tools.email_marketing_agent.mailchimp_list_members"})
app.tool(mailchimp_get_member, meta={_meta: "tools.email_marketing_agent.mailchimp_get_member"})
app.tool(mailchimp_add_member, meta={_meta: "tools.email_marketing_agent.mailchimp_add_member"})
app.tool(mailchimp_update_member, meta={_meta: "tools.email_marketing_agent.mailchimp_update_member"})
app.tool(mailchimp_archive_member, meta={_meta: "tools.email_marketing_agent.mailchimp_archive_member"})
app.tool(mailchimp_search_members, meta={_meta: "tools.email_marketing_agent.mailchimp_search_members"})
app.tool(mailchimp_list_campaigns, meta={_meta: "tools.email_marketing_agent.mailchimp_list_campaigns"})
app.tool(mailchimp_get_campaign, meta={_meta: "tools.email_marketing_agent.mailchimp_get_campaign"})
app.tool(mailchimp_create_campaign, meta={_meta: "tools.email_marketing_agent.mailchimp_create_campaign"})
app.tool(mailchimp_set_campaign_content, meta={_meta: "tools.email_marketing_agent.mailchimp_set_campaign_content"})
app.tool(mailchimp_send_campaign, meta={_meta: "tools.email_marketing_agent.mailchimp_send_campaign"})
app.tool(mailchimp_schedule_campaign, meta={_meta: "tools.email_marketing_agent.mailchimp_schedule_campaign"})
app.tool(mailchimp_unschedule_campaign, meta={_meta: "tools.email_marketing_agent.mailchimp_unschedule_campaign"})
app.tool(mailchimp_delete_campaign, meta={_meta: "tools.email_marketing_agent.mailchimp_delete_campaign"})
app.tool(mailchimp_get_campaign_report, meta={_meta: "tools.email_marketing_agent.mailchimp_get_campaign_report"})
app.tool(mailchimp_list_campaign_reports, meta={_meta: "tools.email_marketing_agent.mailchimp_list_campaign_reports"})
app.tool(mailchimp_add_tags_to_member, meta={_meta: "tools.email_marketing_agent.mailchimp_add_tags_to_member"})
app.tool(mailchimp_remove_tags_from_member, meta={_meta: "tools.email_marketing_agent.mailchimp_remove_tags_from_member"})

app.add_middleware(AuthenticationMiddleware())
app.add_middleware(ExecutionLoggingMiddleware())
