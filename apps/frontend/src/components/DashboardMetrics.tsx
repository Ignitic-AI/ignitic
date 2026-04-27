'use client'

import { useState } from 'react'

import { Spinner } from './ui/spinner'

interface Tool {
  name: string
  description: string
}

interface ApiAgent {
  identifier: string
  name: string
  type: string
  parent: string
  tools: Tool[]
}

const STATIC_AGENTS: ApiAgent[] = [
    {
        "identifier": "product_researcher",
        "name": "Product Researcher Agent",
        "type": "worker",
        "parent": "super_agent",
        "tools": [
            {
                "name": "google_dork_search",
                "description": "Perform a DuckDuckGo web search and return top results with brief content excerpts.\n\nArgs:\n    query: The search query, supports advanced operators (\"dorks\").\n    num_results: Number of results to return (default 5).\n\nReturns:\n    JSON string with list of {title, url, snippet, content_excerpt}."
            },
            {
                "name": "apify_amazon_search",
                "description": "Search Amazon marketplace via Apify (Amazon-only). Returns JSON list of standardized products\nwith keys: asin, title, price, retailPrice, imageUrl, rating, reviewsCount, prime,\nurl, manufacturer, sponsored, position, deliveryMessage, salesVolume, categories,\nsimilarKeywords.\n\nArgs:\n    keyword: Search query specific to Amazon marketplace (e.g., \"rc cars\", \"hunting gear\").\n    domain_code: Amazon TLD (com, co.uk, de, fr, etc.).\n    max_results: Max products to return (default 30).\n    sort_by: Amazon sort (e.g., relevanceblender, recent).\n    category: Amazon category (default \"aps\").\n    max_pages: Optional number of pages to fetch (defaults to 1 for speed/cost)."
            },
            {
                "name": "apify_ebay_search",
                "description": "Search eBay marketplace via Apify. Returns JSON list of standardized products\nwith keys: id, title, url, condition, brand, price (current, shipping, total),\ninventory (available, sold, total_sold), images (main, all), categories,\ncategory_paths, attributes, promotion, availability, metadata.\n\nArgs:\n    query: Search query for eBay marketplace (e.g., \"arduino\", \"gaming laptop\").\n    max_results: Max products to return (default 30, max 240).\n    country: Country code for simulation (default \"US\")."
            },
            {
                "name": "apify_alibaba_supplier_search",
                "description": "Search Alibaba.com for suppliers/manufacturers via Apify. Returns JSON list of standardized\nsupplier objects: searchQuery, companyId, name, country, countryCode, yearsAsGoldSupplier,\ncompanyIconUrl, profileUrl, totalEmployees, factorySize, annualRevenue, responseRate,\nisAssessedSupplier, isVerifiedSupplierPro, productsOffered, reviewCount, reviewScore, serviceTags.\nmax_pages is always 1 (hard cap).\n\nArgs:\n    queries: Comma-separated product search phrases.\n    min_years_as_gold_supplier: Optional minimum years as Gold Supplier.\n    assessed_supplier_only: If true, restrict to assessed suppliers when supported.\n    service_tags: Optional comma-separated tags (e.g. \"OEM Service, ODM Service\").\n    max_results: Max rows to return (default 100)."
            },
            {
                "name": "apify_alibaba_product_search",
                "description": "Search Alibaba.com for wholesale product listings via Apify (devcake/alibaba-products-scraper).\nReturns JSON list with snake_case keys: search_query, name, price_min, price_max, currency, moq,\nproduct_url, main_image, company_name, years_as_gold_supplier, supplier_service_score,\nis_alibaba_guaranteed, is_trade_assurance, is_verified_supplier, review_count, review_score,\norders_count. max_pages is always 1.\n\nArgs:\n    queries: Comma-separated search phrases.\n    filter_moq_min, filter_price_min_usd, filter_price_max_usd: Optional search filters.\n    trade_assurance, verified_supplier, alibaba_guaranteed: Boolean filters.\n    start_page: First page (default 1).\n    max_results: Cap on rows (default 60)."
            },
            {
                "name": "apify_aliexpress_search",
                "description": "AliExpress product search via Apify. Returns JSON list (max 10) with product_id, title, prices, rating,\norders, store, URLs, shipping. max_pages=1 and max_items=10 are fixed.\n\nArgs:\n    queries: Comma-separated keyword phrases (or use start_urls for direct product/category URLs).\n    start_urls: Optional comma- or newline-separated AliExpress URLs.\n    min_price, max_price, min_rating, min_order_count: Optional filters.\n    sort_by: default, orders, price_asc, price_desc, rating, newest.\n    ship_to, currency, language, ships_from: Locale and availability (defaults US / USD / en_US / Any)."
            },
            {
                "name": "google_trends",
                "description": "Fetch stats from Google Trends via pytrends.\n\nArgs:\n    endpoint: One of [iot, ibr, rq, rt, ts, rts] or full names.\n    country: Geo code like 'US', 'PK', 'GB'.\n    keywords: Required for iot/ibr/rq/rt when payload is needed.\n    timeframe: e.g. 'now 7-d', 'today 12-m'.\n    gprop: '', 'images', 'news', 'youtube', 'froogle'.\n\nReturns:\n    JSON string with keys: endpoint, data (JSON-serializable)."
            },
            {
                "name": "shopify_product_scraper",
                "description": "Scrape product data from a Shopify store (titles, descriptions, prices, variants, images, SKUs, inventory).\n\nUse for e-commerce analysis, price monitoring, product feeds, competitor product/SEO analysis.\n\nArgs:\n    start_url: Full Shopify store URL (e.g. https://store.myshopify.com or https://www.yourcustomdomain.com).\n    url_type: URL type handling (default \"auto\").\n    max_products: Max products to scrape; 0 = all products.\n\nReturns:\n    JSON string: list of product objects with productId, title, handle, productUrl, vendor,\n    productType, descriptionHtml, options, variants (price, sku, available, inventoryQuantity),\n    images (src, alt), tags, status, createdAt, updatedAt, publishedAt, etc."
            }
        ]
    },
    {
        "identifier": "marketer",
        "name": "Marketer Agent",
        "type": "worker",
        "parent": "super_agent",
        "tools": [
            {
                "name": "twitter_trends",
                "description": "Fetch Twitter trending topics for a given country using the Apify actor.\n\nArgs:\n    country: Country name (must match the actor's supported list). Default: UnitedStates.\n    max_results: Max number of trends to return (capped at 10).\n\nReturns:\n    JSON string list of trends with keys: name, description, context, scrapedAt."
            },
            {
                "name": "tiktok_trends",
                "description": "Fetch TikTok trending videos for a given country using the Apify actor.\n\nArgs:\n    country: Target country (default: \"United States\").\n    number_of_videos: How many videos to fetch (capped at 20).\n    download_cover_image: Include cover image URLs.\n    download_video: Include no-watermark video URLs.\n    generate_permalinks: Generate permanent links.\n    use_apify_proxy: Use Apify proxy (recommended).\n    proxy_type: \"DATACENTER\" or \"RESIDENTIAL\".\n    webhook_url: Optional webhook to receive scraped data.\n\nReturns:\n    JSON string list of trending videos with metadata."
            },
            {
                "name": "facebook_ads_scraper",
                "description": "Scrape Facebook Ads Library for given country/keyword targets via Apify.\n\nArgs:\n    targets: List of {\"country\": str, \"keyword\": str}.\n    ads_limit: Max ads per target (capped at 500).\n    scroll_count: Scroll actions to load more ads.\n    headless: Run browser headless.\n    max_concurrency: Max concurrent browser instances.\n    delay: Delay between actions in ms.\n\nReturns:\n    JSON string of results; each item corresponds to a target with ads and metadata."
            },
            {
                "name": "site_domain_authority_seo",
                "description": "Fetch domain authority & SEO report for a single domain via Apify.\n\nArgs:\n    domain: Single domain to analyze (required).\n    max_concurrency: Actor max concurrency (default 3).\n    navigation_timeout: Navigation timeout in seconds (default 60).\n    page_load_delay: Page load delay in ms (default 5000).\n    use_apify_proxy: Use Apify proxy (default True).\n\nReturns:\n    JSON string of results (list; typically one item)."
            }
        ]
    },
    {
        "identifier": "seo_agent",
        "name": "SEO Agent",
        "type": "worker",
        "parent": "super_agent",
        "tools": [
            {
                "name": "site_domain_authority_seo",
                "description": "Fetch domain authority & SEO report for a single domain via Apify.\n\nArgs:\n    domain: Single domain to analyze (required).\n    max_concurrency: Actor max concurrency (default 3).\n    navigation_timeout: Navigation timeout in seconds (default 60).\n    page_load_delay: Page load delay in ms (default 5000).\n    use_apify_proxy: Use Apify proxy (default True).\n\nReturns:\n    JSON string of results (list; typically one item)."
            },
            {
                "name": "meta_tags_scraper_seo",
                "description": "Scrape meta tags from one or more URLs for SEO audit (title, description, robots, OG, Twitter, viewport).\n\nArgs:\n    urls: A single URL string or a list of URL strings to scrape.\n\nReturns:\n    JSON string: list of objects with url, meta_name, and content for each meta tag found."
            },
            {
                "name": "shopify_product_scraper",
                "description": "Scrape product data from a Shopify store (titles, descriptions, prices, variants, images, SKUs, inventory).\n\nUse for e-commerce analysis, price monitoring, product feeds, competitor product/SEO analysis.\n\nArgs:\n    start_url: Full Shopify store URL (e.g. https://store.myshopify.com or https://www.yourcustomdomain.com).\n    url_type: URL type handling (default \"auto\").\n    max_products: Max products to scrape; 0 = all products.\n\nReturns:\n    JSON string: list of product objects with productId, title, handle, productUrl, vendor,\n    productType, descriptionHtml, options, variants (price, sku, available, inventoryQuantity),\n    images (src, alt), tags, status, createdAt, updatedAt, publishedAt, etc."
            }
        ]
    },
    {
        "identifier": "gdrive_agent",
        "name": "Google Drive Agent",
        "type": "worker",
        "parent": "super_agent",
        "tools": [
            {
                "name": "search_files",
                "description": "Search for files in Google Drive using a full-text or metadata query.\n\nArgs:\n    query: Drive query string, e.g. ``\"name contains 'report'\"`` or\n           simply a plain keyword that will be wrapped in a full-text\n           ``fullText contains …`` expression automatically.\n    page_size: Maximum number of results to return (1-100, default 10).\n    page_token: Continuation token returned by a previous call to fetch\n                the next page of results.\n    include_trashed: Whether to include files in the trash (default False).\n\nReturns:\n    Dict with ``files`` list and optional ``next_page_token``."
            },
            {
                "name": "list_files",
                "description": "List files in Google Drive, optionally scoped to a specific folder.\n\nArgs:\n    folder_id: ID of the parent folder. Omit to list files in the root /\n               \"My Drive\".\n    page_size: Maximum number of results to return (1-100, default 20).\n    page_token: Continuation token for pagination.\n    order_by: Sorting order, e.g. ``\"modifiedTime desc\"`` (default) or\n              ``\"name\"``.\n    include_trashed: Whether to include trashed files (default False).\n\nReturns:\n    Dict with ``files`` list and optional ``next_page_token``."
            },
            {
                "name": "get_file_metadata",
                "description": "Get detailed metadata for a specific file or folder in Google Drive.\n\nArgs:\n    file_id: The ID of the file or folder.\n\nReturns:\n    Dict containing file metadata fields."
            },
            {
                "name": "read_file_content",
                "description": "Read (download or export) the content of a file from Google Drive.\n\nGoogle Workspace documents (Docs, Sheets, Slides, …) are exported to a\nhuman-readable text format. The response shape depends on the file type:\n\n- Text files / Google Workspace exports:\n    ``{\"type\": \"text-plain\", \"text\": \"…\", \"mime_type\": \"…\", \"name\": \"…\"}``\n- Image files (JPEG, PNG, GIF, …):\n    ``{\"type\": \"image\", \"base64\": \"…\", \"mime_type\": \"…\", \"name\": \"…\"}``\n- All other binary files (PDF, video, zip, …):\n    ``{\"type\": \"file\", \"base64\": \"…\", \"mime_type\": \"…\", \"name\": \"…\"}``\n\nArgs:\n    file_id: The ID of the file to read."
            },
            {
                "name": "delete_file",
                "description": "Permanently delete a file or folder from Google Drive.\n\nArgs:\n    file_id: The ID of the file or folder to delete.\n\nReturns:\n    Dict confirming deletion with ``file_id`` and ``status``."
            },
            {
                "name": "copy_file",
                "description": "Copy a file to the same or a different folder.\n\nArgs:\n    file_id: The ID of the file to copy.\n    new_name: Name for the copy. Defaults to \"Copy of <original name>\".\n    parent_folder_id: Destination folder ID. Defaults to the same parent\n                      as the original.\n\nReturns:\n    Dict with the metadata of the newly created copy."
            },
            {
                "name": "move_file",
                "description": "Move a file to a different folder in Google Drive.\n\nArgs:\n    file_id: The ID of the file to move.\n    new_parent_folder_id: The ID of the destination folder.\n\nReturns:\n    Dict with the updated file metadata."
            },
            {
                "name": "create_folder",
                "description": "Create a new folder in Google Drive.\n\nArgs:\n    name: Name of the new folder.\n    parent_folder_id: ID of the parent folder. Omit to create in the\n                      root of \"My Drive\".\n\nReturns:\n    Dict with the metadata of the created folder."
            },
            {
                "name": "create_text_file",
                "description": "Create a new text file in Google Drive with the given content.\n\nArgs:\n    name: File name including extension, e.g. ``\"notes.txt\"``.\n    content: Text content to write into the file.\n    mime_type: MIME type of the content (default ``\"text/plain\"``).\n               Use ``\"text/csv\"`` for CSV, ``\"application/json\"`` for JSON,\n               etc.\n    parent_folder_id: ID of the parent folder. Omit to upload to \"My Drive\"\n                      root.\n\nReturns:\n    Dict with the metadata of the newly created file."
            },
            {
                "name": "update_file_content",
                "description": "Overwrite the content of an existing file in Google Drive.\n\nArgs:\n    file_id: The ID of the file to update.\n    content: New text content to write.\n    mime_type: MIME type of the new content (default ``\"text/plain\"``).\n    new_name: Optional new name for the file.\n\nReturns:\n    Dict with the updated file metadata."
            },
            {
                "name": "share_file",
                "description": "Share a file or folder with a specific user.\n\nArgs:\n    file_id: The ID of the file or folder to share.\n    email: The email address of the user to share with.\n    role: Access level to grant. One of:\n          ``\"reader\"`` (view-only, default),\n          ``\"commenter\"`` (view + comment),\n          ``\"writer\"`` (edit),\n          ``\"fileOrganizer\"`` (organise in shared drives),\n          ``\"owner\"`` (transfer ownership - use carefully).\n    send_notification: Whether to send an email notification to the user\n                       (default ``True``).\n    message: Optional personal message to include in the notification email.\n\nReturns:\n    Dict containing the created permission object."
            },
            {
                "name": "list_permissions",
                "description": "List all permissions (sharing settings) for a file or folder.\n\nArgs:\n    file_id: The ID of the file or folder.\n\nReturns:\n    Dict with ``file_id`` and ``permissions`` list."
            },
            {
                "name": "remove_permission",
                "description": "Remove (revoke) a specific permission from a file or folder.\n\nArgs:\n    file_id: The ID of the file or folder.\n    permission_id: The ID of the permission to remove (obtained from\n                   ``list_permissions``).\n\nReturns:\n    Dict confirming removal with ``file_id``, ``permission_id`` and\n    ``status``."
            }
        ]
    },
    {
        "identifier": "shopify_agent",
        "name": "Shopify Agent",
        "type": "worker",
        "parent": "super_agent",
        "tools": [
            {
                "name": "create_product",
                "description": "Create a product in Shopify using GraphQL Admin API.\n\nArgs:\n    auth: Authentication token for the Shopify API\n    title: The title of the product (required)\n    description_html: The description of the product in HTML format\n    handle: A unique human-friendly string for the product (URL slug)\n    vendor: The name of the product's vendor\n    product_type: The product type specified by the merchant\n    tags: A list of tags attached to the product\n    product_options: Product options with name and values\n        Example: [{\"name\": \"Color\", \"values\": [{\"name\": \"Red\"}, {\"name\": \"Blue\"}]}]\n    status: The status of the product (ACTIVE, ARCHIVED, DRAFT)\n    published_at: The date and time when the product was published\n    seo_title: SEO title for the product\n    seo_description: SEO description for the product\n    template_suffix: The theme template used when viewing the product\n    product_category: The product category\n    standard_product_type: The standardized product type\n    metafields: Custom metafields to attach to the product\n    media: Media items to attach to the product\n        Example: [{\"originalSource\": \"https://example.com/image.jpg\", \"mediaContentType\": \"IMAGE\"}]\n\nReturns:\n    Dict containing the created product data and any errors\n\nExample:\n    result = await create_product(\n        auth=\"auth_token\",\n        title=\"Cool T-Shirt\",\n        description_html=\"<p>A very cool t-shirt</p>\",\n        vendor=\"My Store\",\n        product_type=\"Apparel\",\n        tags=[\"summer\", \"clothing\"],\n        product_options=[\n            {\n                \"name\": \"Size\",\n                \"values\": [{\"name\": \"Small\"}, {\"name\": \"Medium\"}, {\"name\": \"Large\"}]\n            },\n            {\n                \"name\": \"Color\",\n                \"values\": [{\"name\": \"Red\"}, {\"name\": \"Blue\"}]\n            }\n        ],\n        status=\"DRAFT\"\n    )"
            },
            {
                "name": "get_product_by_id",
                "description": "Retrieve detailed information about a specific product by ID.\n\nArgs:\n    product_id: The Shopify product ID (e.g., \"gid://shopify/Product/123456\")\n\nReturns:\n    Dict containing detailed product information including:\n    - Basic info (id, title, description, handle, vendor, type, status)\n    - Options and variants with pricing\n    - Media (images, videos)\n    - SEO metadata\n    - Metafields\n    - Collections\n\nExample:\n    result = await get_product_by_id(\"gid://shopify/Product/123456\")"
            },
            {
                "name": "get_products",
                "description": "Retrieve a paginated list of products with minimal information.\n\nArgs:\n    first: Number of products to retrieve (default: 10, max recommended: 250)\n    after: Cursor for pagination - get products after this cursor\n    query: Search query using Shopify search syntax\n        Examples:\n        - \"title:shirt\" - Search by title\n        - \"vendor:Nike\" - Filter by vendor\n        - \"product_type:Apparel\" - Filter by product type\n        - \"status:active\" - Filter by status (active, archived, draft)\n        - \"tag:summer\" - Filter by tag\n        - Multiple filters: \"vendor:Nike AND product_type:Apparel\"\n    reverse: Reverse the order of results (default: False)\n    sort_key: Sort key for results\n        Options: TITLE, PRODUCT_TYPE, VENDOR, INVENTORY_TOTAL, UPDATED_AT, CREATED_AT, PUBLISHED_AT, ID, RELEVANCE\n        Default: ID\n\nReturns:\n    Dict containing:\n    - products: List of product objects with minimal info\n    - pageInfo: Pagination information (hasNextPage, hasPreviousPage, endCursor, startCursor)\n\nExample:\n    # Get first 20 active products\n    result = await get_products(first=20, query=\"status:active\")\n\n    # Get next page\n    result = await get_products(first=20, after=result['pageInfo']['endCursor'])\n\n    # Search by vendor\n    result = await get_products(query=\"vendor:Nike\")"
            },
            {
                "name": "delete_product",
                "description": "Permanently delete a product from Shopify.\n\nWarning: This operation is irreversible. The product and all its associated data\n(variants, media, etc.) will be permanently deleted.\n\nArgs:\n    product_id: The Shopify product ID (e.g., \"gid://shopify/Product/123456\")\n\nReturns:\n    Dict containing:\n    - deletedProductId: The ID of the deleted product\n    - userErrors: List of any errors that occurred\n\nExample:\n    result = await delete_product(\"gid://shopify/Product/123456\")"
            },
            {
                "name": "publish_product",
                "description": "Publish a product to specified sales channels/publications.\n\nNote: This mutation is deprecated. Consider using publishablePublish instead for new implementations.\n\nArgs:\n    product_id: The Shopify product ID (e.g., \"gid://shopify/Product/123456\")\n    publication_ids: List of publication/channel IDs to publish to\n        (e.g., [\"gid://shopify/Publication/123\"])\n    publish_date: Optional ISO 8601 datetime string for when to publish\n        (e.g., \"2024-01-01T00:00:00Z\"). If not provided, publishes immediately.\n\nReturns:\n    Dict containing:\n    - product: The published product object\n    - userErrors: List of any errors that occurred\n\nExample:\n    # Publish immediately to online store\n    result = await publish_product(\n        product_id=\"gid://shopify/Product/123456\",\n        publication_ids=[\"gid://shopify/Publication/123\"]\n    )\n\n    # Schedule publish for later\n    result = await publish_product(\n        product_id=\"gid://shopify/Product/123456\",\n        publication_ids=[\"gid://shopify/Publication/123\"],\n        publish_date=\"2024-12-25T00:00:00Z\"\n    )"
            },
            {
                "name": "unpublish_product",
                "description": "Unpublish a product from specified sales channels/publications.\n\nNote: This mutation is deprecated. Consider using publishableUnpublish instead for new implementations.\n\nArgs:\n    product_id: The Shopify product ID (e.g., \"gid://shopify/Product/123456\")\n    publication_ids: List of publication/channel IDs to unpublish from\n        (e.g., [\"gid://shopify/Publication/123\"])\n\nReturns:\n    Dict containing:\n    - product: The unpublished product object\n    - userErrors: List of any errors that occurred\n\nExample:\n    result = await unpublish_product(\n        product_id=\"gid://shopify/Product/123456\",\n        publication_ids=[\"gid://shopify/Publication/123\"]\n    )"
            }
        ]
    },
    {
        "identifier": "facebook_page_agent",
        "name": "Facebook Page Agent",
        "type": "worker",
        "parent": "marketer",
        "tools": [
            {
                "name": "create_post",
                "description": "Create a new text post on the Facebook Page.\n\nArgs:\n    message: The text content of the post.\n\nReturns:\n    Dict containing the new post's ``id``."
            },
            {
                "name": "get_page_posts",
                "description": "Fetch the most recent posts on the Facebook Page.\n\nArgs:\n    limit: Maximum number of posts to return (default 25).\n    page_token: Pagination cursor returned by a previous call.\n\nReturns:\n    Dict with ``data`` (list of posts) and ``paging`` cursors."
            },
            {
                "name": "delete_post",
                "description": "Delete a specific post from the Facebook Page.\n\nArgs:\n    post_id: The ID of the post to delete.\n\nReturns:\n    Dict with ``success`` boolean."
            },
            {
                "name": "post_image",
                "description": "Post an image (by URL) with an optional caption to the Facebook Page.\n\nArgs:\n    image_url: A publicly accessible URL of the image to publish.\n    caption: Optional text caption for the image.\n\nReturns:\n    Dict with ``id`` (photo ID) and ``post_id``."
            },
            {
                "name": "get_post_comments",
                "description": "Retrieve comments for a given post.\n\nArgs:\n    post_id: The ID of the post whose comments to fetch.\n    limit: Maximum number of comments to return (default 25).\n\nReturns:\n    Dict with ``data`` (list of comment objects) and ``paging`` cursors."
            },
            {
                "name": "get_number_of_comments",
                "description": "Count the total number of comments on a given post.\n\nArgs:\n    post_id: The ID of the post.\n\nReturns:\n    Dict with ``post_id`` and ``total_comments`` count."
            },
            {
                "name": "reply_to_comment",
                "description": "Reply to a specific comment on a Facebook Page post.\n\nArgs:\n    comment_id: The ID of the comment to reply to.\n    message: The reply text.\n\nReturns:\n    Dict with the new reply comment ``id``."
            },
            {
                "name": "get_number_of_likes",
                "description": "Return the total number of likes (reactions) on a post.\n\nArgs:\n    post_id: The ID of the post.\n\nReturns:\n    Dict with ``post_id`` and ``total_likes`` count."
            }
        ]
    },
    {
        "identifier": "instagram_agent",
        "name": "Instagram Agent",
        "type": "worker",
        "parent": "marketer",
        "tools": [
            {
                "name": "get_profile_info",
                "description": "Retrieve Instagram business profile details including followers,\nbio, and account information.\n\nArgs:\n    account_id: Instagram Business Account ID. If omitted the\n                account linked to the first Facebook Page is used.\n\nReturns:\n    Dict with profile fields such as ``id``, ``username``, ``name``,\n    ``biography``, ``website``, ``profile_picture_url``,\n    ``followers_count``, ``follows_count``, and ``media_count``."
            },
            {
                "name": "get_media_posts",
                "description": "Fetch recent media posts from an Instagram business account.\n\nArgs:\n    limit: Maximum number of posts to return (1-100, default 25).\n    after: Pagination cursor returned by a previous call.\n    account_id: Instagram Business Account ID. If omitted the\n                auto-detected account is used.\n\nReturns:\n    Dict with ``data`` (list of media objects) and ``paging`` cursors."
            },
            {
                "name": "get_media_insights",
                "description": "Retrieve engagement metrics (insights) for a specific Instagram post.\n\nArgs:\n    media_id: The Instagram media ID to get insights for.\n    metrics: List of metric names to retrieve. Supported values include\n             ``reach``, ``likes``, ``comments``, ``shares``, ``saved``,\n             and ``video_views`` (video posts only).\n             If omitted all standard metrics are fetched.\n\nReturns:\n    Dict with ``data`` containing the requested insight objects."
            },
            {
                "name": "publish_media",
                "description": "Upload and publish an image or video to the Instagram account.\n\nPublishing is a two-step process:\n  1. Create a media container with the content URL and caption.\n  2. Publish the container.\n\nArgs:\n    image_url: Publicly accessible URL of the image to publish.\n               Either ``image_url`` or ``video_url`` must be provided.\n    video_url: Publicly accessible URL of the video to publish.\n    caption: Optional caption text for the post.\n    location_id: Optional Facebook location ID for geotagging.\n    account_id: Instagram Business Account ID. If omitted the\n                auto-detected account is used.\n\nReturns:\n    Dict with the published media ``id``."
            }
        ]
    }
]

export function DashboardMetrics() {
  const [agents, setAgents] = useState<ApiAgent[]>(STATIC_AGENTS)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allToolNames = new Set<string>()
  agents.forEach(agent => {
    agent.tools?.forEach(tool => allToolNames.add(tool.name))
  })
  const totalToolsCount = allToolNames.size

  const metrics = {
    activeAgents: agents.length,
    totalTools: [totalToolsCount, totalToolsCount],
    totalExecution: [0, 0],
    agentDetails: agents.map(agent => ({
      name: agent.name,
      status: "Active",
      performance: "100%",
      type: agent.type === 'worker' ? 'Worker Agent' : agent.type
    }))
  }

  const statCards = [
    { label: 'Total Tools', value: metrics.totalTools[0], tone: 'text-primary-lm dark:text-primary', isPrimary: true },
    { label: 'In Use', value: metrics.totalTools[1], tone: 'text-success-lm dark:text-success', isPrimary: false },
    { label: 'Today', value: metrics.totalExecution[0], tone: 'text-text-lm dark:text-text', isPrimary: false },
    { label: 'This Week', value: metrics.totalExecution[1], tone: 'text-text-lm dark:text-text', isPrimary: false }
  ] as const

  return (
    <div className="space-y-5 relative min-h-[300px] font-generalSans">
      {isLoading && (
        <div className="absolute inset-0 bg-bg-light-lm/70 dark:bg-bg/70 backdrop-blur-sm flex items-center justify-center rounded-xl z-20 transition-all duration-300">
          <Spinner />
        </div>
      )}
      {error && !isLoading && (
        <div className="bg-danger-lm/10 dark:bg-danger/10 border border-danger-lm/30 dark:border-danger/30 rounded-xl p-4 text-center">
          <p className="text-sm text-danger-lm dark:text-danger">{error}</p>
        </div>
      )}
      <div className="dark:bg-bg bg-bg-lm rounded-xl p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted-lm dark:text-text-muted">
              Agent Overview
            </p>
            <h3 className="text-2xl md:text-3xl font-semibold text-text-lm dark:text-text">
              Active Agents
            </h3>
            <p className="text-sm text-text-muted-lm dark:text-text-muted max-w-xl">
              A focused snapshot of currently available specialists and their operational readiness.
            </p>
          </div>

          <div className="flex items-end gap-4">
            <div className="text-6xl md:text-7xl font-semibold text-text-lm dark:text-text leading-none tabular-nums">
              {metrics.activeAgents}
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs text-success-lm dark:text-success border border-success-lm/30 dark:border-success/30 rounded-full px-3 py-1 mb-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="font-semibold">+12% vs last month</span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {metrics.agentDetails.map((agent, index) => (
            <div
              key={index}
              className="p-4 dark:bg-bg-light bg-bg-light-lm rounded-xl transition-all duration-200 hover:bg-bg-light-lm/80 dark:hover:bg-bg-light/80 hover:backdrop-blur-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-lm dark:text-text truncate">{agent.name}</p>
                  <p className="text-xs text-text-muted-lm dark:text-text-muted mt-1">{agent.type}</p>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-success-lm dark:text-success border border-success-lm/30 dark:border-success/30 rounded-full px-2 py-0.5">
                  {agent.status}
                </span>
              </div>
              <p className="text-sm font-semibold text-success-lm dark:text-success mt-3">{agent.performance}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="dark:bg-bg bg-bg-lm rounded-xl p-6 shadow-sm">
        <div className="mb-5">
          <h3 className="text-lg font-semibold text-text-lm dark:text-text">Performance Metrics</h3>
          <p className="text-xs text-text-muted-lm dark:text-text-muted mt-1">Core utilization and execution counters</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className={`p-4 rounded-xl transition-all duration-200 hover:backdrop-blur-sm ${
                stat.isPrimary
                  ? 'bg-primary-lm/10 dark:bg-primary/10 hover:bg-primary-lm/20 dark:hover:bg-primary/20'
                  : 'bg-bg-light-lm dark:bg-bg-light hover:bg-bg-light-lm/80 dark:hover:bg-bg-light/80'
              }`}
            >
              <div className={`text-3xl font-semibold leading-none tabular-nums ${stat.tone}`}>
                {stat.value}
              </div>
              <div className="text-xs text-text-muted-lm dark:text-text-muted mt-2 uppercase tracking-wide">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

