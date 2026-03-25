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

# Middleware
app.add_middleware(AuthenticationMiddleware())
app.add_middleware(ExecutionLoggingMiddleware())

