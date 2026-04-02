"""
Custom MCP server.

Exposes a broad set of tools so that user-created (custom) agents can choose
which tools they want to enable.

The AI Engine will fetch tools from this MCP server at `/custom`.
"""

from fastmcp import FastMCP

from servers.middlewares import AuthenticationMiddleware, ExecutionLoggingMiddleware

# Re-export existing tools from the prebuilt MCP servers
from servers.tools.product_researcher.product_google_dork import google_dork_search
from servers.tools.product_researcher.apify_amazon_search import apify_amazon_search
from servers.tools.product_researcher.apify_ebay_scraper import apify_ebay_search
from servers.tools.product_researcher.google_trends import google_trends
from servers.tools.product_researcher.shopify_product_scraper import shopify_product_scraper

from servers.tools.social_media_marketing.twitter_trends import twitter_trends
from servers.tools.social_media_marketing.tiktok_trends import tiktok_trends
from servers.tools.advertising.facebook_ads_scraper import facebook_ads_scraper

from servers.tools.Seo.site_domain_authority_seo import site_domain_authority_seo
from servers.tools.Seo.meta_tags_scraper_seo import meta_tags_scraper_seo

from servers.tools.google_drive import (
    copy_file,
    create_folder,
    create_text_file,
    delete_file,
    get_file_metadata,
    list_files,
    list_permissions,
    move_file,
    read_file_content,
    remove_permission,
    search_files,
    share_file,
    update_file_content,
)

from servers.tools.crm.shopify.products import (
    create_product,
    delete_product,
    get_product_by_id,
    get_products,
    publish_product,
    unpublish_product,
)

from servers.tools.crm.hubspot.association_tools import (
    hubspot_associations_archive_batch,
    hubspot_associations_create_batch,
    hubspot_associations_read_batch,
    hubspot_association_labels_list,
)
from servers.tools.crm.hubspot.crm_tools import (
    hubspot_contacts_merge,
    hubspot_crm_archive,
    hubspot_crm_batch_archive,
    hubspot_crm_batch_create,
    hubspot_crm_batch_read,
    hubspot_crm_batch_update,
    hubspot_crm_batch_upsert,
    hubspot_crm_create,
    hubspot_crm_get,
    hubspot_crm_properties_list,
    hubspot_crm_search,
    hubspot_crm_update,
    hubspot_custom_object_schemas,
    hubspot_deal_pipelines,
    hubspot_owners_list,
    hubspot_ticket_pipelines,
)
from servers.tools.crm.hubspot.extended_tools import (
    hubspot_communication_preferences_definitions,
    hubspot_communication_preferences_statuses_get,
    hubspot_companies_merge,
    hubspot_crm_pipelines_list,
    hubspot_file_get,
    hubspot_files_search,
    hubspot_folder_get,
    hubspot_forms_list,
    hubspot_list_get,
    hubspot_list_memberships_add_remove,
    hubspot_list_memberships_join_order,
    hubspot_list_record_memberships,
    hubspot_lists_search,
    hubspot_marketing_emails_list,
)

from servers.tools.social_media_marketing.facebook_pages import (
    create_post,
    get_page_posts,
    delete_post,
    post_image,
    get_post_comments,
    get_number_of_comments,
    reply_to_comment,
    get_number_of_likes,
)

from servers.tools.social_media_marketing.instagram import (
    get_profile_info,
    get_media_posts,
    get_media_insights,
    publish_media,
)

# Email Marketing tools — Brevo
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

# Email Marketing tools — Mailchimp
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

from servers.tools.reviews.trustpilot_scraper import (
    trustpilot_scrape_reviews,
    trustpilot_get_company_stats,
    trustpilot_analyze_sentiment,
)

from servers.tools.customer_support.zendesk.tools import (
    zendesk_list_tickets,
    zendesk_get_ticket,
    zendesk_create_ticket,
    zendesk_update_ticket,
    zendesk_close_ticket,
    zendesk_reopen_ticket,
    zendesk_get_ticket_comments,
    zendesk_add_comment,
    zendesk_get_user,
    zendesk_get_user_by_email,
    zendesk_get_user_tickets,
    zendesk_search_tickets,
    zendesk_list_views,
    zendesk_get_view_tickets,
    zendesk_get_ticket_metrics,
)


app = FastMCP("Custom MCP", streamable_http_path="/")

# Product Researcher tools
app.tool(google_dork_search, meta={"ignitic_identifier": "tools.product_researcher.google_dork_search"})
app.tool(apify_amazon_search, meta={"ignitic_identifier": "tools.product_researcher.apify_amazon_search"})
app.tool(apify_ebay_search, meta={"ignitic_identifier": "tools.product_researcher.apify_ebay_search"})
app.tool(google_trends, meta={"ignitic_identifier": "tools.product_researcher.google_trends"})
app.tool(shopify_product_scraper, meta={"ignitic_identifier": "tools.product_researcher.shopify_product_scraper"})

# Marketer tools
app.tool(twitter_trends, meta={"ignitic_identifier": "tools.marketer.twitter_trends"})
app.tool(tiktok_trends, meta={"ignitic_identifier": "tools.marketer.tiktok_trends"})
app.tool(facebook_ads_scraper, meta={"ignitic_identifier": "tools.marketer.facebook_ads_scraper"})
app.tool(site_domain_authority_seo, meta={"ignitic_identifier": "tools.marketer.site_domain_authority_seo"})

# SEO tools
app.tool(site_domain_authority_seo, meta={"ignitic_identifier": "tools.seo_agent.site_domain_authority_seo"})
app.tool(meta_tags_scraper_seo, meta={"ignitic_identifier": "tools.seo_agent.meta_tags_scraper_seo"})
app.tool(shopify_product_scraper, meta={"ignitic_identifier": "tools.seo_agent.shopify_product_scraper"})

# Shopify tools
app.tool(create_product, meta={"ignitic_identifier": "tools.shopify_agent.create_product"})
app.tool(get_product_by_id, meta={"ignitic_identifier": "tools.shopify_agent.get_product_by_id"})
app.tool(get_products, meta={"ignitic_identifier": "tools.shopify_agent.get_products"})
app.tool(delete_product, meta={"ignitic_identifier": "tools.shopify_agent.delete_product"})
app.tool(publish_product, meta={"ignitic_identifier": "tools.shopify_agent.publish_product"})
app.tool(unpublish_product, meta={"ignitic_identifier": "tools.shopify_agent.unpublish_product"})

# HubSpot CRM tools
app.tool(hubspot_crm_search, meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_crm_search"})
app.tool(hubspot_crm_get, meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_crm_get"})
app.tool(hubspot_crm_create, meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_crm_create"})
app.tool(hubspot_crm_update, meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_crm_update"})
app.tool(hubspot_crm_archive, meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_crm_archive"})
app.tool(
    hubspot_crm_batch_read,
    meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_crm_batch_read"},
)
app.tool(
    hubspot_crm_batch_create,
    meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_crm_batch_create"},
)
app.tool(
    hubspot_crm_batch_update,
    meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_crm_batch_update"},
)
app.tool(
    hubspot_crm_batch_archive,
    meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_crm_batch_archive"},
)
app.tool(
    hubspot_crm_batch_upsert,
    meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_crm_batch_upsert"},
)
app.tool(
    hubspot_contacts_merge,
    meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_contacts_merge"},
)
app.tool(
    hubspot_crm_properties_list,
    meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_crm_properties_list"},
)
app.tool(
    hubspot_deal_pipelines,
    meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_deal_pipelines"},
)
app.tool(
    hubspot_ticket_pipelines,
    meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_ticket_pipelines"},
)
app.tool(
    hubspot_owners_list,
    meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_owners_list"},
)
app.tool(
    hubspot_custom_object_schemas,
    meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_custom_object_schemas"},
)
app.tool(
    hubspot_association_labels_list,
    meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_association_labels_list"},
)
app.tool(
    hubspot_associations_create_batch,
    meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_associations_create_batch"},
)
app.tool(
    hubspot_associations_read_batch,
    meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_associations_read_batch"},
)
app.tool(
    hubspot_associations_archive_batch,
    meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_associations_archive_batch"},
)
app.tool(
    hubspot_companies_merge,
    meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_companies_merge"},
)
app.tool(hubspot_lists_search, meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_lists_search"})
app.tool(hubspot_list_get, meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_list_get"})
app.tool(
    hubspot_list_memberships_join_order,
    meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_list_memberships_join_order"},
)
app.tool(
    hubspot_list_memberships_add_remove,
    meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_list_memberships_add_remove"},
)
app.tool(
    hubspot_list_record_memberships,
    meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_list_record_memberships"},
)
app.tool(hubspot_files_search, meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_files_search"})
app.tool(hubspot_file_get, meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_file_get"})
app.tool(hubspot_folder_get, meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_folder_get"})
app.tool(hubspot_forms_list, meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_forms_list"})
app.tool(
    hubspot_communication_preferences_definitions,
    meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_communication_preferences_definitions"},
)
app.tool(
    hubspot_communication_preferences_statuses_get,
    meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_communication_preferences_statuses_get"},
)
app.tool(
    hubspot_crm_pipelines_list,
    meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_crm_pipelines_list"},
)
app.tool(
    hubspot_marketing_emails_list,
    meta={"ignitic_identifier": "tools.hubspot_agent.hubspot_marketing_emails_list"},
)

# Google Drive tools
app.tool(search_files, meta={"ignitic_identifier": "tools.gdrive_agent.search_files"})
app.tool(list_files, meta={"ignitic_identifier": "tools.gdrive_agent.list_files"})
app.tool(get_file_metadata, meta={"ignitic_identifier": "tools.gdrive_agent.get_file_metadata"})
app.tool(read_file_content, meta={"ignitic_identifier": "tools.gdrive_agent.read_file_content"})
app.tool(delete_file, meta={"ignitic_identifier": "tools.gdrive_agent.delete_file"})
app.tool(copy_file, meta={"ignitic_identifier": "tools.gdrive_agent.copy_file"})
app.tool(move_file, meta={"ignitic_identifier": "tools.gdrive_agent.move_file"})
app.tool(create_folder, meta={"ignitic_identifier": "tools.gdrive_agent.create_folder"})
app.tool(create_text_file, meta={"ignitic_identifier": "tools.gdrive_agent.create_text_file"})
app.tool(update_file_content, meta={"ignitic_identifier": "tools.gdrive_agent.update_file_content"})
app.tool(share_file, meta={"ignitic_identifier": "tools.gdrive_agent.share_file"})
app.tool(list_permissions, meta={"ignitic_identifier": "tools.gdrive_agent.list_permissions"})
app.tool(remove_permission, meta={"ignitic_identifier": "tools.gdrive_agent.remove_permission"})

# Facebook Page tools
app.tool(create_post, meta={"ignitic_identifier": "tools.facebook_page_agent.create_post"})
app.tool(get_page_posts, meta={"ignitic_identifier": "tools.facebook_page_agent.get_page_posts"})
app.tool(delete_post, meta={"ignitic_identifier": "tools.facebook_page_agent.delete_post"})
app.tool(post_image, meta={"ignitic_identifier": "tools.facebook_page_agent.post_image"})
app.tool(get_post_comments, meta={"ignitic_identifier": "tools.facebook_page_agent.get_post_comments"})
app.tool(get_number_of_comments, meta={"ignitic_identifier": "tools.facebook_page_agent.get_number_of_comments"})
app.tool(reply_to_comment, meta={"ignitic_identifier": "tools.facebook_page_agent.reply_to_comment"})
app.tool(get_number_of_likes, meta={"ignitic_identifier": "tools.facebook_page_agent.get_number_of_likes"})

# Instagram tools
app.tool(get_profile_info, meta={"ignitic_identifier": "tools.instagram_agent.get_profile_info"})
app.tool(get_media_posts, meta={"ignitic_identifier": "tools.instagram_agent.get_media_posts"})
app.tool(get_media_insights, meta={"ignitic_identifier": "tools.instagram_agent.get_media_insights"})
app.tool(publish_media, meta={"ignitic_identifier": "tools.instagram_agent.publish_media"})

# Email Marketing tools — Brevo
app.tool(brevo_get_account_info, meta={"ignitic_identifier": "tools.email_marketing_agent.brevo_get_account_info"})
app.tool(brevo_get_contacts, meta={"ignitic_identifier": "tools.email_marketing_agent.brevo_get_contacts"})
app.tool(brevo_create_contact, meta={"ignitic_identifier": "tools.email_marketing_agent.brevo_create_contact"})
app.tool(brevo_update_contact, meta={"ignitic_identifier": "tools.email_marketing_agent.brevo_update_contact"})
app.tool(brevo_delete_contact, meta={"ignitic_identifier": "tools.email_marketing_agent.brevo_delete_contact"})
app.tool(brevo_list_contact_lists, meta={"ignitic_identifier": "tools.email_marketing_agent.brevo_list_contact_lists"})
app.tool(brevo_create_contact_list, meta={"ignitic_identifier": "tools.email_marketing_agent.brevo_create_contact_list"})
app.tool(brevo_add_contacts_to_list, meta={"ignitic_identifier": "tools.email_marketing_agent.brevo_add_contacts_to_list"})
app.tool(brevo_remove_contacts_from_list, meta={"ignitic_identifier": "tools.email_marketing_agent.brevo_remove_contacts_from_list"})
app.tool(brevo_list_campaigns, meta={"ignitic_identifier": "tools.email_marketing_agent.brevo_list_campaigns"})
app.tool(brevo_get_campaign, meta={"ignitic_identifier": "tools.email_marketing_agent.brevo_get_campaign"})
app.tool(brevo_create_campaign, meta={"ignitic_identifier": "tools.email_marketing_agent.brevo_create_campaign"})
app.tool(brevo_send_campaign_now, meta={"ignitic_identifier": "tools.email_marketing_agent.brevo_send_campaign_now"})
app.tool(brevo_schedule_campaign, meta={"ignitic_identifier": "tools.email_marketing_agent.brevo_schedule_campaign"})
app.tool(brevo_get_campaign_stats, meta={"ignitic_identifier": "tools.email_marketing_agent.brevo_get_campaign_stats"})
app.tool(brevo_delete_campaign, meta={"ignitic_identifier": "tools.email_marketing_agent.brevo_delete_campaign"})
app.tool(brevo_send_transactional_email, meta={"ignitic_identifier": "tools.email_marketing_agent.brevo_send_transactional_email"})
app.tool(brevo_list_templates, meta={"ignitic_identifier": "tools.email_marketing_agent.brevo_list_templates"})
app.tool(brevo_get_template, meta={"ignitic_identifier": "tools.email_marketing_agent.brevo_get_template"})
app.tool(brevo_get_smtp_events, meta={"ignitic_identifier": "tools.email_marketing_agent.brevo_get_smtp_events"})

# Email Marketing tools — Mailchimp
app.tool(mailchimp_ping, meta={"ignitic_identifier": "tools.email_marketing_agent.mailchimp_ping"})
app.tool(mailchimp_get_account_info, meta={"ignitic_identifier": "tools.email_marketing_agent.mailchimp_get_account_info"})
app.tool(mailchimp_list_audiences, meta={"ignitic_identifier": "tools.email_marketing_agent.mailchimp_list_audiences"})
app.tool(mailchimp_get_audience, meta={"ignitic_identifier": "tools.email_marketing_agent.mailchimp_get_audience"})
app.tool(mailchimp_list_members, meta={"ignitic_identifier": "tools.email_marketing_agent.mailchimp_list_members"})
app.tool(mailchimp_get_member, meta={"ignitic_identifier": "tools.email_marketing_agent.mailchimp_get_member"})
app.tool(mailchimp_add_member, meta={"ignitic_identifier": "tools.email_marketing_agent.mailchimp_add_member"})
app.tool(mailchimp_update_member, meta={"ignitic_identifier": "tools.email_marketing_agent.mailchimp_update_member"})
app.tool(mailchimp_archive_member, meta={"ignitic_identifier": "tools.email_marketing_agent.mailchimp_archive_member"})
app.tool(mailchimp_search_members, meta={"ignitic_identifier": "tools.email_marketing_agent.mailchimp_search_members"})
app.tool(mailchimp_list_campaigns, meta={"ignitic_identifier": "tools.email_marketing_agent.mailchimp_list_campaigns"})
app.tool(mailchimp_get_campaign, meta={"ignitic_identifier": "tools.email_marketing_agent.mailchimp_get_campaign"})
app.tool(mailchimp_create_campaign, meta={"ignitic_identifier": "tools.email_marketing_agent.mailchimp_create_campaign"})
app.tool(mailchimp_set_campaign_content, meta={"ignitic_identifier": "tools.email_marketing_agent.mailchimp_set_campaign_content"})
app.tool(mailchimp_send_campaign, meta={"ignitic_identifier": "tools.email_marketing_agent.mailchimp_send_campaign"})
app.tool(mailchimp_schedule_campaign, meta={"ignitic_identifier": "tools.email_marketing_agent.mailchimp_schedule_campaign"})
app.tool(mailchimp_unschedule_campaign, meta={"ignitic_identifier": "tools.email_marketing_agent.mailchimp_unschedule_campaign"})
app.tool(mailchimp_delete_campaign, meta={"ignitic_identifier": "tools.email_marketing_agent.mailchimp_delete_campaign"})
app.tool(mailchimp_get_campaign_report, meta={"ignitic_identifier": "tools.email_marketing_agent.mailchimp_get_campaign_report"})
app.tool(mailchimp_list_campaign_reports, meta={"ignitic_identifier": "tools.email_marketing_agent.mailchimp_list_campaign_reports"})
app.tool(mailchimp_add_tags_to_member, meta={"ignitic_identifier": "tools.email_marketing_agent.mailchimp_add_tags_to_member"})
app.tool(mailchimp_remove_tags_from_member, meta={"ignitic_identifier": "tools.email_marketing_agent.mailchimp_remove_tags_from_member"})

app.tool(trustpilot_scrape_reviews, meta={"ignitic_identifier": "tools.trustpilot.trustpilot_scrape_reviews"})
app.tool(trustpilot_get_company_stats, meta={"ignitic_identifier": "tools.trustpilot.trustpilot_get_company_stats"})
app.tool(trustpilot_analyze_sentiment, meta={"ignitic_identifier": "tools.trustpilot.trustpilot_analyze_sentiment"})

app.tool(zendesk_list_tickets, meta={"ignitic_identifier": "tools.customer_support_agent.zendesk_list_tickets"})
app.tool(zendesk_get_ticket, meta={"ignitic_identifier": "tools.customer_support_agent.zendesk_get_ticket"})
app.tool(zendesk_create_ticket, meta={"ignitic_identifier": "tools.customer_support_agent.zendesk_create_ticket"})
app.tool(zendesk_update_ticket, meta={"ignitic_identifier": "tools.customer_support_agent.zendesk_update_ticket"})
app.tool(zendesk_close_ticket, meta={"ignitic_identifier": "tools.customer_support_agent.zendesk_close_ticket"})
app.tool(zendesk_reopen_ticket, meta={"ignitic_identifier": "tools.customer_support_agent.zendesk_reopen_ticket"})
app.tool(zendesk_get_ticket_comments, meta={"ignitic_identifier": "tools.customer_support_agent.zendesk_get_ticket_comments"})
app.tool(zendesk_add_comment, meta={"ignitic_identifier": "tools.customer_support_agent.zendesk_add_comment"})
app.tool(zendesk_get_user, meta={"ignitic_identifier": "tools.customer_support_agent.zendesk_get_user"})
app.tool(zendesk_get_user_by_email, meta={"ignitic_identifier": "tools.customer_support_agent.zendesk_get_user_by_email"})
app.tool(zendesk_get_user_tickets, meta={"ignitic_identifier": "tools.customer_support_agent.zendesk_get_user_tickets"})
app.tool(zendesk_search_tickets, meta={"ignitic_identifier": "tools.customer_support_agent.zendesk_search_tickets"})
app.tool(zendesk_list_views, meta={"ignitic_identifier": "tools.customer_support_agent.zendesk_list_views"})
app.tool(zendesk_get_view_tickets, meta={"ignitic_identifier": "tools.customer_support_agent.zendesk_get_view_tickets"})
app.tool(zendesk_get_ticket_metrics, meta={"ignitic_identifier": "tools.customer_support_agent.zendesk_get_ticket_metrics"})

# Middleware
app.add_middleware(AuthenticationMiddleware())
app.add_middleware(ExecutionLoggingMiddleware())

