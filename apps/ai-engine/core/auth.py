from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from models.user import User
import jwt
import os
import logging
from typing import Optional

# Configure logging
logger = logging.getLogger(__name__)

load_dotenv()

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "")


# Security scheme
security = HTTPBearer(auto_error=True)


def get_service_user():
    """Create a service user for internal API calls"""
    return User(
        id="service",
        email="service@internal.com",
        name="Service Account",
        role="admin",
        org_id=None,
    )


async def get_service_auth(auth: HTTPAuthorizationCredentials = Depends(security)):
    """Authenticate service-to-service calls using API key"""

    if not auth:
        raise HTTPException(status_code=401, detail="Authorization header required")

    if auth.scheme != "Bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization format")

    service_api_key = os.getenv("SERVICE_API_KEY")
    if not service_api_key:
        raise HTTPException(status_code=500, detail="Service API key not configured")

    if auth.credentials != service_api_key:
        raise HTTPException(status_code=401, detail="Invalid service API key")

    return get_service_user()


async def get_user_auth(auth: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """
    Validate JWT token and return current user.

    Args:
        auth: HTTP Authorization credentials containing the JWT token

    Returns:
        User: Current authenticated user

    Raises:
        HTTPException: If token is invalid, expired, or missing required claims
    """

    if not auth:
        raise HTTPException(status_code=401, detail="Authorization header required")

    if auth.scheme != "Bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization format")

    try:
        # Decode and validate JWT token
        payload = jwt.decode(auth.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])

        # Extract user information from payload
        user_id = payload.get("user_id")
        email = payload.get("email")
        role = payload.get("role", "user")
        name = payload.get("name")
        org_id = payload.get("org_id")

        # Validate required fields
        if not user_id or not email:
            logger.warning(
                f"JWT token missing required claims: user_id={user_id}, email={email}"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing required claims",
            )

        # Create and return user object
        user = User(
            id=str(user_id),
            email=email,
            name=name,
            role=role,
            org_id=str(org_id) if org_id else None,
        )

        logger.debug(f"User authenticated successfully: {user.email} (ID: {user.id})")
        return user

    except jwt.ExpiredSignatureError:
        logger.warning("JWT token expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired"
        )
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )
    except Exception as e:
        logger.error(f"Unexpected error during JWT validation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication error",
        )


async def get_current_user_or_service(
    auth: HTTPAuthorizationCredentials = Depends(security),
) -> User:
    """Accept either JWT token or service API key"""
    try:
        return await get_service_auth(auth)
    except Exception as _:
        return await get_user_auth(auth)


def verify_jwt_token(token: str) -> Optional[dict]:
    """
    Verify JWT token and return payload if valid.

    Args:
        token: JWT token string

    Returns:
        dict: Token payload if valid, None otherwise
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None
