"""
auth/auth_routes.py
-------------------
FastAPI router exposing authentication endpoints:

    POST /auth/register   – create a new user account
    POST /auth/login      – authenticate and receive JWT
    GET  /auth/me         – return current authenticated user
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth.auth_handler import (
    create_access_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from models.database import User, get_db
from models.schemas import Token, UserCreate, UserLogin, UserResponse, UserUpdate
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── POST /auth/register ────────────────────────────────────────────────────

@router.post(
    "/register",
    response_model=Token,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
def register(user_data: UserCreate, db: Session = Depends(get_db)) -> Token:
    """
    Create a new user account and return a JWT token on success.

    - Validates that the email is not already registered.
    - Hashes the password with bcrypt before persisting.
    - Returns a Bearer JWT plus basic user info.

    Raises
    ------
    HTTPException(409)
        If the email address is already in use.
    """
    # Check for duplicate email
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    # Persist new user
    new_user = User(
        email=user_data.email,
        name=user_data.name,
        password_hash=get_password_hash(user_data.password),
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    logger.info(f"New user registered: {new_user.email} (id={new_user.id})")

    # Issue token
    token = create_access_token(data={"sub": str(new_user.id)})
    return Token(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(new_user),
    )


# ── POST /auth/login ───────────────────────────────────────────────────────

@router.post(
    "/login",
    response_model=Token,
    summary="Authenticate and receive a JWT token",
)
def login(credentials: UserLogin, db: Session = Depends(get_db)) -> Token:
    """
    Verify user credentials and return a JWT token.

    - Looks up the user by email.
    - Verifies the bcrypt password hash.
    - Returns a Bearer JWT plus basic user info.

    Raises
    ------
    HTTPException(401)
        If the email is not found or the password is incorrect.
    HTTPException(403)
        If the account is disabled.
    """
    user = db.query(User).filter(User.email == credentials.email).first()

    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been disabled. Please contact support.",
        )

    logger.info(f"User logged in: {user.email} (id={user.id})")

    token = create_access_token(data={"sub": str(user.id)})
    return Token(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


# ── GET /auth/me ───────────────────────────────────────────────────────────

@router.get(
    "/me",
    response_model=UserResponse,
    summary="Retrieve the currently authenticated user",
)
def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    """
    Return profile information for the authenticated user.

    Requires a valid ``Authorization: Bearer <token>`` header.
    """
    return UserResponse.model_validate(current_user)


# ── PUT /auth/profile ────────────────────────────────────────────────────────

@router.put(
    "/profile",
    response_model=UserResponse,
    summary="Update profile information for the authenticated user",
)
def update_profile(
    update_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    """
    Update the authenticated user's name and/or email.
    """
    if update_data.name is not None:
        current_user.name = update_data.name
    
    if update_data.email is not None:
        # Check if email is already in use by another user
        if update_data.email != current_user.email:
            existing = db.query(User).filter(User.email == update_data.email).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An account with this email address already exists.",
                )
            current_user.email = update_data.email

    db.commit()
    db.refresh(current_user)
    logger.info(f"User profile updated: {current_user.email} (id={current_user.id})")
    return UserResponse.model_validate(current_user)
