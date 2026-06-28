"""
photo_analysis.py
===================
NEW FILE — does not modify any existing module.

Helper functions for the AI Photo Analysis feature:
    - Upload validation (file type, extension, size)
    - Gemini Vision communication (detection ONLY — no business logic)
    - Safe JSON parsing of Gemini's response
    - A small in-memory store so EcoBot can answer follow-up questions
      about the most recent photo analysis without a new upload

photo_analysis_routes.py imports from this module and from
photo_analysis_engine.py to build the /photo-analysis endpoint.

Architecture reminder (per spec): Gemini Vision ONLY detects. Every score,
recommendation, and insight is computed in photo_analysis_engine.py.
"""

import json
import os
import re
from typing import Any, Dict, Optional, Tuple

from werkzeug.datastructures import FileStorage

from photo_analysis_config import (
    ALLOWED_EXTENSIONS,
    ALLOWED_MIME_TYPES,
    GEMINI_PHOTO_ANALYSIS_SYSTEM_PROMPT,
    GEMINI_VISION_MODEL,
    MAX_UPLOAD_SIZE_BYTES,
    SUPPORTED_DEVICE_TYPES,
)


# ---------------------------------------------------------------------------
# Custom exceptions — let the route layer translate these into clean HTTP
# responses without scattering string-matching logic everywhere.
# ---------------------------------------------------------------------------

class PhotoValidationError(Exception):
    """Raised when an uploaded file fails validation before reaching Gemini."""


class UnsupportedDeviceError(Exception):
    """Raised when Gemini detects a device type outside Smartphone/Laptop/Tablet."""


class GeminiVisionError(Exception):
    """Raised when the Gemini Vision call fails or returns unusable output."""


# ---------------------------------------------------------------------------
# Upload validation
# ---------------------------------------------------------------------------

def get_file_extension(filename: str) -> str:
    """Return the lowercase extension of filename without the leading dot."""
    if not filename or "." not in filename:
        return ""
    return filename.rsplit(".", 1)[1].lower()


def validate_image_upload(file: Optional[FileStorage]) -> bytes:
    """Validate an uploaded image file and return its raw bytes.

    Checks (per spec):
        - A file was actually provided
        - Extension is one of png/jpg/jpeg/webp
        - MIME type matches an allowed image type
        - Size does not exceed MAX_UPLOAD_SIZE_BYTES (10 MB)

    Raises PhotoValidationError with a user-friendly message on failure.
    Returns the raw image bytes on success (caller passes these to Gemini).
    """
    if file is None or file.filename == "":
        raise PhotoValidationError("No image was uploaded. Please select a photo.")

    extension = get_file_extension(file.filename)
    if extension not in ALLOWED_EXTENSIONS:
        raise PhotoValidationError(
            "Unsupported file type. Please upload a PNG, JPG, JPEG, or WEBP image."
        )

    if file.mimetype not in ALLOWED_MIME_TYPES:
        raise PhotoValidationError(
            "This file doesn't look like a supported image. "
            "Please upload a PNG, JPG, JPEG, or WEBP photo."
        )

    # Read once to measure size, then rewind so the caller can read it again.
    file.stream.seek(0)
    image_bytes = file.stream.read()
    file.stream.seek(0)

    if len(image_bytes) == 0:
        raise PhotoValidationError("The uploaded file is empty. Please try another photo.")

    if len(image_bytes) > MAX_UPLOAD_SIZE_BYTES:
        raise PhotoValidationError(
            f"Image is too large. Maximum allowed size is "
            f"{MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB."
        )

    return image_bytes


# ---------------------------------------------------------------------------
# Gemini Vision communication
# ---------------------------------------------------------------------------
# NOTE on integration: this project already has a `gemini_client.py` used
# by EcoBot (see `generate_ecobot_response` imported in app.py). That file
# was not available when this module was written, so the call below uses
# the `google-genai` SDK directly and is fully self-contained. If the
# existing gemini_client.py already exposes a generic "call Gemini with an
# image" helper, swap the body of `call_gemini_vision()` below to use it
# instead — the rest of this module only depends on this function's
# return type (a dict), not on how it talks to Gemini.

from google import genai

API_KEYS = [
    os.getenv("GEMINI_API_KEY_1"),
    os.getenv("GEMINI_API_KEY_2"),
    os.getenv("GEMINI_API_KEY_3"),
    os.getenv("GEMINI_API_KEY_4"),
    os.getenv("GEMINI_API_KEY_5"),
]

API_KEYS = [k for k in API_KEYS if k]

if not API_KEYS:
    raise GeminiVisionError("No Gemini API keys found.")

current_key_index = 0


def _get_gemini_client():
    global current_key_index

    return genai.Client(
        api_key=API_KEYS[current_key_index]
    )


def call_gemini_vision(image_bytes: bytes, mime_type: str) -> str:

    global current_key_index

    from google.genai import types

    last_error = None

    for _ in range(len(API_KEYS)):

        client = _get_gemini_client()

        try:

            response = client.models.generate_content(
                model=GEMINI_VISION_MODEL,
                contents=[
                    types.Part.from_bytes(
                        data=image_bytes,
                        mime_type=mime_type,
                    ),
                    GEMINI_PHOTO_ANALYSIS_SYSTEM_PROMPT,
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                ),
            )

            text = (response.text or "").strip()

            if not text:
                raise GeminiVisionError("Gemini returned an empty response.")

            return text

        except Exception as exc:

            last_error = exc
            error = str(exc).lower()

            if (
                "429" in error
                or "quota" in error
                or "rate" in error
                or "resource_exhausted" in error
            ):

                current_key_index = (current_key_index + 1) % len(API_KEYS)

                print(f"[Photo AI] Switched to API Key {current_key_index + 1}")

                continue

            raise GeminiVisionError(
                f"Gemini Vision request failed: {exc}"
            ) from exc

    raise GeminiVisionError(
        f"All Gemini API keys exhausted.\n{last_error}"
    )
# ---------------------------------------------------------------------------
# Safe JSON parsing
# ---------------------------------------------------------------------------

_JSON_FENCE_PATTERN = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)


def parse_gemini_json(raw_text: str) -> Dict[str, Any]:
    """Safely parse Gemini's response text into a dict.

    Strips accidental markdown code fences (some models add them even
    when instructed not to) before parsing. Raises GeminiVisionError with
    a friendly message if the result isn't valid JSON.
    """
    cleaned = _JSON_FENCE_PATTERN.sub("", raw_text.strip())

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise GeminiVisionError(
            "Couldn't read the analysis result. Please try again with a clearer photo."
        ) from exc

    if not isinstance(data, dict):
        raise GeminiVisionError(
            "Couldn't read the analysis result. Please try again with a clearer photo."
        )

    return data


def validate_device_supported(detection: Dict[str, Any]) -> None:
    """Raise UnsupportedDeviceError if Gemini did not detect a supported
    device type (Smartphone, Laptop, Tablet).
    """
    device_type = (detection.get("device_type") or "").strip()
    if device_type not in SUPPORTED_DEVICE_TYPES:
        raise UnsupportedDeviceError(
            "This doesn't look like a smartphone, laptop, or tablet. "
            "Please upload a clear photo of one of these device types."
        )


# ---------------------------------------------------------------------------
# Latest-result store (for EcoBot follow-up context)
# ---------------------------------------------------------------------------
# Mirrors the simplicity of app.py's existing `chat_history` module-level
# list — an in-memory store is consistent with how this project already
# tracks session state (no database / no auth layer in app.py today).
#
# INTEGRATION NOTE for app.py's /chat route: import
# `get_latest_photo_analysis()` from this module and, if it returns a
# non-None value, prepend a short summary of it to the prompt context sent
# to `generate_ecobot_response()` so EcoBot can answer questions like
# "why was repair recommended?" without a new upload. This is the only
# touch point this feature needs inside app.py, and it's additive
# (wrap in `if get_latest_photo_analysis():`) — no existing line needs to
# change.

_latest_photo_analysis: Optional[Dict[str, Any]] = None


def store_latest_photo_analysis(result: Dict[str, Any]) -> None:
    """Store the most recent photo analysis result for EcoBot context."""
    global _latest_photo_analysis
    _latest_photo_analysis = result


def get_latest_photo_analysis() -> Optional[Dict[str, Any]]:
    """Return the most recent photo analysis result, or None if no photo
    has been analyzed yet this session.
    """
    return _latest_photo_analysis


def build_ecobot_context_snippet(result: Dict[str, Any]) -> str:
    """Build a short plain-text summary of a photo analysis result,
    suitable for prepending to EcoBot's prompt context so it can answer
    questions about the device without requiring a new upload.
    """
    damages = ", ".join(result.get("damages", [])) or "none reported"
    return (
        f"[Photo analysis context] Device: {result.get('device_type')}. "
        f"Health score: {result.get('health_score')}/100. "
        f"Condition: {result.get('condition')}. "
        f"Detected damage: {damages}. "
        f"Recommendation: {result.get('recommendation')}. "
        f"Summary: {result.get('summary')}"
    )
