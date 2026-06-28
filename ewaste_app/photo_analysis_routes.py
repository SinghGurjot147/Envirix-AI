"""
photo_analysis_routes.py
==========================
NEW FILE — does not modify any existing module.

Defines an isolated Flask Blueprint exposing:

    POST /photo-analysis

This Blueprint is fully self-contained and does not touch any existing
route in app.py. To activate it, app.py only needs two additive lines
(no existing line changes):

    from photo_analysis_routes import photo_analysis_bp
    app.register_blueprint(photo_analysis_bp)

Everything else (validation, Gemini call, scoring, recommendation) is
delegated to photo_analysis.py and photo_analysis_engine.py — this file
only handles HTTP concerns: request parsing, status codes, error
translation, and response shaping.
"""

from flask import Blueprint, jsonify, request

from photo_analysis import (
    GeminiVisionError,
    PhotoValidationError,
    UnsupportedDeviceError,
    call_gemini_vision,
    parse_gemini_json,
    store_latest_photo_analysis,
    validate_device_supported,
    validate_image_upload,
)
from photo_analysis_engine import analyze_detection

# Isolated Blueprint name avoids any collision with existing route names
# registered directly on `app` in app.py.
photo_analysis_bp = Blueprint("photo_analysis", __name__)


@photo_analysis_bp.route("/photo-analysis", methods=["POST"])
def photo_analysis_endpoint():
    """Accept an uploaded device photo, run it through Gemini Vision for
    detection, run the detection through the Python analysis engine for
    scoring/recommendation, and return a single structured JSON payload
    ready for the result page and for forwarding to /predict.

    Expected request: multipart/form-data with a single file field.
    Accepts either field name "image" or "photo" for flexibility with
    whatever the existing dropzone's fetch call sends.
    """
    uploaded_file = request.files.get("image") or request.files.get("photo")

    # ---- 1. Validate upload -------------------------------------------------
    try:
        image_bytes = validate_image_upload(uploaded_file)
    except PhotoValidationError as exc:
        return jsonify({"error": str(exc)}), 400

    mime_type = uploaded_file.mimetype

    # ---- 2. Call Gemini Vision (detection only) -----------------------------
    try:
        raw_response = call_gemini_vision(image_bytes, mime_type)
        detection = parse_gemini_json(raw_response)
    except GeminiVisionError as exc:

        error = str(exc)

        if "RESOURCE_EXHAUSTED" in error or "429" in error:

            return jsonify({
            "error": (
                "AI Photo Analysis is temporarily unavailable because the AI request limit "
                "has been reached.\n\n"
                "Please wait about a minute and try again. \n\n"
                "You can still use Device Analysis, Forecasting, Dashboard, and EcoBot."
            )
        }), 429

        return jsonify({
        "error": "Unable to analyze the uploaded image. Please try again."
    }), 502
    except Exception as exc:  # network/timeout/unexpected SDK errors
        return jsonify({"error": f"Photo analysis failed: {exc}"}), 502

    # ---- 3. Reject unsupported devices --------------------------------------
    try:
        validate_device_supported(detection)
    except UnsupportedDeviceError as exc:
        return jsonify({"error": str(exc)}), 422

    # ---- 4. Python analysis engine (scoring, recommendation, insights) -----
    try:
        result = analyze_detection(detection)
    except Exception as exc:
        return jsonify({"error": f"Could not complete analysis: {exc}"}), 500

    # ---- 5. Store for EcoBot follow-up context ------------------------------
    store_latest_photo_analysis(result)

    return jsonify(result), 200


@photo_analysis_bp.errorhandler(413)
def handle_payload_too_large(_exc):
    """Flask-level guard if MAX_CONTENT_LENGTH is configured on the app
    and a request exceeds it before even reaching this Blueprint's own
    size check in validate_image_upload().
    """
    return jsonify({"error": "Image is too large. Maximum allowed size is 10 MB."}), 413
