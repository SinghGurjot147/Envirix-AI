from flask import Flask, render_template, request, jsonify
import pandas as pd
import joblib
import os
from datetime import datetime

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Load model + encoders once at startup
# ---------------------------------------------------------------------------
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")

model = joblib.load(os.path.join(MODEL_DIR, "price_model.pkl"))
le_brand = joblib.load(os.path.join(MODEL_DIR, "le_brand.pkl"))
le_os = joblib.load(os.path.join(MODEL_DIR, "le_os.pkl"))
le_device = joblib.load(os.path.join(MODEL_DIR, "le_device.pkl"))

# ---------------------------------------------------------------------------
# Depreciation adjustment
# ---------------------------------------------------------------------------
# The price_model only predicts a baseline market value from hardware specs
# (brand, os, ram, storage, screen_size, device_type). It has no concept of
# age or condition. To produce a *current resale* estimate, we apply a
# transparent depreciation adjustment on top of the model's output, using:
#   - device age (derived from purchase_year)
#   - condition tier
# This keeps the ML model's output honest (it is exactly what it predicts)
# while still answering the "what is it worth today" question the UI needs.

CONDITION_MULTIPLIER = {
    "Excellent": 1.00,
    "Good": 0.85,
    "Average": 0.70,
    "Poor": 0.50,
    "Damaged": 0.20
}


def compute_resale_value(market_value, condition, age_years):

    condition_mult = CONDITION_MULTIPLIER.get(condition, 0.20)

    age_factor = max(0.40, 1 - (age_years * 0.08))

    resale_value = (
        market_value
        * age_factor
        * condition_mult
    )

    retained_pct = (
        age_factor
        * condition_mult
        * 100
    )

    return round(resale_value, 2), round(retained_pct, 1)


def grade_from_retention(retained_pct: float) -> str:
    if retained_pct >= 80:
        return "A+"
    if retained_pct >= 65:
        return "A"
    if retained_pct >= 50:
        return "B+"
    if retained_pct >= 35:
        return "B"
    if retained_pct >= 20:
        return "C"
    return "D"


def safe_label_transform(encoder, value, field_name):
    """Transform a label, raising a clear error if it's not a known class."""
    try:
        return int(encoder.transform([value])[0])
    except ValueError:
        known = ", ".join(map(str, encoder.classes_))
        raise ValueError(
            f"Unrecognized {field_name} '{value}'. Expected one of: {known}"
        )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.route("/")
def home():
    return render_template("index.html")


@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(silent=True) or request.form

    required_fields = [
    "device_type",
    "brand",
    "os",
    "ram",
    "storage",
    "screen_size",
    "condition",
]
    missing = [f for f in required_fields if not data.get(f)]
    if missing:
        return jsonify({
            "error": f"Missing required field(s): {', '.join(missing)}"
        }), 400

    try:
        device_type = data["device_type"]
        brand = data["brand"]
        os_name = data["os"]
        condition = data["condition"]

        ram = float(data["ram"])
        storage = float(data["storage"])
        screen_size = float(data["screen_size"])

        age_mode = data.get("age_mode", "purchase_year")

        current_year = datetime.now().year

        if age_mode == "age":
            age_value = data.get("age")
            if not age_value:
                return jsonify({"error": "Device age is required"}), 400

            age_years = float(age_value)
            purchase_year = current_year - int(age_years)
        else:
            purchase_year = int(float(data["purchase_year"]))
            age_years = max(current_year - purchase_year, 0)

    except (TypeError, ValueError):
        return jsonify({"error": "Invalid numeric value supplied."}), 400

    

    try:
        brand_value = safe_label_transform(le_brand, brand, "brand")
        os_value = safe_label_transform(le_os, os_name, "os")
        device_value = safe_label_transform(le_device, device_type, "device_type")
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    sample = pd.DataFrame({
        "brand": [brand_value],
        "os": [os_value],
        "ram": [ram],
        "storage": [storage],
        "screen_size": [screen_size],
        "device_type": [device_value],
    })

    try:
        prediction = model.predict(sample)
        market_value = round(float(prediction[0]), 2)
    except Exception as e:
        return jsonify({"error": f"Prediction failed: {e}"}), 500

    resale_value, retained_pct = compute_resale_value(market_value, condition, age_years)
    grade = grade_from_retention(retained_pct)

    # ---------------------------
    # Health Score
    # ---------------------------

    condition_scores = {
        "Excellent": 100,
        "Good": 80,
        "Average": 60,
        "Poor": 40,
        "Damaged": 20
    }

    health_score = max(
        0,
        condition_scores.get(condition, 20) - (age_years * 5)
    )

    expected_life = {
        "Smartphone": 6,
        "Tablet": 7,
        "Laptop": 8
    }.get(device_type, 6)

    remaining_life = max(
        expected_life - age_years,
        0
    )

    value_retention_score = min(retained_pct, 100)

    circular_score = (
        0.7 * health_score +
        0.3 * value_retention_score
    )

    if health_score >= 80:
        recommendation = "Keep Using"
    elif health_score >= 50:
        recommendation = "Refurbish"
    else:
        recommendation = "Recycle"

    return jsonify({
        "market_value": market_value,
        "resale_value": resale_value,
        "retained_pct": retained_pct,
        "grade": grade,
        "age_years": age_years,

        "health_score": round(health_score, 1),
        "remaining_life": round(remaining_life, 1),
        "circular_score": round(circular_score, 1),
        "recommendation": recommendation,

        "inputs": {
            "device_type": device_type,
            "brand": brand,
            "os": os_name,
            "ram": ram,
            "storage": storage,
            "screen_size": screen_size,
            "condition": condition,
            "purchase_year": purchase_year,
        },
    })


if __name__ == "__main__":
    app.run(debug=True)
