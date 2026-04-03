from enum import Enum


class Agent(str, Enum):
    PRODUCT_RESEARCHER = "product_researcher"
    MARKETER = "marketer"
    SEO = "seo_agent"
    GDRIVE = "gdrive_agent"
    SHOPIFY = "shopify_agent"
    HUBSPOT = "hubspot_agent"
    FACEBOOK_PAGE = "facebook_page_agent"
    INSTAGRAM = "instagram_agent"
    EMAIL_MARKETING = "email_marketing_agent"
    CUSTOMER_SUPPORT = "customer_support_agent"
    ANALYTICS = "analytics_agent"
    META_ADS = "meta_ads_agent"
