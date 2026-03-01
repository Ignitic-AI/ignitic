from enum import Enum


class Agent(str, Enum):
    PRODUCT_RESEARCHER = "product_researcher"
    MARKETER = "marketer"
    SEO = "seo_agent"
    GDRIVE = "gdrive_agent"
    SHOPIFY = "shopify_agent"
    FACEBOOK_PAGE = "facebook_page_agent"
    INSTAGRAM = "instagram_agent"
