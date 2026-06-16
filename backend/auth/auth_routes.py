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
import random
import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from auth.auth_handler import (
    create_access_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from models.database import User, get_db, PendingOTP
from models.schemas import Token, UserCreate, UserLogin, UserResponse, UserUpdate, OTPRequest
from utils.config import settings
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def send_otp_email(to_email: str, otp: str):
    if not settings.SMTP_USER:
        logger.info(f"✉️ [MOCK EMAIL] OTP for {to_email} is {otp} (SMTP_USER not configured in .env)")
        return False
        
    try:
        msg = MIMEMultipart()
        msg['From'] = settings.SMTP_FROM_EMAIL
        msg['To'] = to_email
        msg['Subject'] = f"DocMind AI - Verification Code: {otp}"
        
        body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; background-color: #0b0b0f; color: #ffffff; padding: 20px; text-align: center;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #12121a; padding: 30px; border-radius: 12px; border: 1px solid #3b0764;">
                    <h2 style="color: #a855f7;">DocMind AI</h2>
                    <p style="color: #cbd5e1; font-size: 16px;">Please use the following 6-digit verification code to complete your signup process:</p>
                    <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #a855f7; background-color: #0f172a; padding: 15px; border-radius: 8px; margin: 20px 0; display: inline-block;">
                        {otp}
                    </div>
                    <p style="color: #64748b; font-size: 12px; margin-top: 20px;">This code will expire in 5 minutes. If you did not request this code, please ignore this email.</p>
                </div>
            </body>
        </html>
        """
        msg.attach(MIMEText(body, 'html'))
        
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=5.0) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM_EMAIL, to_email, msg.as_string())
        logger.info(f"✉️ OTP successfully sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to send OTP email: {e}")
        logger.info(f"✉️ [FALLBACK] OTP for {to_email} is {otp}")
        return False


def store_otp(db, email: str, otp: str):
    expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=5)
    if hasattr(db, "is_mongo"):
        db.db.pending_otps.update_one(
            {"email": email},
            {"$set": {"otp": otp, "expires_at": expires_at}},
            upsert=True
        )
    else:
        existing = db.query(PendingOTP).filter(PendingOTP.email == email).first()
        if existing:
            existing.otp = otp
            existing.expires_at = expires_at
        else:
            new_otp = PendingOTP(email=email, otp=otp, expires_at=expires_at)
            db.add(new_otp)
        db.commit()


def verify_otp_code(db, email: str, otp: str) -> bool:
    now = datetime.datetime.utcnow()
    if hasattr(db, "is_mongo"):
        otp_doc = db.db.pending_otps.find_one({"email": email})
        if otp_doc:
            if otp_doc.get("otp") == otp and otp_doc.get("expires_at") > now:
                db.db.pending_otps.delete_one({"email": email})
                return True
    else:
        otp_record = db.query(PendingOTP).filter(PendingOTP.email == email).first()
        if otp_record:
            if otp_record.otp == otp and otp_record.expires_at > now:
                db.delete(otp_record)
                db.commit()
                return True
    return False


# ── POST /auth/send-otp ────────────────────────────────────────────────────

@router.post(
    "/send-otp",
    summary="Generate and send an OTP verification code",
)
def send_otp(request_data: OTPRequest, db: Session = Depends(get_db)):
    """
    Generate a 6-digit OTP code, save it, and send it via email or print it to logs.
    """
    # Check if user already exists
    existing = db.query(User).filter(User.email == request_data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered. Please use a unique email.",
        )

    # Generate 6-digit OTP
    otp = f"{random.randint(100000, 999999)}"
    
    # Store OTP
    store_otp(db, request_data.email, otp)
    
    # Send email
    email_sent = send_otp_email(request_data.email, otp)
    
    # Construct a helpful message for developers
    msg = "Verification code sent to your email."
    if not settings.SMTP_USER:
        msg = f"Developer Mode: OTP is {otp} (logged in backend terminal)."
    elif not email_sent:
        msg = f"Developer Fallback: Failed to send email via SMTP. OTP is {otp} (SMTP port 587 might be blocked by Render)."
        
    return {"message": msg, "email_sent": email_sent, "debug_otp": None if (settings.SMTP_USER and email_sent) else otp}


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
    """
    # Check for duplicate email
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered. Please use a unique email.",
        )

    # Verify OTP if enabled
    if settings.REQUIRE_OTP:
        if not user_data.otp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification code (OTP) is required to register.",
            )
        if not verify_otp_code(db, user_data.email, user_data.otp):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification code.",
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
    """
    user = db.query(User).filter(User.email == credentials.email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email not registered.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password.",
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

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    logger.info(f"User profile updated: {current_user.email} (id={current_user.id})")
    return UserResponse.model_validate(current_user)
