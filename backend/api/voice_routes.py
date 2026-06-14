"""
api/voice_routes.py
--------------------
Voice-to-text transcription endpoint using Groq Whisper or OpenAI Whisper.

Endpoint
--------
POST /voice-input – Accept an audio blob, transcribe it, return {transcript}

Supported audio formats: mp3, mp4, mpeg, mpga, m4a, wav, webm (Whisper)
"""

import os
import tempfile
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from auth.auth_handler import get_current_user
from models.database import User
from models.schemas import VoiceInputResponse
from utils.config import settings
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(tags=["Voice Input"])

# Supported audio extensions for Whisper
SUPPORTED_AUDIO_EXTENSIONS = {
    "mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm", "ogg", "flac"
}

SUPPORTED_AUDIO_MIME_TYPES = {
    "audio/mpeg", "audio/mp4", "audio/wav", "audio/webm",
    "audio/ogg", "audio/flac", "audio/x-flac",
    "video/webm", "video/mp4",  # Browser MediaRecorder often sends video/webm
}


# ── Provider functions ─────────────────────────────────────────────────────

async def _transcribe_with_groq(audio_path: str, filename: str) -> Optional[dict]:
    """
    Transcribe audio using the Groq Whisper API.

    Parameters
    ----------
    audio_path : str
        Absolute path to the temporary audio file.
    filename : str
        Original filename (Groq uses the extension to determine format).

    Returns
    -------
    dict or None
        ``{"transcript": str, "language": str, "model": str}`` or None on failure.
    """
    if not settings.GROQ_API_KEY:
        return None

    try:
        from groq import Groq

        client = Groq(api_key=settings.GROQ_API_KEY)
        with open(audio_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                model="whisper-large-v3",
                file=(filename, audio_file),
                response_format="verbose_json",
                language=None,  # Auto-detect language
            )

        transcript = (
            transcription.text.strip()
            if hasattr(transcription, "text")
            else str(transcription)
        )
        language = (
            getattr(transcription, "language", None)
            or getattr(transcription, "detected_language", None)
        )

        return {
            "transcript": transcript,
            "language": language,
            "model": "whisper-large-v3 (Groq)",
        }

    except Exception as exc:
        logger.error(f"Groq Whisper transcription failed: {exc}")
        return None


async def _transcribe_with_openai(audio_path: str, filename: str) -> Optional[dict]:
    """
    Transcribe audio using the OpenAI Whisper API.

    Parameters
    ----------
    audio_path : str
        Absolute path to the temporary audio file.
    filename : str
        Original filename.

    Returns
    -------
    dict or None
        ``{"transcript": str, "language": str, "model": str}`` or None on failure.
    """
    if not settings.OPENAI_API_KEY:
        return None

    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        with open(audio_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                model="whisper-1",
                file=(filename, audio_file),
                response_format="verbose_json",
            )

        transcript = (
            transcription.text.strip()
            if hasattr(transcription, "text")
            else str(transcription)
        )
        language = getattr(transcription, "language", None)

        return {
            "transcript": transcript,
            "language": language,
            "model": "whisper-1 (OpenAI)",
        }

    except Exception as exc:
        logger.error(f"OpenAI Whisper transcription failed: {exc}")
        return None


# ── Endpoint ───────────────────────────────────────────────────────────────

@router.post(
    "/voice-input",
    response_model=VoiceInputResponse,
    summary="Transcribe an audio recording to text",
)
async def transcribe_voice(
    audio: UploadFile = File(
        ...,
        description="Audio file to transcribe (mp3, wav, webm, m4a, ogg, flac)",
    ),
    current_user: User = Depends(get_current_user),
) -> VoiceInputResponse:
    """
    Accept an audio blob, transcribe it using Groq Whisper (primary) or
    OpenAI Whisper (fallback), and return the transcript.

    The audio file is saved to a temporary path, transcribed, and then
    immediately deleted.

    Parameters
    ----------
    audio : UploadFile
        Audio recording from the browser (typically ``audio/webm`` or ``audio/wav``).

    Returns
    -------
    VoiceInputResponse
        ``{transcript, language, duration_seconds, model_used}``

    Raises
    ------
    HTTPException(400)
        If no audio data is received or the format is not supported.
    HTTPException(503)
        If no transcription API is configured.
    HTTPException(500)
        If transcription fails on all configured providers.
    """
    if not settings.GROQ_API_KEY and not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Voice transcription is not available. "
                "Configure GROQ_API_KEY or OPENAI_API_KEY to enable this feature."
            ),
        )

    # Validate audio content
    first_bytes = await audio.read(256)
    await audio.seek(0)
    if not first_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded audio file is empty.",
        )

    # Determine file extension
    original_name = audio.filename or "recording.webm"
    ext = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else "webm"

    # Accept webm even if MIME is video/webm (common for browser MediaRecorder)
    content_type = audio.content_type or "audio/webm"

    logger.info(
        f"Voice input: user={current_user.id}, "
        f"filename={original_name}, "
        f"content_type={content_type}"
    )

    # Save to temp file for API calls
    temp_filename = f"voice_{uuid.uuid4().hex}.{ext}"
    temp_path = os.path.join(tempfile.gettempdir(), temp_filename)

    try:
        audio_data = await audio.read()
        with open(temp_path, "wb") as tf:
            tf.write(audio_data)

        file_size = len(audio_data)
        logger.debug(f"Audio saved to temp: {temp_path} ({file_size} bytes)")

        # Try transcription providers
        result: Optional[dict] = None

        if settings.GROQ_API_KEY:
            result = await _transcribe_with_groq(temp_path, temp_filename)

        if not result and settings.OPENAI_API_KEY:
            logger.info("Groq transcription failed or unavailable; trying OpenAI Whisper")
            result = await _transcribe_with_openai(temp_path, temp_filename)

        if not result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Transcription failed on all configured providers. Please try again.",
            )

        transcript: str = result.get("transcript", "")
        if not transcript:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No speech detected in the audio recording.",
            )

        logger.info(
            f"Transcription complete: user={current_user.id}, "
            f"model={result.get('model')}, "
            f"transcript_len={len(transcript)}"
        )

        return VoiceInputResponse(
            transcript=transcript,
            language=result.get("language"),
            duration_seconds=None,  # Not all Whisper responses include duration
            model_used=result.get("model"),
        )

    finally:
        # Always clean up the temp file
        if os.path.isfile(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass
