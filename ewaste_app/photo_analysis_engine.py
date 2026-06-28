"""
photo_analysis_engine.py
=========================
NEW FILE — does not modify any existing module.

Pure Python business logic for the AI Photo Analysis feature. This module
takes the structured JSON that Gemini Vision returns (visual detections
ONLY) and computes every decision that Gemini is not allowed to make:

    Health Score          -> compute_health_score()
    Condition tier         -> condition_from_health_score()
    Circular Economy Score -> compute_circular_economy_score()
    Remaining Life         -> estimate_remaining_life()
    Repairability          -> estimate_repairability()
    Recommendation         -> recommend_action()
    Environmental Insight  -> environmental_insight()
    Action cards           -> build_action_cards()

No Flask, no network calls, no Gemini SDK imports here — this module is
plain, synchronous, and unit-testable in isolation. photo_analysis.py
orchestrates the call into Gemini and then hands the parsed JSON to the
functions below.
"""

from typing import Any, Dict, List, Optional

from photo_analysis_config import (
    COMPONENT_CONDITION_SCORES,
    CONDITION_TO_APP_CONDITION,
    DONATE_PLATFORMS,
    EXPECTED_LIFESPAN_YEARS,
    HEALTH_SCORE_CONDITION_THRESHOLDS,
    HEALTH_SCORE_WEIGHTS,
    RECOMMENDATION_ENVIRONMENTAL_INSIGHTS,
    RECOMMENDATION_THRESHOLDS,
    RECOMMENDATION_TO_PLATFORM_GROUP,
    RECYCLE_PLATFORMS,
    REPAIRABILITY_BANDS,
    SELL_PLATFORMS,
    SEVERE_DAMAGE_TYPES,
)


# ---------------------------------------------------------------------------
# Health Score
# ---------------------------------------------------------------------------

def _component_score(value: Optional[str]) -> Optional[float]:
    """Map a Gemini component-condition string to a 0-100 score.

    Returns None for components marked N/A / Unknown / unrecognized so the
    caller can exclude them and redistribute weight rather than punishing
    the device for a part Gemini couldn't assess.
    """
    if not value:
        return None
    return COMPONENT_CONDITION_SCORES.get(value.strip().title())


def compute_health_score(detection: Dict[str, Any]) -> float:
    """Compute the 0-100 Health Score from Gemini's per-component ratings.

    Weights (see photo_analysis_config.HEALTH_SCORE_WEIGHTS):
        Screen 40%, Body 20%, Camera 10%, Ports 10%, Keyboard/Hinge 20%.

    Components that are N/A (e.g. keyboard on a Smartphone) or Unknown
    (not visible in the photo) are excluded, and their weight is
    redistributed proportionally across the components that *do* have a
    usable score — so a Smartphone is never penalized for lacking a
    keyboard.
    """
    device_type = (detection.get("device_type") or "").strip()

    # Keyboard/hinge weight applies to whichever field is relevant for
    # this device type. Tablets and smartphones have neither, so the
    # component is simply excluded (N/A) and its weight redistributes.
    keyboard_hinge_value = None
    if device_type == "Laptop":
        keyboard_hinge_value = (
            detection.get("keyboard_condition")
            if _component_score(detection.get("keyboard_condition")) is not None
            else detection.get("hinge_condition")
        )

    component_values = {
        "screen_damage": detection.get("screen_damage"),
        "body_damage": detection.get("body_damage"),
        "camera_condition": detection.get("camera_condition"),
        "ports": detection.get("ports"),
        "keyboard_hinge": keyboard_hinge_value,
    }

    usable_weight_total = 0.0
    weighted_sum = 0.0

    for field, raw_value in component_values.items():
        score = _component_score(raw_value)
        if score is None:
            continue  # excluded — N/A or Unknown, weight redistributes below
        weight = HEALTH_SCORE_WEIGHTS[field]
        weighted_sum += score * weight
        usable_weight_total += weight

    if usable_weight_total == 0:
        # Nothing was assessable at all (e.g. extremely poor photo).
        # Fall back to a neutral mid-low score rather than crashing.
        return 50.0

    # Redistribute: dividing by usable_weight_total rescales the weighted
    # sum as if the usable weights summed to 1.0, so excluding an N/A
    # component (e.g. keyboard on a Smartphone) doesn't drag the score
    # down just because that slice of weight had nothing to apply to.
    health_score = weighted_sum / usable_weight_total
    return round(max(0.0, min(100.0, health_score)), 1)


def condition_from_health_score(health_score: float) -> str:
    """Map a numeric Health Score to a condition tier label."""
    for threshold, label in HEALTH_SCORE_CONDITION_THRESHOLDS:
        if health_score >= threshold:
            return label
    return "Critical"


def map_condition_to_app_condition(gemini_condition: str) -> str:
    """Translate Gemini's 5-tier condition vocabulary into the condition
    vocabulary already used by app.py's /predict endpoint (Excellent, Good,
    Average, Poor, Damaged), so the result can be forwarded automatically
    without asking the user to re-select it.
    """
    return CONDITION_TO_APP_CONDITION.get(gemini_condition, "Average")


# ---------------------------------------------------------------------------
# Remaining life
# ---------------------------------------------------------------------------

def estimate_remaining_life(device_type: str, health_score: float) -> float:
    """Estimate remaining usable life in years.

    Uses the same expected-lifespan-per-device-type baseline as app.py's
    /predict route, scaled by the photo-derived health score (in lieu of
    a known purchase age, which a photo alone cannot reveal).
    """
    expected_life = EXPECTED_LIFESPAN_YEARS.get(device_type, 6)
    remaining = expected_life * (health_score / 100.0)
    return round(max(0.0, remaining), 1)


# ---------------------------------------------------------------------------
# Repairability
# ---------------------------------------------------------------------------

def estimate_repairability(health_score: float, damages: List[str]) -> str:
    """Label repairability based on health score, capped by severe damage."""
    band = "Not Repairable"
    for threshold, label in REPAIRABILITY_BANDS:
        if health_score >= threshold:
            band = label
            break

    severe_hits = [d for d in damages if d in SEVERE_DAMAGE_TYPES]
    if severe_hits:
        # Severe damage caps repairability regardless of the numeric score —
        # e.g. water damage is rarely "High" repairability even if other
        # components score well.
        cap_order = ["High", "Moderate", "Low", "Not Repairable"]
        if cap_order.index(band) < cap_order.index("Low"):
            band = "Low"

    return band


# ---------------------------------------------------------------------------
# Circular Economy Score
# ---------------------------------------------------------------------------

def compute_circular_economy_score(
    health_score: float, remaining_life: float, device_type: str
) -> float:
    """Score reflecting how well this device fits a reuse/circular-economy
    path: weighted blend of current health and remaining usable life
    relative to the device type's full expected lifespan.
    """
    expected_life = EXPECTED_LIFESPAN_YEARS.get(device_type, 6)
    life_retention_pct = min((remaining_life / expected_life) * 100, 100) if expected_life else 0

    circular_score = (0.7 * health_score) + (0.3 * life_retention_pct)
    return round(max(0.0, min(100.0, circular_score)), 1)


# ---------------------------------------------------------------------------
# Recommendation engine (Reuse / Repair / Refurbish / Recycle / Dispose)
# ---------------------------------------------------------------------------

def recommend_action(health_score: float, damages: List[str], condition: str) -> str:
    """Decide the recommended next action. Python-only decision — Gemini
    never sees or influences this logic.

    Primary signal: numeric health score against RECOMMENDATION_THRESHOLDS.
    Override: presence of SEVERE_DAMAGE_TYPES can downgrade an otherwise
    favorable score (e.g. water damage should not casually be "Reuse").
    """
    recommendation = "Dispose"
    for threshold, label in RECOMMENDATION_THRESHOLDS:
        if health_score >= threshold:
            recommendation = label
            break

    severe_hits = [d for d in damages if d in SEVERE_DAMAGE_TYPES]
    if severe_hits and recommendation in ("Reuse", "Repair"):
        # Severe structural/water damage downgrades an optimistic score-based
        # call to at least "Refurbish", since the device likely needs
        # professional intervention before further use.
        recommendation = "Refurbish"

    if condition == "Critical" and recommendation != "Dispose":
        recommendation = "Recycle"

    return recommendation


def environmental_insight(recommendation: str) -> str:
    """Short sustainability insight tied to the chosen recommendation."""
    return RECOMMENDATION_ENVIRONMENTAL_INSIGHTS.get(
        recommendation,
        "Extending a device's usable life, in any form, reduces electronic "
        "waste and the environmental cost of manufacturing a replacement.",
    )


# ---------------------------------------------------------------------------
# Sell / Donate / Recycle action cards
# ---------------------------------------------------------------------------

def build_action_cards(recommendation: str) -> Dict[str, Any]:
    """Return the platform group + card list to display for a given
    recommendation outcome.

    "Reuse" devices have no disposal action — front-end should simply show
    a positive "no action needed" message instead of cards (group is None).
    """
    if recommendation == "Reuse":
        return {"group": None, "platforms": []}

    group = RECOMMENDATION_TO_PLATFORM_GROUP.get(recommendation, "recycle")

    platform_map = {
        "sell": SELL_PLATFORMS,
        "donate": DONATE_PLATFORMS,
        "recycle": RECYCLE_PLATFORMS,
    }

    return {"group": group, "platforms": platform_map.get(group, RECYCLE_PLATFORMS)}


# ---------------------------------------------------------------------------
# Top-level orchestration helper
# ---------------------------------------------------------------------------

def analyze_detection(detection: Dict[str, Any]) -> Dict[str, Any]:
    """Run the full Python analysis pipeline on a Gemini detection JSON.

    This is the single function photo_analysis.py should call after
    receiving and validating Gemini's response. Returns the complete,
    ready-to-render result payload (everything the result page and
    EcoBot context need).
    """
    device_type = detection.get("device_type", "Unknown")
    damages = detection.get("damages") or []
    gemini_condition = detection.get("condition", "Unknown")

    health_score = compute_health_score(detection)
    condition_tier = condition_from_health_score(health_score)
    remaining_life = estimate_remaining_life(device_type, health_score)
    repairability = estimate_repairability(health_score, damages)
    circular_score = compute_circular_economy_score(health_score, remaining_life, device_type)
    recommendation = recommend_action(health_score, damages, condition_tier)
    insight = environmental_insight(recommendation)
    action_cards = build_action_cards(recommendation)
    app_condition = map_condition_to_app_condition(gemini_condition)

    return {
        "device_type": device_type,
        "confidence": detection.get("confidence", 0),
        "gemini_condition": gemini_condition,
        "condition": condition_tier,
        "app_condition": app_condition,  # ready to forward to /predict as "condition"
        "health_score": health_score,
        "remaining_life": remaining_life,
        "repairability": repairability,
        "circular_score": circular_score,
        "recommendation": recommendation,
        "environmental_insight": insight,
        "damages": damages,
        "summary": detection.get("summary", ""),
        "components": {
            "screen_damage": detection.get("screen_damage", "Unknown"),
            "body_damage": detection.get("body_damage", "Unknown"),
            "camera_condition": detection.get("camera_condition", "Unknown"),
            "keyboard_condition": detection.get("keyboard_condition", "N/A"),
            "hinge_condition": detection.get("hinge_condition", "N/A"),
            "ports": detection.get("ports", "Unknown"),
            "battery_visible": detection.get("battery_visible", "Unknown"),
        },
        "action_cards": action_cards,
    }
