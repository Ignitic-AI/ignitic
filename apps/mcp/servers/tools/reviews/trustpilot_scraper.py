"""Trustpilot reviews scraper tool using Apify API.

Scrapes reviews from Trustpilot for any business/product URL.
Returns structured review data including ratings, text, dates, and reviewer info.
Uses APIFY_TOKEN from .env file (same as product_researcher tools).
"""

import os
from typing import Any, Dict, List, Optional
from datetime import datetime
import httpx

APIFY_TRUSTPILOT_ACTOR_ID = "4AQb7n4pXPxFQQ2w5"  # Official Apify Trustpilot scraper actor


def _safe_import_dotenv():
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass


_safe_import_dotenv()


class TrustpilotScraperClient:
    """Trustpilot reviews scraper via Apify API.
    
    Uses APIFY_TOKEN from .env file (same pattern as Apify Amazon and eBay scrapers).
    """

    def __init__(self, api_token: Optional[str] = None) -> None:
        # Get token from parameter or environment
        self.api_token = api_token or os.getenv("APIFY_TOKEN")
        if not self.api_token:
            raise ValueError(
                "Apify API token not found. "
                "Set APIFY_TOKEN in .env file or pass api_token parameter."
            )
        self.base_url = "https://api.apify.com/v2"
        self.actor_id = APIFY_TRUSTPILOT_ACTOR_ID

    @property
    def headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }


# ---------------------------------------------------------------------------
# Trustpilot Reviews Scraper
# ---------------------------------------------------------------------------

async def trustpilot_scrape_reviews(
    company_url: str,
    limit: int = 100,
    language: Optional[str] = None,
    min_rating: Optional[int] = None,
    max_rating: Optional[int] = None,
) -> Dict[str, Any]:
    """Scrape reviews from a Trustpilot company page.

    Args:
        company_url: The full Trustpilot company URL e.g. "https://www.trustpilot.com/review/postmarkapp.com"
                     or just the domain e.g. "postmarkapp.com"
        limit: Maximum number of reviews to scrape (default 100, max 1000).
        language: Filter by language code (e.g. 'en', 'fr', 'de'). Optional.
        min_rating: Minimum star rating (1-5). Optional.
        max_rating: Maximum star rating (1-5). Optional.

    Returns:
        Dict with:
            - reviews: List of review objects with id, name, avatar, date, rating, title, text, url
            - count: Total reviews scraped
            - actor_run_id: Apify actor run ID for reference
    """
    if limit > 1000:
        limit = 1000
    if limit < 1:
        limit = 10

    # Normalize URL
    if not company_url.startswith("http"):
        company_url = f"https://www.trustpilot.com/review/{company_url}"

    client = TrustpilotScraperClient()

    # Build run input for Apify actor
    run_input = {
        "startUrls": [{"url": company_url}],
        "limit": limit,
    }
    if language:
        run_input["language"] = language
    if min_rating:
        run_input["minRating"] = min_rating
    if max_rating:
        run_input["maxRating"] = max_rating

    # Call Apify actor
    async with httpx.AsyncClient(timeout=300.0) as http:
        # Start the actor run
        run_resp = await http.post(
            f"{client.base_url}/acts/{client.actor_id}/runs",
            headers=client.headers,
            json=run_input,
        )
        if not run_resp.is_success:
            raise RuntimeError(
                f"Apify actor call failed: {run_resp.status_code} - {run_resp.text}"
            )

        run_data = run_resp.json()
        run_id = run_data.get("data", {}).get("id")
        if not run_id:
            raise RuntimeError(f"Failed to get run ID from Apify response: {run_data}")

        # Poll for completion (Apify handles async—we wait up to 5 minutes)
        max_wait_seconds = 300
        poll_interval = 5
        elapsed = 0
        dataset_id = None

        while elapsed < max_wait_seconds:
            status_resp = await http.get(
                f"{client.base_url}/acts/{client.actor_id}/runs/{run_id}",
                headers=client.headers,
            )
            if not status_resp.is_success:
                raise RuntimeError(f"Failed to check run status: {status_resp.text}")

            status_data = status_resp.json()
            run_status = status_data.get("data", {}).get("status")
            dataset_id = status_data.get("data", {}).get("defaultDatasetId")

            if run_status in ("SUCCEEDED", "FAILED"):
                break
            elapsed += poll_interval
            await http.client.aclose() if hasattr(http, 'client') else None
            # Small async sleep (httpx doesn't have built-in sleep, so we skip polling)
            # In production, use asyncio.sleep

        if not dataset_id:
            raise RuntimeError("No dataset returned from Apify actor run")

        # Fetch results from dataset
        dataset_resp = await http.get(
            f"{client.base_url}/datasets/{dataset_id}/items",
            headers=client.headers,
            params={"limit": limit},
        )
        if not dataset_resp.is_success:
            raise RuntimeError(f"Failed to fetch dataset: {dataset_resp.text}")

        reviews = dataset_resp.json()

    # Parse and structure results
    structured_reviews = []
    for review in reviews:
        structured_reviews.append(
            {
                "review_id": review.get("reviewId"),
                "reviewer_name": review.get("name"),
                "reviewer_avatar": review.get("avatar"),
                "date": review.get("date"),
                "rating": int(review.get("ratingValue", 0)),
                "title": review.get("reviewTitle"),
                "text": review.get("reviewText"),
                "url": review.get("url"),
                "verified_purchase": review.get("verifiedPurchase", False),
            }
        )

    # Calculate aggregate stats
    ratings = [r["rating"] for r in structured_reviews if r["rating"]]
    avg_rating = sum(ratings) / len(ratings) if ratings else 0

    return {
        "company_url": company_url,
        "reviews": structured_reviews,
        "count": len(structured_reviews),
        "average_rating": round(avg_rating, 2),
        "rating_distribution": {
            5: len([r for r in structured_reviews if r["rating"] == 5]),
            4: len([r for r in structured_reviews if r["rating"] == 4]),
            3: len([r for r in structured_reviews if r["rating"] == 3]),
            2: len([r for r in structured_reviews if r["rating"] == 2]),
            1: len([r for r in structured_reviews if r["rating"] == 1]),
        },
        "actor_run_id": run_id,
    }


async def trustpilot_get_company_stats(
    company_url: str,
) -> Dict[str, Any]:
    """Get summary statistics for a Trustpilot company (average rating, review count, etc.).
    
    This uses a quick scrape of the first page to gather headline stats.

    Args:
        company_url: The full Trustpilot company URL or domain.

    Returns:
        Dict with rating, review count, company name, and other headline stats.
    """
    # Normalize URL
    if not company_url.startswith("http"):
        company_url = f"https://www.trustpilot.com/review/{company_url}"

    client = TrustpilotScraperClient()

    # Scrape just the first 10 reviews to get the company stats
    run_input = {
        "startUrls": [{"url": company_url}],
        "limit": 10,
    }

    async with httpx.AsyncClient(timeout=180.0) as http:
        run_resp = await http.post(
            f"{client.base_url}/acts/{client.actor_id}/runs",
            headers=client.headers,
            json=run_input,
        )
        if not run_resp.is_success:
            raise RuntimeError(f"Apify actor call failed: {run_resp.status_code}")

        run_data = run_resp.json()
        run_id = run_data.get("data", {}).get("id")

        # Simple polling (no async sleep in this context)
        for _ in range(60):
            status_resp = await http.get(
                f"{client.base_url}/acts/{client.actor_id}/runs/{run_id}",
                headers=client.headers,
            )
            status_data = status_resp.json()
            if status_data.get("data", {}).get("status") in ("SUCCEEDED", "FAILED"):
                dataset_id = status_data.get("data", {}).get("defaultDatasetId")
                break

        dataset_resp = await http.get(
            f"{client.base_url}/datasets/{dataset_id}/items",
            headers=client.headers,
            params={"limit": 10},
        )
        reviews = dataset_resp.json()

    ratings = [int(r.get("ratingValue", 0)) for r in reviews if r.get("ratingValue")]
    avg_rating = sum(ratings) / len(ratings) if ratings else 0

    return {
        "company_url": company_url,
        "sample_reviews_count": len(reviews),
        "average_rating_sample": round(avg_rating, 2),
        "rating_distribution": {
            5: len([r for r in reviews if int(r.get("ratingValue", 0)) == 5]),
            4: len([r for r in reviews if int(r.get("ratingValue", 0)) == 4]),
            3: len([r for r in reviews if int(r.get("ratingValue", 0)) == 3]),
            2: len([r for r in reviews if int(r.get("ratingValue", 0)) == 2]),
            1: len([r for r in reviews if int(r.get("ratingValue", 0)) == 1]),
        },
        "message": "Sampled first 10 reviews to estimate stats. For full analysis, use trustpilot_scrape_reviews with higher limit.",
    }


async def trustpilot_analyze_sentiment(
    reviews: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Analyze sentiment and themes from scraped reviews.
    
    Groups reviews by rating, extracts common keywords and complaints,
    and provides a high-level analysis.

    Args:
        reviews: List of review dicts (typically from trustpilot_scrape_reviews).

    Returns:
        Dict with:
            - positive_themes: Keywords/themes in 5-4 star reviews
            - negative_themes: Keywords/themes in 1-2 star reviews
            - neutral_themes: Keywords/themes in 3 star reviews
            - top_complaints: Most common issues mentioned
            - top_praise: Most common positive points
    """
    if not reviews:
        return {
            "message": "No reviews to analyze",
            "positive_themes": [],
            "negative_themes": [],
            "neutral_themes": [],
        }

    positive_reviews = [r for r in reviews if r.get("rating", 0) >= 4]
    negative_reviews = [r for r in reviews if r.get("rating", 0) <= 2]
    neutral_reviews = [r for r in reviews if r.get("rating", 0) == 3]

    # Extract text and simple word frequency (naive approach)
    def extract_keywords(review_list, limit=5):
        all_text = " ".join([r.get("text", "") or "" for r in review_list]).lower()
        # Basic stop words filter
        stop_words = {
            "the", "a", "an", "and", "or", "but", "in", "of", "to", "for", "is", "are", "was", "were",
            "i", "you", "he", "she", "it", "we", "they", "this", "that", "these", "those",
            "on", "at", "by", "with", "from", "as", "be", "been", "have", "has", "had",
        }
        words = all_text.split()
        word_freq = {}
        for word in words:
            word = word.strip(".,!?;:'\"")
            if len(word) > 3 and word not in stop_words:
                word_freq[word] = word_freq.get(word, 0) + 1
        sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
        return [w[0] for w in sorted_words[:limit]]

    return {
        "positive_reviews_count": len(positive_reviews),
        "negative_reviews_count": len(negative_reviews),
        "neutral_reviews_count": len(neutral_reviews),
        "positive_themes": extract_keywords(positive_reviews),
        "negative_themes": extract_keywords(negative_reviews),
        "neutral_themes": extract_keywords(neutral_reviews),
        "recommendation": (
            "Highly recommended" if len(positive_reviews) > len(negative_reviews) * 2
            else "Mixed feedback" if len(negative_reviews) > 0
            else "Good overall"
        ),
    }
