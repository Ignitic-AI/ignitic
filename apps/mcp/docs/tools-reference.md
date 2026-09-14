# Tools Reference
# Ignitic AI MCP Server

**Version:** 1.0  
**Status:** Active  
**Last Updated:** 2026-05-03

---

## Overview

The MCP Server exposes **190+ tools** across **15 domain-specific MCP servers**. Every tool is a strongly-typed async Python function registered on a FastMCP application. Each tool carries an `ignitic_identifier` for cross-service tracing and is accessible via the Streamable HTTP transport.

Every tool follows the same invocation model:

```
POST /<agent-path>/<tool-name>
Authorization: Bearer <jwt>
X-Chat-ID: <chat_id>        (optional)
Content-Type: application/json

{ ...tool arguments... }
```

---

## Table of Contents

1. [Product Researcher](#1-product-researcher-product_researcher)
2. [Business Analyst](#2-business-analyst-business_analyst)
3. [Marketer](#3-marketer-marketer)
4. [SEO Agent](#4-seo-agent-seo_agent)
5. [Shopify Agent](#5-shopify-agent-shopify_agent)
6. [HubSpot Agent](#6-hubspot-agent-hubspot_agent)
7. [Google Drive Agent](#7-google-drive-agent-gdrive_agent)
8. [Facebook Page Agent](#8-facebook-page-agent-facebook_page_agent)
9. [Instagram Agent](#9-instagram-agent-instagram_agent)
10. [Email Marketing Agent](#10-email-marketing-agent-email_marketing_agent)
11. [Customer Support Agent](#11-customer-support-agent-customer_support_agent)
12. [Analytics Agent](#12-analytics-agent-analytics_agent)
13. [Meta Ads Agent](#13-meta-ads-agent-meta_ads_agent)
14. [Google Ads Agent](#14-google-ads-agent-google_ads_agent)
15. [Custom Agent](#15-custom-agent-custom)

---

## 1. Product Researcher (`/product_researcher`)

Tools for market and product research across major e-commerce platforms and search engines.

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `google_dork_search` | `tools.product_researcher.google_dork_search` | Perform advanced Google search using dork operators to find products, competitors, pricing, or supplier data. |
| `apify_amazon_search` | `tools.product_researcher.apify_amazon_search` | Search Amazon for products matching a keyword; returns titles, prices, ratings, reviews, and ASINs via Apify. |
| `apify_ebay_search` | `tools.product_researcher.apify_ebay_search` | Scrape eBay product listings for a given search term; returns item data, prices, seller info via Apify. |
| `apify_alibaba_supplier_search` | `tools.product_researcher.apify_alibaba_supplier_search` | Search Alibaba for suppliers matching a product category or keyword via Apify. |
| `apify_alibaba_product_search` | `tools.product_researcher.apify_alibaba_product_search` | Search Alibaba for products with pricing, MOQ, and supplier details via Apify. |
| `apify_aliexpress_search` | `tools.product_researcher.apify_aliexpress_search` | Scrape AliExpress product listings for pricing, ratings, and order counts via Apify. |
| `google_trends` | `tools.product_researcher.google_trends` | Query Google Trends for interest-over-time data for one or more keywords; useful for validating product demand. |
| `shopify_product_scraper` | `tools.product_researcher.shopify_product_scraper` | Scrape publicly available product data (titles, descriptions, pricing) from a competitor's Shopify storefront. |

**External dependencies:** Apify (Amazon, eBay, Alibaba, AliExpress), PyTrends (Google Trends), BeautifulSoup4

---

## 2. Business Analyst (`/business_analyst`)

Pure computational tools — no external API calls. All calculations are performed in-process.

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `ba_unit_economics_breakeven` | `tools.business_analyst.ba_unit_economics_breakeven` | Calculate the break-even point given fixed costs, variable cost per unit, and selling price. |
| `ba_price_series_summary` | `tools.business_analyst.ba_price_series_summary` | Summarise a price series with statistics: mean, median, standard deviation, min, max, and trend direction. |
| `ba_landed_unit_cost` | `tools.business_analyst.ba_landed_unit_cost` | Calculate the total landed cost of a unit including COGS, shipping, duties, and other fees. |
| `ba_tam_from_assumptions` | `tools.business_analyst.ba_tam_from_assumptions` | Estimate Total Addressable Market (TAM), SAM, and SOM from market size assumptions. |
| `ba_financial_scenario_grid` | `tools.business_analyst.ba_financial_scenario_grid` | Build a financial scenario grid by varying two parameters (e.g., price × volume) to show profit/revenue outcomes. |
| `ba_weighted_decision_matrix` | `tools.business_analyst.ba_weighted_decision_matrix` | Score options against weighted criteria to produce a ranked decision matrix. |
| `ba_compound_growth_projection` | `tools.business_analyst.ba_compound_growth_projection` | Project revenue or user growth over N periods at a given CAGR. |

**External dependencies:** None (pure Python / NumPy)

---

## 3. Marketer (`/marketer`)

Social media trend monitoring and competitor advertising intelligence.

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `twitter_trends` | `tools.marketer.twitter_trends` | Retrieve current trending topics and hashtags on X (Twitter) for a given location. |
| `tiktok_trends` | `tools.marketer.tiktok_trends` | Fetch trending sounds, hashtags, and creator trends on TikTok. |
| `facebook_ads_scraper` | `tools.marketer.facebook_ads_scraper` | Scrape publicly visible Facebook Ads Library data for a brand or keyword. |
| `site_domain_authority_seo` | `tools.marketer.site_domain_authority_seo` | Check the domain authority and key SEO metrics for a given website URL. |

**External dependencies:** Apify (Facebook Ads), BeautifulSoup4, SEO data provider

---

## 4. SEO Agent (`/seo_agent`)

On-page and off-page SEO analysis tools.

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `site_domain_authority_seo` | `tools.seo_agent.site_domain_authority_seo` | Retrieve domain authority score and off-page SEO signals for a target domain. |
| `meta_tags_scraper_seo` | `tools.seo_agent.meta_tags_scraper_seo` | Scrape and analyse the meta tags (title, description, Open Graph, canonical) of a given web page URL. |
| `shopify_product_scraper` | `tools.seo_agent.shopify_product_scraper` | Scrape product SEO data (titles, meta descriptions, URL slugs) from a Shopify storefront. |

**External dependencies:** BeautifulSoup4, HTTP scraping

---

## 5. Shopify Agent (`/shopify_agent`)

Full product lifecycle management on Shopify using the Shopify Admin REST API. Credentials are retrieved per-user from the AI Engine at invocation time.

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `create_product` | `tools.shopify_agent.create_product` | Create a new product in the Shopify store with title, description, pricing, and variants. |
| `get_product_by_id` | `tools.shopify_agent.get_product_by_id` | Retrieve full product details by Shopify product ID. |
| `get_products` | `tools.shopify_agent.get_products` | List products in the store with optional pagination and filtering. |
| `delete_product` | `tools.shopify_agent.delete_product` | Permanently delete a product from the Shopify store by ID. |
| `publish_product` | `tools.shopify_agent.publish_product` | Publish a product to the online storefront (set status to `active`). |
| `unpublish_product` | `tools.shopify_agent.unpublish_product` | Unpublish a product from the storefront (set status to `draft`). |

**External dependencies:** Shopify Admin REST API (`shopifyapi` SDK)

---

## 6. HubSpot Agent (`/hubspot_agent`)

Comprehensive HubSpot CRM management using the HubSpot v3 REST API. Includes standard CRM objects, batch operations, associations, lists, and marketing emails.

### CRM Core Tools

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `hubspot_crm_search` | `tools.hubspot_agent.hubspot_crm_search` | Search any CRM object type (contacts, companies, deals, tickets) using HubSpot filter groups. |
| `hubspot_crm_get` | `tools.hubspot_agent.hubspot_crm_get` | Retrieve a single CRM object by ID with selected properties. |
| `hubspot_crm_create` | `tools.hubspot_agent.hubspot_crm_create` | Create a new CRM object (contact, company, deal, ticket, note, etc.). |
| `hubspot_crm_update` | `tools.hubspot_agent.hubspot_crm_update` | Update properties on an existing CRM object. |
| `hubspot_crm_archive` | `tools.hubspot_agent.hubspot_crm_archive` | Soft-delete (archive) a CRM object. |
| `hubspot_crm_properties_list` | `tools.hubspot_agent.hubspot_crm_properties_list` | List all available properties for a CRM object type. |

### CRM Batch Tools

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `hubspot_crm_batch_read` | `tools.hubspot_agent.hubspot_crm_batch_read` | Read up to 100 CRM objects in a single batch request. |
| `hubspot_crm_batch_create` | `tools.hubspot_agent.hubspot_crm_batch_create` | Create multiple CRM objects in a single batch request. |
| `hubspot_crm_batch_update` | `tools.hubspot_agent.hubspot_crm_batch_update` | Update multiple CRM objects in a single batch request. |
| `hubspot_crm_batch_archive` | `tools.hubspot_agent.hubspot_crm_batch_archive` | Archive multiple CRM objects in a single batch request. |
| `hubspot_crm_batch_upsert` | `tools.hubspot_agent.hubspot_crm_batch_upsert` | Upsert (create or update) multiple CRM objects matched by a unique property. |

### Contacts & Companies

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `hubspot_contacts_merge` | `tools.hubspot_agent.hubspot_contacts_merge` | Merge two contact records into one. |
| `hubspot_companies_merge` | `tools.hubspot_agent.hubspot_companies_merge` | Merge two company records into one. |

### Pipelines & Metadata

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `hubspot_deal_pipelines` | `tools.hubspot_agent.hubspot_deal_pipelines` | List all deal pipelines and their stages. |
| `hubspot_ticket_pipelines` | `tools.hubspot_agent.hubspot_ticket_pipelines` | List all ticket pipelines and their stages. |
| `hubspot_crm_pipelines_list` | `tools.hubspot_agent.hubspot_crm_pipelines_list` | List pipelines for any object type. |
| `hubspot_owners_list` | `tools.hubspot_agent.hubspot_owners_list` | List all HubSpot owners (users) in the account. |
| `hubspot_custom_object_schemas` | `tools.hubspot_agent.hubspot_custom_object_schemas` | List custom object schemas defined in the HubSpot account. |

### Associations

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `hubspot_association_labels_list` | `tools.hubspot_agent.hubspot_association_labels_list` | List association labels between two object types. |
| `hubspot_associations_create_batch` | `tools.hubspot_agent.hubspot_associations_create_batch` | Create associations between objects in batch. |
| `hubspot_associations_read_batch` | `tools.hubspot_agent.hubspot_associations_read_batch` | Read associations for a batch of objects. |
| `hubspot_associations_archive_batch` | `tools.hubspot_agent.hubspot_associations_archive_batch` | Delete associations in batch. |

### Lists

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `hubspot_lists_search` | `tools.hubspot_agent.hubspot_lists_search` | Search HubSpot lists by name or filter. |
| `hubspot_list_get` | `tools.hubspot_agent.hubspot_list_get` | Get a list definition and its membership count. |
| `hubspot_list_memberships_join_order` | `tools.hubspot_agent.hubspot_list_memberships_join_order` | Retrieve list memberships in join-order (when contacts joined the list). |
| `hubspot_list_memberships_add_remove` | `tools.hubspot_agent.hubspot_list_memberships_add_remove` | Add or remove contacts from a static list. |
| `hubspot_list_record_memberships` | `tools.hubspot_agent.hubspot_list_record_memberships` | Get all lists that a specific record belongs to. |

### Files & Folders

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `hubspot_files_search` | `tools.hubspot_agent.hubspot_files_search` | Search files in the HubSpot file manager. |
| `hubspot_file_get` | `tools.hubspot_agent.hubspot_file_get` | Get metadata for a specific file. |
| `hubspot_folder_get` | `tools.hubspot_agent.hubspot_folder_get` | Get folder metadata. |

### Forms & Communication

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `hubspot_forms_list` | `tools.hubspot_agent.hubspot_forms_list` | List all HubSpot forms. |
| `hubspot_communication_preferences_definitions` | `tools.hubspot_agent.hubspot_communication_preferences_definitions` | Get available communication subscription definitions. |
| `hubspot_communication_preferences_statuses_get` | `tools.hubspot_agent.hubspot_communication_preferences_statuses_get` | Get subscription statuses for a contact. |
| `hubspot_marketing_emails_list` | `tools.hubspot_agent.hubspot_marketing_emails_list` | List all marketing email campaigns. |

**External dependencies:** HubSpot REST API v3

---

## 7. Google Drive Agent (`/gdrive_agent`)

File and folder management on Google Drive via the Google Drive REST API v3.

### File Operations

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `search_files` | `tools.gdrive_agent.search_files` | Full-text and metadata search across all Drive files using a query string. |
| `list_files` | `tools.gdrive_agent.list_files` | List files; optionally scoped to a specific folder. |
| `get_file_metadata` | `tools.gdrive_agent.get_file_metadata` | Retrieve metadata (name, type, size, modified date, owners) for a single file. |
| `read_file_content` | `tools.gdrive_agent.read_file_content` | Download or export file content. Google Workspace files are exported as plain text / PDF. |
| `delete_file` | `tools.gdrive_agent.delete_file` | Permanently delete a file from Drive. |
| `copy_file` | `tools.gdrive_agent.copy_file` | Duplicate a file, optionally into a different folder. |
| `move_file` | `tools.gdrive_agent.move_file` | Move a file to a different parent folder. |

### Folder Operations

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `create_folder` | `tools.gdrive_agent.create_folder` | Create a new folder, optionally nested inside another folder. |

### Upload & Edit

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `create_text_file` | `tools.gdrive_agent.create_text_file` | Create a new plain-text file with specified content. |
| `update_file_content` | `tools.gdrive_agent.update_file_content` | Overwrite the content of an existing file. |

### Permissions & Sharing

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `share_file` | `tools.gdrive_agent.share_file` | Grant a user or group access to a file (reader, commenter, writer). |
| `list_permissions` | `tools.gdrive_agent.list_permissions` | List all permissions currently set on a file. |
| `remove_permission` | `tools.gdrive_agent.remove_permission` | Revoke a specific permission entry from a file. |

**External dependencies:** Google Drive API v3 (`google-api-python-client`, `google-auth`)

---

## 8. Facebook Page Agent (`/facebook_page_agent`)

Manage Facebook Business Pages and post engagement via the Facebook Graph API.

### Post Tools

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `create_post` | `tools.facebook_page_agent.create_post` | Publish a text post on the Facebook Page. |
| `get_page_posts` | `tools.facebook_page_agent.get_page_posts` | List recent posts on the Page with timestamps and engagement counts. |
| `delete_post` | `tools.facebook_page_agent.delete_post` | Permanently delete a post from the Page. |
| `post_image` | `tools.facebook_page_agent.post_image` | Publish an image post with a caption on the Page. |

### Comment Tools

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `get_post_comments` | `tools.facebook_page_agent.get_post_comments` | List comments on a specific post. |
| `get_number_of_comments` | `tools.facebook_page_agent.get_number_of_comments` | Count the number of comments on a post. |
| `reply_to_comment` | `tools.facebook_page_agent.reply_to_comment` | Reply to an existing comment on a post. |

### Engagement Tools

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `get_number_of_likes` | `tools.facebook_page_agent.get_number_of_likes` | Count likes / reactions on a post. |

**External dependencies:** Facebook Graph API (Page Access Token)

---

## 9. Instagram Agent (`/instagram_agent`)

Manage Instagram Business accounts via the Instagram Graph API.

### Profile Tools

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `get_profile_info` | `tools.instagram_agent.get_profile_info` | Retrieve the business profile details: followers, bio, profile picture, website. |

### Media Tools

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `get_media_posts` | `tools.instagram_agent.get_media_posts` | Fetch recent media posts from the Instagram account with captions, timestamps, and types. |
| `get_media_insights` | `tools.instagram_agent.get_media_insights` | Retrieve engagement metrics (impressions, reach, likes, comments, saves) for specific posts. |
| `publish_media` | `tools.instagram_agent.publish_media` | Upload and publish an image or video to the Instagram account. |

**External dependencies:** Instagram Graph API via `graph.facebook.com`

---

## 10. Email Marketing Agent (`/email_marketing_agent`)

Full contact and campaign management for **Brevo** (formerly Sendinblue) and **Mailchimp**.

### Brevo Tools

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `brevo_get_account_info` | `tools.email_marketing_agent.brevo_get_account_info` | Retrieve Brevo account details, plan info, and usage statistics. |
| `brevo_get_contacts` | `tools.email_marketing_agent.brevo_get_contacts` | List contacts with optional pagination and filtering. |
| `brevo_create_contact` | `tools.email_marketing_agent.brevo_create_contact` | Create a new contact with email, name, and custom attributes. |
| `brevo_update_contact` | `tools.email_marketing_agent.brevo_update_contact` | Update attributes on an existing contact. |
| `brevo_delete_contact` | `tools.email_marketing_agent.brevo_delete_contact` | Delete a contact from Brevo. |
| `brevo_list_contact_lists` | `tools.email_marketing_agent.brevo_list_contact_lists` | List all contact lists in the Brevo account. |
| `brevo_create_contact_list` | `tools.email_marketing_agent.brevo_create_contact_list` | Create a new contact list. |
| `brevo_add_contacts_to_list` | `tools.email_marketing_agent.brevo_add_contacts_to_list` | Add contacts to an existing list by email addresses. |
| `brevo_remove_contacts_from_list` | `tools.email_marketing_agent.brevo_remove_contacts_from_list` | Remove contacts from a list. |
| `brevo_list_campaigns` | `tools.email_marketing_agent.brevo_list_campaigns` | List email campaigns with status filter (draft, queued, sent, etc.). |
| `brevo_get_campaign` | `tools.email_marketing_agent.brevo_get_campaign` | Get details for a specific campaign. |
| `brevo_create_campaign` | `tools.email_marketing_agent.brevo_create_campaign` | Create a new email campaign with subject, sender, content, and recipient list. |
| `brevo_send_campaign_now` | `tools.email_marketing_agent.brevo_send_campaign_now` | Immediately send a campaign that is in `draft` status. |
| `brevo_schedule_campaign` | `tools.email_marketing_agent.brevo_schedule_campaign` | Schedule a campaign to be sent at a specific date and time. |
| `brevo_get_campaign_stats` | `tools.email_marketing_agent.brevo_get_campaign_stats` | Retrieve delivery and engagement statistics (opens, clicks, bounces) for a campaign. |
| `brevo_delete_campaign` | `tools.email_marketing_agent.brevo_delete_campaign` | Delete a draft or scheduled campaign. |
| `brevo_send_transactional_email` | `tools.email_marketing_agent.brevo_send_transactional_email` | Send an individual transactional email to a recipient. |
| `brevo_list_templates` | `tools.email_marketing_agent.brevo_list_templates` | List all email templates in the Brevo account. |
| `brevo_get_template` | `tools.email_marketing_agent.brevo_get_template` | Get details for a specific template. |
| `brevo_get_smtp_events` | `tools.email_marketing_agent.brevo_get_smtp_events` | Retrieve SMTP event logs (delivery, bounces, spam reports) for transactional emails. |

### Mailchimp Tools

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `mailchimp_ping` | `tools.email_marketing_agent.mailchimp_ping` | Ping the Mailchimp API to verify credentials and connectivity. |
| `mailchimp_get_account_info` | `tools.email_marketing_agent.mailchimp_get_account_info` | Retrieve Mailchimp account details and plan information. |
| `mailchimp_list_audiences` | `tools.email_marketing_agent.mailchimp_list_audiences` | List all Mailchimp audiences (mailing lists). |
| `mailchimp_get_audience` | `tools.email_marketing_agent.mailchimp_get_audience` | Get details for a specific audience. |
| `mailchimp_list_members` | `tools.email_marketing_agent.mailchimp_list_members` | List members in an audience with status and tag filters. |
| `mailchimp_get_member` | `tools.email_marketing_agent.mailchimp_get_member` | Get details for a specific audience member by email. |
| `mailchimp_add_member` | `tools.email_marketing_agent.mailchimp_add_member` | Subscribe a new member to an audience. |
| `mailchimp_update_member` | `tools.email_marketing_agent.mailchimp_update_member` | Update a member's status, name, or merge fields. |
| `mailchimp_archive_member` | `tools.email_marketing_agent.mailchimp_archive_member` | Archive (unsubscribe) a member from an audience. |
| `mailchimp_search_members` | `tools.email_marketing_agent.mailchimp_search_members` | Search members across all audiences by email or name. |
| `mailchimp_list_campaigns` | `tools.email_marketing_agent.mailchimp_list_campaigns` | List campaigns with optional status filtering. |
| `mailchimp_get_campaign` | `tools.email_marketing_agent.mailchimp_get_campaign` | Get full details for a specific campaign. |
| `mailchimp_create_campaign` | `tools.email_marketing_agent.mailchimp_create_campaign` | Create a new email campaign (regular, automated, A/B split). |
| `mailchimp_set_campaign_content` | `tools.email_marketing_agent.mailchimp_set_campaign_content` | Set the HTML/template content for a campaign. |
| `mailchimp_send_campaign` | `tools.email_marketing_agent.mailchimp_send_campaign` | Send a campaign immediately. |
| `mailchimp_schedule_campaign` | `tools.email_marketing_agent.mailchimp_schedule_campaign` | Schedule a campaign to be sent at a specific time. |
| `mailchimp_unschedule_campaign` | `tools.email_marketing_agent.mailchimp_unschedule_campaign` | Cancel a scheduled campaign. |
| `mailchimp_delete_campaign` | `tools.email_marketing_agent.mailchimp_delete_campaign` | Delete a campaign. |
| `mailchimp_get_campaign_report` | `tools.email_marketing_agent.mailchimp_get_campaign_report` | Get the performance report for a sent campaign. |
| `mailchimp_list_campaign_reports` | `tools.email_marketing_agent.mailchimp_list_campaign_reports` | List reports for all campaigns with summary stats. |
| `mailchimp_add_tags_to_member` | `tools.email_marketing_agent.mailchimp_add_tags_to_member` | Add one or more tags to a member. |
| `mailchimp_remove_tags_from_member` | `tools.email_marketing_agent.mailchimp_remove_tags_from_member` | Remove one or more tags from a member. |

**External dependencies:** Brevo REST API, Mailchimp Marketing API

---

## 11. Customer Support Agent (`/customer_support_agent`)

Ticket and customer management for **Zendesk** using the Zendesk REST API.

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `zendesk_list_tickets` | `tools.customer_support_agent.zendesk_list_tickets` | List tickets with optional status, priority, or assignee filters. |
| `zendesk_get_ticket` | `tools.customer_support_agent.zendesk_get_ticket` | Get full details for a specific ticket. |
| `zendesk_create_ticket` | `tools.customer_support_agent.zendesk_create_ticket` | Create a new support ticket with subject, description, priority, and requester. |
| `zendesk_update_ticket` | `tools.customer_support_agent.zendesk_update_ticket` | Update a ticket's fields (status, priority, assignee, tags, custom fields). |
| `zendesk_close_ticket` | `tools.customer_support_agent.zendesk_close_ticket` | Close a ticket (set status to `closed`). |
| `zendesk_reopen_ticket` | `tools.customer_support_agent.zendesk_reopen_ticket` | Reopen a closed or solved ticket. |
| `zendesk_get_ticket_comments` | `tools.customer_support_agent.zendesk_get_ticket_comments` | List all comments (public and private) on a ticket. |
| `zendesk_add_comment` | `tools.customer_support_agent.zendesk_add_comment` | Add a public or internal note comment to a ticket. |
| `zendesk_get_user` | `tools.customer_support_agent.zendesk_get_user` | Retrieve a Zendesk user profile by user ID. |
| `zendesk_get_user_by_email` | `tools.customer_support_agent.zendesk_get_user_by_email` | Look up a user by email address. |
| `zendesk_get_user_tickets` | `tools.customer_support_agent.zendesk_get_user_tickets` | Get all tickets associated with a specific user. |
| `zendesk_search_tickets` | `tools.customer_support_agent.zendesk_search_tickets` | Full-text search across tickets using Zendesk's search syntax. |
| `zendesk_list_views` | `tools.customer_support_agent.zendesk_list_views` | List all saved ticket views in the Zendesk account. |
| `zendesk_get_view_tickets` | `tools.customer_support_agent.zendesk_get_view_tickets` | Retrieve tickets from a specific saved view. |
| `zendesk_get_ticket_metrics` | `tools.customer_support_agent.zendesk_get_ticket_metrics` | Get time-based metrics (first reply time, resolution time) for a ticket. |

**External dependencies:** Zendesk REST API (email + API token)

---

## 12. Analytics Agent (`/analytics_agent`)

Business intelligence and web analytics from Shopify and Google Analytics 4.

### Shopify Analytics Tools

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `shopify_get_orders_summary` | `tools.analytics_agent.shopify_get_orders_summary` | Summarise orders over a date range: total revenue, order count, AOV. |
| `shopify_get_customer_metrics` | `tools.analytics_agent.shopify_get_customer_metrics` | Customer acquisition and retention metrics: new vs returning, LTV. |
| `shopify_get_products_by_revenue` | `tools.analytics_agent.shopify_get_products_by_revenue` | Rank products by revenue generated in a given period. |
| `shopify_get_sales_by_day` | `tools.analytics_agent.shopify_get_sales_by_day` | Daily sales breakdown for a specified date range. |
| `shopify_get_inventory_health` | `tools.analytics_agent.shopify_get_inventory_health` | Identify inventory issues: out-of-stock, low stock, and overstock by SKU. |

### Google Analytics 4 Tools

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `google_analytics_get_traffic` | `tools.analytics_agent.google_analytics_get_traffic` | Retrieve total sessions and users for a date range from GA4. |
| `google_analytics_get_conversions` | `tools.analytics_agent.google_analytics_get_conversions` | Get conversion event counts and conversion rate from GA4. |
| `google_analytics_get_traffic_by_source` | `tools.analytics_agent.google_analytics_get_traffic_by_source` | Break down traffic by acquisition channel (organic, direct, paid, referral). |
| `google_analytics_get_top_pages` | `tools.analytics_agent.google_analytics_get_top_pages` | List top-performing pages by sessions, pageviews, and bounce rate. |
| `google_analytics_get_traffic_by_device` | `tools.analytics_agent.google_analytics_get_traffic_by_device` | Split traffic by device category (desktop, mobile, tablet). |

**External dependencies:** Shopify Admin REST API, Google Analytics Data API (GA4)

---

## 13. Meta Ads Agent (`/meta_ads_agent`)

End-to-end Facebook/Instagram advertising management via the Facebook Marketing API.

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `get_ad_accounts` | `tools.meta_ads_agent.get_ad_accounts` | List all ad accounts accessible with the provided credentials. |
| `get_campaigns` | `tools.meta_ads_agent.get_campaigns` | List campaigns in an ad account with status, budget, and objective. |
| `get_adsets` | `tools.meta_ads_agent.get_adsets` | List ad sets within a campaign with targeting, budget, and schedule details. |
| `get_ads` | `tools.meta_ads_agent.get_ads` | List individual ads within an ad set. |
| `create_campaign` | `tools.meta_ads_agent.create_campaign` | Create a new campaign with objective, status, and spending limits. |
| `update_campaign` | `tools.meta_ads_agent.update_campaign` | Update campaign budget, status, or name. |
| `create_adset` | `tools.meta_ads_agent.create_adset` | Create an ad set with targeting, bid strategy, placement, and schedule. |
| `update_adset` | `tools.meta_ads_agent.update_adset` | Update targeting, budget, or schedule for an ad set. |
| `create_ad_creative` | `tools.meta_ads_agent.create_ad_creative` | Create an ad creative with image/video assets, copy, and call-to-action. |
| `update_ad_creative` | `tools.meta_ads_agent.update_ad_creative` | Update creative assets or copy. |
| `create_ad` | `tools.meta_ads_agent.create_ad` | Create an ad linking a creative to an ad set. |
| `update_ad` | `tools.meta_ads_agent.update_ad` | Update ad status, name, or creative. |
| `get_insights` | `tools.meta_ads_agent.get_insights` | Retrieve performance metrics (impressions, clicks, spend, ROAS) for a campaign, ad set, or ad. |

**External dependencies:** Facebook Marketing API

---

## 14. Google Ads Agent (`/google_ads_agent`)

Full Google Ads account management via the Google Ads API.

| Tool | Ignitic Identifier | Description |
|------|--------------------|-------------|
| `list_accessible_customers` | `tools.google_ads_agent.list_accessible_customers` | List all Google Ads customer accounts accessible with the provided OAuth credentials. |
| `get_campaigns` | `tools.google_ads_agent.get_campaigns` | List campaigns in an account with status, budget, and bidding strategy. |
| `get_ad_groups` | `tools.google_ads_agent.get_ad_groups` | List ad groups within a campaign. |
| `get_ads` | `tools.google_ads_agent.get_ads` | List ads within an ad group. |
| `get_creatives` | `tools.google_ads_agent.get_creatives` | List creative assets associated with an account or campaign. |
| `create_campaign` | `tools.google_ads_agent.create_campaign` | Create a new Google Ads campaign with budget, bidding, and network settings. |
| `update_campaign` | `tools.google_ads_agent.update_campaign` | Update campaign status, name, or budget. |
| `create_ad_group` | `tools.google_ads_agent.create_ad_group` | Create an ad group within a campaign with CPC bids and targeting. |
| `update_ad_group` | `tools.google_ads_agent.update_ad_group` | Update ad group bids or status. |
| `create_creative_asset` | `tools.google_ads_agent.create_creative_asset` | Upload a creative asset (text, image, or video) to the account. |
| `update_creative_asset` | `tools.google_ads_agent.update_creative_asset` | Update a creative asset's content or status. |
| `create_ad` | `tools.google_ads_agent.create_ad` | Create a responsive search ad or display ad. |
| `update_ad` | `tools.google_ads_agent.update_ad` | Update ad copy, status, or final URL. |
| `get_performance_metrics` | `tools.google_ads_agent.get_performance_metrics` | Retrieve clicks, impressions, CTR, conversions, and CPA for a campaign, ad group, or ad. |

**External dependencies:** Google Ads API (`google-ads`)

---

## 15. Custom Agent (`/custom`)

The Custom Agent server exposes the entire tool catalog (all tools from all agents above) as a flat list. Additionally, at server startup it dynamically registers **n8n workflow tools** fetched from the AI Engine.

### Static Tools

The `/custom` server re-exports all tools from agents 1–14 under their original `ignitic_identifier` values. This allows user-created custom agents to mix and match any tool from any domain.

### Dynamic Workflow Tools

When the server starts, `register_workflow_tools()` is called, which:

1. Calls the AI Engine's `GET /api/v1/workflow-template/?limit=0` endpoint.
2. For each workflow template, generates a Pydantic input/output model from the template's schema.
3. Registers a dynamic async tool that POSTs to the template's n8n webhook URL.

Dynamic tools are registered with:
```python
meta={
    "ignitic_identifier": "<template.ignitic_identifier>",
    "is_workflow": True,
    "workflow_provider": "n8n"
}
```

**Tool naming:** The tool name is the last segment of the `ignitic_identifier` (e.g., `tools.marketer.send_welcome_email` → tool name `send_welcome_email`).

---

## Tool Invocation Contract

### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | `Bearer <jwt>` — JWT issued by the Backend API |
| `X-Chat-ID` | No | Associates the tool execution log with a chat session |

### Tool Metadata

Every registered tool exposes:
- `name` — function name (snake_case)
- `description` — docstring of the tool function
- `inputSchema` — JSON Schema auto-generated from function type annotations
- `meta.ignitic_identifier` — dot-separated tool trace identifier
- `meta.is_workflow` — `true` for dynamically registered n8n tools
- `meta.workflow_provider` — `"n8n"` for workflow tools

### Credential Retrieval

Tools that interact with third-party platforms (Shopify, HubSpot, etc.) retrieve credentials at invocation time from the AI Engine via:

```
GET /api/v1/credential/<credential_type>
Authorization: Bearer <forwarded-jwt>
```

Credentials are never stored on the MCP Server and are not logged.
