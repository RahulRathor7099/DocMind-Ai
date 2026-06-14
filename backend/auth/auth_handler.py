"""
auth/auth_handler.py
--------------------
JWT creation/verification, password hashing, and the FastAPI dependency
``get_current_user`` used to protect endpoints.

All cryptographic operations use industry-standard libraries:
- python-jose  → JWT encode / decode
- passlib      → bcrypt password hashing
"""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.orm import Session

from models.database import User, get_db
from utils.config import settings
from utils.logger import get_logger

logger = get_logger(__name__)

# ── Password hashing ──────────────────────────────────────────────────────

# ── HTTP Bearer token scheme ───────────────────────────────────────────────
bearer_scheme = HTTPBearer(auto_error=True)


# ── Token creation ─────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a signed JWT access token.

    Parameters
    ----------
    data : dict
        Payload claims to embed in the token.  Must include ``"sub"``
        (subject / user identifier).
    expires_delta : timedelta, optional
        Custom lifetime.  Defaults to ``ACCESS_TOKEN_EXPIRE_MINUTES``.

    Returns
    -------
    str
        Encoded JWT string.
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta
        if expires_delta
        else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    logger.debug(f"Created access token for subject: {data.get('sub')}")
    return encoded_jwt


# ── Token verification ─────────────────────────────────────────────────────

def verify_token(token: str) -> dict:
    """
    Decode and verify a JWT token.

    Parameters
    ----------
    token : str
        Raw JWT string (without ``Bearer `` prefix).

    Returns
    -------
    dict
        Decoded payload claims.

    Raises
    ------
    HTTPException(401)
        If the token is invalid, expired, or tampered.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        if payload.get("sub") is None:
            raise credentials_exception
        return payload
    except JWTError as exc:
        logger.warning(f"JWT verification failed: {exc}")
        raise credentials_exception from exc


# ── Password utilities ─────────────────────────────────────────────────────

def get_password_hash(password: str) -> str:
    """
    Return a bcrypt hash of *password*.

    Parameters
    ----------
    password : str
        Plain-text password.

    Returns
    -------
    str
        bcrypt hash string safe to persist in the database.
    """
    # Truncate to 72 bytes to comply with bcrypt's hard limit
    password_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Check whether *plain_password* matches *hashed_password*.

    Parameters
    ----------
    plain_password : str
        Plain-text password provided by the user.
    hashed_password : str
        bcrypt hash stored in the database.

    Returns
    -------
    bool
        ``True`` if the passwords match, ``False`` otherwise.
    """
    try:
        plain_bytes = plain_password.encode("utf-8")[:72]
        return bcrypt.checkpw(plain_bytes, hashed_password.encode("utf-8"))
    except Exception:
        return False


# ── FastAPI dependency ─────────────────────────────────────────────────────

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency that extracts and validates the Bearer JWT, then
    returns the authenticated :class:`~models.database.User` ORM object.

    Parameters
    ----------
    credentials : HTTPAuthorizationCredentials
        Automatically extracted from the ``Authorization: Bearer <token>`` header.
    db : Session
        Injected database session.

    Returns
    -------
    User
        The authenticated user record.

    Raises
    ------
    HTTPException(401)
        If the token is invalid or the user does not exist.
    HTTPException(403)
        If the user account is disabled.
    """
    payload = verify_token(credentials.credentials)
    user_id_str: Optional[str] = payload.get("sub")

    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token subject missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = int(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject format",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    return user
