"""
photo_analysis_config.py
=========================
NEW FILE — does not modify any existing module.

Centralized constants for the AI Photo Analysis feature:
  - Upload validation rules (file types / size)
  - Supported device types
  - Gemini prompt / response contract
  - Health score weighting
  - Recommendation thresholds
  - Sell / Donate / Recycle platform directories

Import from here in photo_analysis.py, photo_analysis_engine.py, and
photo_analysis_routes.py so every module shares one source of truth.
No Flask, no Gemini SDK, no I/O — plain constants only.
"""

# ---------------------------------------------------------------------------
# Upload validation
# ---------------------------------------------------------------------------

ALLOWED_MIME_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
}

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}

MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB, per spec


# ---------------------------------------------------------------------------
# Supported devices
# ---------------------------------------------------------------------------

SUPPORTED_DEVICE_TYPES = {"Smartphone", "Laptop", "Tablet"}

# Mirrors app.py's existing condition vocabulary (CONDITION_MULTIPLIER /
# condition_scores in app.py) so the photo module's output can be handed
# straight to the existing /predict endpoint without translation.
CONDITION_LEVELS = ["Excellent", "Good", "Average", "Poor", "Damaged"]

# Gemini is asked to grade using these five labels (richer than the
# Excellent/Good/Average/Poor/Damaged tiers used by /predict). Python maps
# between the two — see CONDITION_TO_APP_CONDITION below.
GEMINI_CONDITION_LEVELS = ["Excellent", "Good", "Fair", "Poor", "Critical"]

# Maps Gemini's 5-tier condition vocabulary onto the existing app's
# condition vocabulary, so the result of photo analysis can be forwarded
# directly into the existing /predict endpoint as the "condition" field
# without asking the user to pick it manually.
CONDITION_TO_APP_CONDITION = {
    "Excellent": "Excellent",
    "Good": "Good",
    "Fair": "Average",
    "Poor": "Poor",
    "Critical": "Damaged",
}


# ---------------------------------------------------------------------------
# Damage vocabulary (closed set — Gemini must choose from this list)
# ---------------------------------------------------------------------------

DAMAGE_TYPES = [
    "Screen Crack",
    "Broken Display",
    "Scratches",
    "Dent",
    "Bent Frame",
    "Broken Hinge",
    "Missing Keys",
    "Broken Keys",
    "Damaged Camera",
    "Camera Crack",
    "Charging Port Damage",
    "USB Damage",
    "Water Damage",
    "Heavy Wear",
    "No Visible Damage",
    "Multiple Damages",
]

# Damages that materially reduce repairability / are costly to fix.
# Used by the recommendation engine as a "hard" signal independent of the
# numeric health score (e.g. water damage should never be casually
# recommended for "Reuse" even if the score is borderline).
SEVERE_DAMAGE_TYPES = {
    "Water Damage",
    "Broken Display",
    "Bent Frame",
    "Broken Hinge",
    "Multiple Damages",
}


# ---------------------------------------------------------------------------
# Component condition vocabulary (per-part ratings Gemini returns)
# ---------------------------------------------------------------------------

COMPONENT_CONDITION_SCORES = {
    "Excellent": 100,
    "Good": 85,
    "Fair": 60,
    "Moderate": 60,   # synonym some prompts may return; treated identically
    "Poor": 30,
    "Critical": 10,
    "N/A": None,       # component not applicable to this device type
    "Unknown": None,   # component not visible / not assessable from photo
}


# ---------------------------------------------------------------------------
# Health Score weighting
# ---------------------------------------------------------------------------
# Weights sum to 1.0. Keyboard/hinge only applies to laptops; when N/A,
# its weight is redistributed proportionally across the remaining
# applicable components by the engine (see redistribute_weights()).

HEALTH_SCORE_WEIGHTS = {
    "screen_damage": 0.40,
    "body_damage": 0.20,
    "camera_condition": 0.10,
    "ports": 0.10,
    "keyboard_hinge": 0.20,  # keyboard_condition (laptop) or hinge_condition
}


# ---------------------------------------------------------------------------
# Condition tier thresholds (derived from the numeric Health Score)
# ---------------------------------------------------------------------------

HEALTH_SCORE_CONDITION_THRESHOLDS = [
    (85, "Excellent"),
    (65, "Good"),
    (45, "Fair"),
    (25, "Poor"),
    (0, "Critical"),
]


# ---------------------------------------------------------------------------
# Recommendation engine thresholds
# ---------------------------------------------------------------------------
# Python — not Gemini — makes this decision. Health score is the primary
# signal; SEVERE_DAMAGE_TYPES can downgrade a recommendation regardless of
# score (see photo_analysis_engine.recommend_action).

RECOMMENDATION_THRESHOLDS = [
    (80, "Reuse"),
    (60, "Repair"),
    (40, "Refurbish"),
    (20, "Recycle"),
    (0, "Dispose"),
]

RECOMMENDATION_ENVIRONMENTAL_INSIGHTS = {
    "Reuse": (
        "This device is in strong working condition. Continuing to use it "
        "avoids the environmental cost of manufacturing a replacement — "
        "production is responsible for most of a device's lifetime carbon "
        "footprint."
    ),
    "Repair": (
        "Repairing this device instead of replacing it can significantly "
        "reduce electronic waste and extend its usable life, avoiding the "
        "resource cost of producing a new unit."
    ),
    "Refurbish": (
        "Refurbishing recovers most of the device's remaining value while "
        "keeping it in circulation longer, reducing demand for newly mined "
        "materials such as rare earth metals and cobalt."
    ),
    "Recycle": (
        "At this condition level, certified recycling is the most "
        "sustainable path. Proper recycling recovers metals and components "
        "for reuse and keeps hazardous materials out of landfills."
    ),
    "Dispose": (
        "This device shows damage severe enough that safe, certified "
        "e-waste recycling is recommended rather than continued use — "
        "this prevents hazardous materials from entering general waste "
        "while still recovering recyclable material."
    ),
}


# ---------------------------------------------------------------------------
# Repairability heuristic
# ---------------------------------------------------------------------------
# Simple bands used to label a "Repairability" string in the response.
# Severe damage types cap repairability regardless of score.

REPAIRABILITY_BANDS = [
    (70, "High"),
    (40, "Moderate"),
    (15, "Low"),
    (0, "Not Repairable"),
]


# ---------------------------------------------------------------------------
# Expected device lifespan (years) — mirrors app.py's expected_life map
# ---------------------------------------------------------------------------

EXPECTED_LIFESPAN_YEARS = {
    "Smartphone": 6,
    "Tablet": 7,
    "Laptop": 8,
}


# ---------------------------------------------------------------------------
# Sell / Donate / Recycle platform directories
# ---------------------------------------------------------------------------
# Reusable dictionaries, not hardcoded inline HTML. Each entry renders as
# a card client-side: logo placeholder, name, short description, link
# (opened in a new tab).

SELL_PLATFORMS = [
    {
        "name": "Cashify",
        "description": "Instant resale quotes and doorstep pickup for phones, laptops, and tablets.",
        "url": "https://www.cashify.in/",
        "logo": "cashify",
    },
    {
        "name": "OLX",
        "description": "Peer-to-peer marketplace for selling used electronics locally.",
        "url": "https://www.olx.in/",
        "logo": "olx",
    },
    {
        "name": "eBay",
        "description": "Global marketplace for selling devices to a wider buyer base.",
        "url": "https://www.ebay.com/",
        "logo": "ebay",
    },
    {
        "name": "Facebook Marketplace",
        "description": "Sell directly to local buyers through Facebook's marketplace.",
        "url": "https://www.facebook.com/marketplace/",
        "logo": "facebook_marketplace",
    },
]

DONATE_PLATFORMS = [
    {
        "name": "Goonj",
        "description": "NGO accepting working electronics to support underserved communities.",
        "url": "https://goonj.org/",
        "logo": "goonj",
    },
    {
        "name": "Local NGOs",
        "description": "Many regional NGOs accept functional devices for redistribution.",
        "url": "https://www.guidestar.org/",
        "logo": "ngo",
    },
    {
        "name": "Schools",
        "description": "Local schools often welcome working devices for student use.",
        "url": "https://www.givingschools.org/",
        "logo": "school",
    },
    {
        "name": "Community Centers",
        "description": "Community centers can redistribute working devices to those in need.",
        "url": "https://www.unitedway.org/",
        "logo": "community",
    },
]

RECYCLE_PLATFORMS = [
    {
        "name": "Attero",
        "description": "Authorized e-waste recycler specializing in electronics material recovery.",
        "url": "https://attero.in/",
        "logo": "attero",
    },
    {
        "name": "EcoReco",
        "description": "Certified e-waste collection and recycling service.",
        "url": "https://ecoreco.com/",
        "logo": "ecoreco",
    },
    {
        "name": "Croma E-Waste",
        "description": "Retail e-waste drop-off and recycling program.",
        "url": "https://www.croma.com/e-waste-disposal/",
        "logo": "croma",
    },
    {
        "name": "Authorized Local Recycler",
        "description": "Search for a certified e-waste recycler near you.",
        "url": "https://www.epa.gov/recycle/electronics-donation-and-recycling",
        "logo": "recycler",
    },
]

# Maps a recommendation outcome to the platform list to surface.
# "Reuse" has no disposal action — handled separately in the engine.
RECOMMENDATION_TO_PLATFORM_GROUP = {
    "Repair": "sell",       # post-repair, still likely sellable; surfaced as a next step
    "Refurbish": "sell",
    "Recycle": "recycle",
    "Dispose": "recycle",
}


# ---------------------------------------------------------------------------
# Gemini prompt contract
# ---------------------------------------------------------------------------
# Single source of truth for the system instruction sent to Gemini Vision.
# Kept here (not in photo_analysis.py) so it can be tuned without touching
# request-handling logic. Gemini ONLY detects — it must never be asked to
# calculate scores, recommendations, or environmental insights; that is
# Python's job (see photo_analysis_engine.py).

GEMINI_PHOTO_ANALYSIS_SYSTEM_PROMPT = """You are a visual device-condition detector. You analyze a single photo of an electronic device and report ONLY what is visually observable. You do not calculate scores, grades, or recommendations — another system handles that.

Supported device types: Smartphone, Laptop, Tablet.

If the photo does not clearly show one of these three device types, set "device_type" to "Unsupported" and "condition" to "Unknown", leave other fields as best-effort or "Unknown", and explain why in "summary".

Allowed values for "condition": Excellent, Good, Fair, Poor, Critical.
Allowed values for each *_condition / *_damage field: Excellent, Good, Fair, Poor, Critical, N/A, Unknown.
  - Use "N/A" when the component does not exist on this device type (e.g. keyboard_condition for a Smartphone).
  - Use "Unknown" when the component exists but is not visible in the photo.

Allowed values inside "damages" (choose only from this exact list, can be multiple, or ["No Visible Damage"] if none found):
Screen Crack, Broken Display, Scratches, Dent, Bent Frame, Broken Hinge, Missing Keys, Broken Keys, Damaged Camera, Camera Crack, Charging Port Damage, USB Damage, Water Damage, Heavy Wear, No Visible Damage, Multiple Damages.

Respond with STRICT JSON only — no markdown fences, no prose, no explanation outside the JSON object. Use exactly this schema:

{
  "device_type": "Smartphone | Laptop | Tablet | Unsupported",
  "condition": "Excellent | Good | Fair | Poor | Critical | Unknown",
  "confidence": 0-100 integer,
  "screen_damage": "Excellent | Good | Fair | Poor | Critical | Unknown",
  "body_damage": "Excellent | Good | Fair | Poor | Critical | Unknown",
  "camera_condition": "Excellent | Good | Fair | Poor | Critical | N/A | Unknown",
  "keyboard_condition": "Excellent | Good | Fair | Poor | Critical | N/A | Unknown",
  "hinge_condition": "Excellent | Good | Fair | Poor | Critical | N/A | Unknown",
  "ports": "Excellent | Good | Fair | Poor | Critical | N/A | Unknown",
  "battery_visible": "Good | Swollen | Leaking | Unknown | N/A",
  "damages": ["..."],
  "summary": "One or two plain-English sentences describing what is visible."
}

Return ONLY the JSON object."""

# Gemini model id — kept here so it can be bumped in one place.
GEMINI_VISION_MODEL = "gemini-2.5-flash"
