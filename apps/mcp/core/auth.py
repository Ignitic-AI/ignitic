from dotenv import load_dotenv
from models.user import User
import jwt
import os
import logging
from typing import Optional
from utils.exception_handling import UnauthorizedError

# Configure logging
logger = logging.getLogger(__name__)

load_dotenv()

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "")

async def get_user_auth(credentials: str) -> User:
    """
    Validate JWT token and return current user.

    Args:
        auth: HTTP Authorization credentials containing the JWT token

    Returns:
        User: Current authenticated user

    Raises:
        HTTPException: If token is invalid, expired, or missing required claims
    """

    if not credentials:
        raise UnauthorizedError()

    if not credentials.startswith("Bearer "):
        raise Exception("Invalid authorization format")

    try:
        token = credentials.split()[-1]
        # Decode and validate JWT token
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])

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
            raise UnauthorizedError()

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
        raise UnauthorizedError()
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT token: {str(e)}")
        raise UnauthorizedError()
    except Exception as e:
        logger.error(f"Unexpected error during JWT validation: {str(e)}")
        raise Exception("Authentication error")
    
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
