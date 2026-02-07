from typing import Optional, List, Dict, Any
import shopify
from .client import ShopifyClient
from fastmcp.server.dependencies import get_http_headers


async def create_product(
    title: str,
    # Basic product information
    description_html: Optional[str] = None,
    handle: Optional[str] = None,
    vendor: Optional[str] = None,
    product_type: Optional[str] = None,
    tags: Optional[List[str]] = None,
    # Product options (for variants like Color, Size, etc.)
    product_options: Optional[List[Dict[str, Any]]] = None,
    # Status and visibility
    status: Optional[str] = None,  # ACTIVE, ARCHIVED, DRAFT
    published_at: Optional[str] = None,
    # SEO
    seo_title: Optional[str] = None,
    seo_description: Optional[str] = None,
    # Template and category
    template_suffix: Optional[str] = None,
    # Product category
    product_category: Optional[Dict[str, str]] = None,
    # Standard product type
    standard_product_type: Optional[Dict[str, str]] = None,
    # Metafields
    metafields: Optional[List[Dict[str, Any]]] = None,
    # Media items (images, videos, etc.)
    media: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Create a product in Shopify using GraphQL Admin API.

    Args:
        auth: Authentication token for the Shopify API
        title: The title of the product (required)
        description_html: The description of the product in HTML format
        handle: A unique human-friendly string for the product (URL slug)
        vendor: The name of the product's vendor
        product_type: The product type specified by the merchant
        tags: A list of tags attached to the product
        product_options: Product options with name and values
            Example: [{"name": "Color", "values": [{"name": "Red"}, {"name": "Blue"}]}]
        status: The status of the product (ACTIVE, ARCHIVED, DRAFT)
        published_at: The date and time when the product was published
        seo_title: SEO title for the product
        seo_description: SEO description for the product
        template_suffix: The theme template used when viewing the product
        product_category: The product category
        standard_product_type: The standardized product type
        metafields: Custom metafields to attach to the product
        media: Media items to attach to the product
            Example: [{"originalSource": "https://example.com/image.jpg", "mediaContentType": "IMAGE"}]

    Returns:
        Dict containing the created product data and any errors

    Example:
        result = await create_product(
            auth="auth_token",
            title="Cool T-Shirt",
            description_html="<p>A very cool t-shirt</p>",
            vendor="My Store",
            product_type="Apparel",
            tags=["summer", "clothing"],
            product_options=[
                {
                    "name": "Size",
                    "values": [{"name": "Small"}, {"name": "Medium"}, {"name": "Large"}]
                },
                {
                    "name": "Color",
                    "values": [{"name": "Red"}, {"name": "Blue"}]
                }
            ],
            status="DRAFT"
        )
    """

    headers = get_http_headers()
    auth = headers.get("Authorization") or headers.get("authorization")

    if not auth:
        raise ValueError("Authorization header is required")

    # Initialize Shopify client
    client = await ShopifyClient.initialize(auth)

    # Build the product input
    product_input: Dict[str, Any] = {"title": title}

    # Add optional fields if provided
    if description_html is not None:
        product_input["descriptionHtml"] = description_html

    if handle is not None:
        product_input["handle"] = handle

    if vendor is not None:
        product_input["vendor"] = vendor

    if product_type is not None:
        product_input["productType"] = product_type

    if tags is not None:
        product_input["tags"] = tags

    if product_options is not None:
        product_input["productOptions"] = product_options

    if status is not None:
        product_input["status"] = status

    if published_at is not None:
        product_input["publishedAt"] = published_at

    if seo_title is not None or seo_description is not None:
        seo_input = {}
        if seo_title is not None:
            seo_input["title"] = seo_title
        if seo_description is not None:
            seo_input["description"] = seo_description
        product_input["seo"] = seo_input

    if template_suffix is not None:
        product_input["templateSuffix"] = template_suffix

    if product_category is not None:
        product_input["productCategory"] = product_category

    if standard_product_type is not None:
        product_input["standardizedProductType"] = standard_product_type

    if metafields is not None:
        product_input["metafields"] = metafields

    # Build mutation with optional media parameter
    mutation = """
    mutation productCreate($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
        productCreate(product: $product, media: $media) {
            product {
                id
                title
                handle
                descriptionHtml
                vendor
                productType
                tags
                status
                createdAt
                updatedAt
                publishedAt
                templateSuffix
                options {
                    id
                    name
                    position
                    optionValues {
                        id
                        name
                        hasVariants
                    }
                }
                seo {
                    title
                    description
                }
                metafields(first: 20) {
                    edges {
                        node {
                            id
                            namespace
                            key
                            value
                            type
                        }
                    }
                }
                variants(first: 10) {
                    edges {
                        node {
                            id
                            title
                            price
                            sku
                            inventoryQuantity
                        }
                    }
                }
                media(first: 10) {
                    edges {
                        node {
                            ... on MediaImage {
                                id
                                image {
                                    url
                                    altText
                                }
                            }
                            ... on Video {
                                id
                                sources {
                                    url
                                }
                            }
                        }
                    }
                }
            }
            userErrors {
                field
                message
            }
        }
    }
    """

    # Prepare variables
    variables: Dict[str, Any] = {"product": product_input}

    if media is not None:
        variables["media"] = media

    # Execute the GraphQL mutation using temporary session
    with client.create_session():
        result = shopify.GraphQL().execute(query=mutation, variables=variables)

    # Parse and return the result
    import json

    result_data = json.loads(result)

    return result_data


async def get_products(
    first: int = 10,
    after: Optional[str] = None,
    query: Optional[str] = None,
    reverse: bool = False,
    sort_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Retrieve a paginated list of products with minimal information.

    Args:
        first: Number of products to retrieve (default: 10, max recommended: 250)
        after: Cursor for pagination - get products after this cursor
        query: Search query using Shopify search syntax
            Examples:
            - "title:shirt" - Search by title
            - "vendor:Nike" - Filter by vendor
            - "product_type:Apparel" - Filter by product type
            - "status:active" - Filter by status (active, archived, draft)
            - "tag:summer" - Filter by tag
            - Multiple filters: "vendor:Nike AND product_type:Apparel"
        reverse: Reverse the order of results (default: False)
        sort_key: Sort key for results
            Options: TITLE, PRODUCT_TYPE, VENDOR, INVENTORY_TOTAL, UPDATED_AT, CREATED_AT, PUBLISHED_AT, ID, RELEVANCE
            Default: ID

    Returns:
        Dict containing:
        - products: List of product objects with minimal info
        - pageInfo: Pagination information (hasNextPage, hasPreviousPage, endCursor, startCursor)

    Example:
        # Get first 20 active products
        result = await get_products(first=20, query="status:active")

        # Get next page
        result = await get_products(first=20, after=result['pageInfo']['endCursor'])

        # Search by vendor
        result = await get_products(query="vendor:Nike")
    """

    headers = get_http_headers()
    auth = headers.get("Authorization") or headers.get("authorization")

    if not auth:
        raise ValueError("Authorization header is required")

    # Initialize Shopify client
    client = await ShopifyClient.initialize(auth)

    # Build GraphQL query
    query_parts = [f"first: {first}"]

    if after:
        query_parts.append(f'after: "{after}"')

    if query:
        query_parts.append(f'query: "{query}"')

    if reverse:
        query_parts.append("reverse: true")

    if sort_key:
        query_parts.append(f"sortKey: {sort_key}")

    query_args = ", ".join(query_parts)

    graphql_query = f"""
    query GetProducts {{
        products({query_args}) {{
            edges {{
                cursor
                node {{
                    id
                    title
                    handle
                    vendor
                    productType
                    status
                    createdAt
                    updatedAt
                    publishedAt
                    tags
                    totalInventory
                    featuredImage {{
                        url
                        altText
                    }}
                    priceRangeV2 {{
                        minVariantPrice {{
                            amount
                            currencyCode
                        }}
                        maxVariantPrice {{
                            amount
                            currencyCode
                        }}
                    }}
                }}
            }}
            pageInfo {{
                hasNextPage
                hasPreviousPage
                startCursor
                endCursor
            }}
        }}
    }}
    """

    # Execute the GraphQL query using temporary session
    with client.create_session():
        result = shopify.GraphQL().execute(query=graphql_query)

    # Parse and return the result
    import json

    result_data = json.loads(result)

    return result_data


async def get_product_by_id(product_id: str) -> Dict[str, Any]:
    """
    Retrieve detailed information about a specific product by ID.

    Args:
        product_id: The Shopify product ID (e.g., "gid://shopify/Product/123456")

    Returns:
        Dict containing detailed product information including:
        - Basic info (id, title, description, handle, vendor, type, status)
        - Options and variants with pricing
        - Media (images, videos)
        - SEO metadata
        - Metafields
        - Collections

    Example:
        result = await get_product_by_id("gid://shopify/Product/123456")
    """

    headers = get_http_headers()
    auth = headers.get("Authorization") or headers.get("authorization")

    if not auth:
        raise ValueError("Authorization header is required")

    # Initialize Shopify client
    client = await ShopifyClient.initialize(auth)

    graphql_query = """
    query GetProductById($id: ID!) {
        product(id: $id) {
            id
            title
            handle
            descriptionHtml
            vendor
            productType
            tags
            status
            createdAt
            updatedAt
            publishedAt
            templateSuffix
            totalInventory
            tracksInventory
            options {
                id
                name
                position
                optionValues {
                    id
                    name
                    hasVariants
                }
            }
            variants(first: 100) {
                edges {
                    node {
                        id
                        title
                        sku
                        barcode
                        price
                        compareAtPrice
                        position
                        inventoryQuantity
                        availableForSale
                        weight
                        weightUnit
                        requiresShipping
                        taxable
                        selectedOptions {
                            name
                            value
                        }
                        image {
                            url
                            altText
                        }
                    }
                }
            }
            media(first: 20) {
                edges {
                    node {
                        ... on MediaImage {
                            id
                            mediaContentType
                            image {
                                url
                                altText
                                width
                                height
                            }
                        }
                        ... on Video {
                            id
                            mediaContentType
                            sources {
                                url
                                mimeType
                                format
                            }
                        }
                        ... on ExternalVideo {
                            id
                            mediaContentType
                            embeddedUrl
                            host
                        }
                        ... on Model3d {
                            id
                            mediaContentType
                            sources {
                                url
                                mimeType
                                format
                            }
                        }
                    }
                }
            }
            featuredImage {
                url
                altText
                width
                height
            }
            images(first: 20) {
                edges {
                    node {
                        url
                        altText
                        width
                        height
                    }
                }
            }
            seo {
                title
                description
            }
            metafields(first: 50) {
                edges {
                    node {
                        id
                        namespace
                        key
                        value
                        type
                        description
                    }
                }
            }
            priceRangeV2 {
                minVariantPrice {
                    amount
                    currencyCode
                }
                maxVariantPrice {
                    amount
                    currencyCode
                }
            }
            collections(first: 10) {
                edges {
                    node {
                        id
                        title
                        handle
                    }
                }
            }
        }
    }
    """

    variables = {"id": product_id}

    # Execute the GraphQL query using temporary session
    with client.create_session():
        result = shopify.GraphQL().execute(query=graphql_query, variables=variables)

    # Parse and return the result
    import json

    result_data = json.loads(result)

    return result_data


async def update_product(
    product_id: str,
    # Basic product information
    title: Optional[str] = None,
    description_html: Optional[str] = None,
    handle: Optional[str] = None,
    vendor: Optional[str] = None,
    product_type: Optional[str] = None,
    tags: Optional[List[str]] = None,
    # Product options (for variants like Color, Size, etc.)
    product_options: Optional[List[Dict[str, Any]]] = None,
    # Status and visibility
    status: Optional[str] = None,  # ACTIVE, ARCHIVED, DRAFT
    published_at: Optional[str] = None,
    # SEO
    seo_title: Optional[str] = None,
    seo_description: Optional[str] = None,
    # Template and category
    template_suffix: Optional[str] = None,
    # Product category
    product_category: Optional[Dict[str, str]] = None,
    # Standard product type
    standard_product_type: Optional[Dict[str, str]] = None,
    # Metafields
    metafields: Optional[List[Dict[str, Any]]] = None,
    # Media items (images, videos, etc.)
    media: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Update an existing product in Shopify using GraphQL Admin API.

    Args:
        product_id: The Shopify product ID (required, e.g., "gid://shopify/Product/123456")
        title: The title of the product
        description_html: The description of the product in HTML format
        handle: A unique human-friendly string for the product (URL slug)
        vendor: The name of the product's vendor
        product_type: The product type specified by the merchant
        tags: A list of tags attached to the product
        product_options: Product options with name and values
        status: The status of the product (ACTIVE, ARCHIVED, DRAFT)
        published_at: The date and time when the product was published
        seo_title: SEO title for the product
        seo_description: SEO description for the product
        template_suffix: The theme template used when viewing the product
        product_category: The product category
        standard_product_type: The standardized product type
        metafields: Custom metafields to attach to the product
        media: Media items to attach to the product

    Returns:
        Dict containing the updated product data and any errors

    Example:
        result = await update_product(
            product_id="gid://shopify/Product/123456",
            title="Updated T-Shirt",
            status="ACTIVE",
            tags=["summer", "sale"]
        )
    """

    headers = get_http_headers()
    auth = headers.get("Authorization") or headers.get("authorization")

    if not auth:
        raise ValueError("Authorization header is required")

    # Initialize Shopify client
    client = await ShopifyClient.initialize(auth)

    # Build the product input - must include ID
    product_input: Dict[str, Any] = {"id": product_id}

    # Add optional fields if provided
    if title is not None:
        product_input["title"] = title

    if description_html is not None:
        product_input["descriptionHtml"] = description_html

    if handle is not None:
        product_input["handle"] = handle

    if vendor is not None:
        product_input["vendor"] = vendor

    if product_type is not None:
        product_input["productType"] = product_type

    if tags is not None:
        product_input["tags"] = tags

    if product_options is not None:
        product_input["productOptions"] = product_options

    if status is not None:
        product_input["status"] = status

    if published_at is not None:
        product_input["publishedAt"] = published_at

    if seo_title is not None or seo_description is not None:
        seo_input = {}
        if seo_title is not None:
            seo_input["title"] = seo_title
        if seo_description is not None:
            seo_input["description"] = seo_description
        product_input["seo"] = seo_input

    if template_suffix is not None:
        product_input["templateSuffix"] = template_suffix

    if product_category is not None:
        product_input["productCategory"] = product_category

    if standard_product_type is not None:
        product_input["standardizedProductType"] = standard_product_type

    if metafields is not None:
        product_input["metafields"] = metafields

    # Build mutation
    mutation = """
    mutation productUpdate($product: ProductUpdateInput!, $media: [CreateMediaInput!]) {
        productUpdate(product: $product, media: $media) {
            product {
                id
                title
                handle
                descriptionHtml
                vendor
                productType
                tags
                status
                createdAt
                updatedAt
                publishedAt
                templateSuffix
                options {
                    id
                    name
                    position
                    optionValues {
                        id
                        name
                        hasVariants
                    }
                }
                seo {
                    title
                    description
                }
                variants(first: 10) {
                    edges {
                        node {
                            id
                            title
                            price
                            sku
                        }
                    }
                }
            }
            userErrors {
                field
                message
            }
        }
    }
    """

    # Prepare variables
    variables: Dict[str, Any] = {"product": product_input}

    if media is not None:
        variables["media"] = media

    # Execute the GraphQL mutation using temporary session
    with client.create_session():
        result = shopify.GraphQL().execute(query=mutation, variables=variables)

    # Parse and return the result
    import json

    result_data = json.loads(result)

    return result_data


async def delete_product(product_id: str) -> Dict[str, Any]:
    """
    Permanently delete a product from Shopify.

    Warning: This operation is irreversible. The product and all its associated data
    (variants, media, etc.) will be permanently deleted.

    Args:
        product_id: The Shopify product ID (e.g., "gid://shopify/Product/123456")

    Returns:
        Dict containing:
        - deletedProductId: The ID of the deleted product
        - userErrors: List of any errors that occurred

    Example:
        result = await delete_product("gid://shopify/Product/123456")
    """

    headers = get_http_headers()
    auth = headers.get("Authorization") or headers.get("authorization")

    if not auth:
        raise ValueError("Authorization header is required")

    # Initialize Shopify client
    client = await ShopifyClient.initialize(auth)

    mutation = """
    mutation productDelete($input: ProductDeleteInput!) {
        productDelete(input: $input) {
            deletedProductId
            userErrors {
                field
                message
            }
        }
    }
    """

    variables = {"input": {"id": product_id}}

    # Execute the GraphQL mutation using temporary session
    with client.create_session():
        result = shopify.GraphQL().execute(query=mutation, variables=variables)

    # Parse and return the result
    import json

    result_data = json.loads(result)

    return result_data


async def publish_product(
    product_id: str, publication_ids: List[str], publish_date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Publish a product to specified sales channels/publications.

    Note: This mutation is deprecated. Consider using publishablePublish instead for new implementations.

    Args:
        product_id: The Shopify product ID (e.g., "gid://shopify/Product/123456")
        publication_ids: List of publication/channel IDs to publish to
            (e.g., ["gid://shopify/Publication/123"])
        publish_date: Optional ISO 8601 datetime string for when to publish
            (e.g., "2024-01-01T00:00:00Z"). If not provided, publishes immediately.

    Returns:
        Dict containing:
        - product: The published product object
        - userErrors: List of any errors that occurred

    Example:
        # Publish immediately to online store
        result = await publish_product(
            product_id="gid://shopify/Product/123456",
            publication_ids=["gid://shopify/Publication/123"]
        )

        # Schedule publish for later
        result = await publish_product(
            product_id="gid://shopify/Product/123456",
            publication_ids=["gid://shopify/Publication/123"],
            publish_date="2024-12-25T00:00:00Z"
        )
    """

    headers = get_http_headers()
    auth = headers.get("Authorization") or headers.get("authorization")

    if not auth:
        raise ValueError("Authorization header is required")

    # Initialize Shopify client
    client = await ShopifyClient.initialize(auth)

    # Build product publications
    product_publications = []
    for pub_id in publication_ids:
        pub = {"publicationId": pub_id}
        if publish_date:
            pub["publishDate"] = publish_date
        product_publications.append(pub)

    mutation = """
    mutation productPublish($input: ProductPublishInput!) {
        productPublish(input: $input) {
            product {
                id
                title
                status
                publishedAt
            }
            userErrors {
                field
                message
            }
        }
    }
    """

    variables = {
        "input": {"id": product_id, "productPublications": product_publications}
    }

    # Execute the GraphQL mutation using temporary session
    with client.create_session():
        result = shopify.GraphQL().execute(query=mutation, variables=variables)

    # Parse and return the result
    import json

    result_data = json.loads(result)

    return result_data


async def unpublish_product(
    product_id: str, publication_ids: List[str]
) -> Dict[str, Any]:
    """
    Unpublish a product from specified sales channels/publications.

    Note: This mutation is deprecated. Consider using publishableUnpublish instead for new implementations.

    Args:
        product_id: The Shopify product ID (e.g., "gid://shopify/Product/123456")
        publication_ids: List of publication/channel IDs to unpublish from
            (e.g., ["gid://shopify/Publication/123"])

    Returns:
        Dict containing:
        - product: The unpublished product object
        - userErrors: List of any errors that occurred

    Example:
        result = await unpublish_product(
            product_id="gid://shopify/Product/123456",
            publication_ids=["gid://shopify/Publication/123"]
        )
    """

    headers = get_http_headers()
    auth = headers.get("Authorization") or headers.get("authorization")

    if not auth:
        raise ValueError("Authorization header is required")

    # Initialize Shopify client
    client = await ShopifyClient.initialize(auth)

    # Build product publications
    product_publications = [{"publicationId": pub_id} for pub_id in publication_ids]

    mutation = """
    mutation productUnpublish($input: ProductUnpublishInput!) {
        productUnpublish(input: $input) {
            product {
                id
                title
                status
                publishedAt
            }
            userErrors {
                field
                message
            }
        }
    }
    """

    variables = {
        "input": {"id": product_id, "productPublications": product_publications}
    }

    # Execute the GraphQL mutation using temporary session
    with client.create_session():
        result = shopify.GraphQL().execute(query=mutation, variables=variables)

    # Parse and return the result
    import json

    result_data = json.loads(result)

    return result_data
