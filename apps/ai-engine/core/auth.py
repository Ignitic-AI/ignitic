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


class AuthProvider:
    """
    Authentication provider class that handles JWT token validation and user extraction.

    This class encapsulates authentication logic and provides convenient methods
    for accessing user information and tokens.
    """

    def __init__(self, auth: HTTPAuthorizationCredentials):
        """
        Initialize the AuthProvider with HTTP authorization credentials.

        Args:
            auth: HTTP Authorization credentials containing the JWT token

        Raises:
            HTTPException: If authorization is missing or invalid format
        """
        if not auth:
            raise HTTPException(status_code=401, detail="Authorization header required")

        if auth.scheme != "Bearer":
            raise HTTPException(status_code=401, detail="Invalid authorization format")

        self._auth = auth
        self._token = auth.credentials
        self._user = None

    def get_token(self) -> str:
        """
        Get the JWT token string.

        Returns:
            str: The JWT token
        """
        return self._token

    async def get_user(self) -> User:
        """
        Get the authenticated user from the JWT token.

        Returns:
            User: The authenticated user object

        Raises:
            HTTPException: If token is invalid, expired, or missing required claims
        """
        if self._user is not None:
            return self._user

        try:
            # Decode and validate JWT token
            payload = jwt.decode(self._token, JWT_SECRET, algorithms=[JWT_ALGORITHM])

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

            # Create and cache user object
            self._user = User(
                id=str(user_id),
                email=email,
                name=name,
                role=role,
                org_id=str(org_id) if org_id else None,
            )

            logger.debug(
                f"User authenticated successfully: {self._user.email} (ID: {self._user.id})"
            )
            return self._user

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

    def verify_token(self) -> Optional[dict]:
        """
        Verify the JWT token and return payload if valid.

        Returns:
            dict: Token payload if valid, None otherwise
        """
        try:
            payload = jwt.decode(self._token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            return payload
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            return None


# Main auth function - returns AuthProvider instance
def get_auth(auth: HTTPAuthorizationCredentials = Depends(security)) -> AuthProvider:
    """
    Get AuthProvider instance for accessing user and token information.

    Args:
        auth: HTTP Authorization credentials containing the JWT token

    Returns:
        AuthProvider: Configured AuthProvider instance

    Raises:
        HTTPException: If token is invalid or authorization is missing
    """
    return AuthProvider(auth)


# Compatibility functions for existing code
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
    auth_provider = AuthProvider(auth)
    return await auth_provider.get_user()


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
