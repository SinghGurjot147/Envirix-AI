# E-Waste Device Analyzer

AI-powered device valuation platform. Flask backend + Random Forest price model,
connected to the "Analyze Device" form on the frontend.

## Project structure

```
ewaste_app/
├── app.py                  # Flask app + /predict route
├── requirements.txt
├── models/
│   ├── price_model.pkl     # RandomForestRegressor
│   ├── le_brand.pkl        # LabelEncoder for brand
│   ├── le_os.pkl           # LabelEncoder for os
│   └── le_device.pkl       # LabelEncoder for device_type
├── templates/
│   └── index.html          # Full site (Jinja template)
└── static/
    ├── css/                # All stylesheets
    └── js/
        └── main.js         # All interactivity, incl. /predict fetch call
```

## Running it

```bash
pip install -r requirements.txt
python app.py
```

Then open http://127.0.0.1:5000/

## How prediction works

The `price_model.pkl` (Random Forest) was trained on six hardware-spec
features only:

```
brand, os, ram, storage, screen_size, device_type
```

It has no concept of device age or condition. To answer "what is this
device worth **today**", `app.py` does two things:

1. **Model inference** — encodes `brand` / `os` / `device_type` with the
   matching `LabelEncoder`s, builds a one-row DataFrame with the exact
   column order the model was trained on, and calls `model.predict()`.
   This produces the **predicted market value** — the model's honest,
   unmodified output for a device in that spec configuration.

2. **Depreciation adjustment** (plain Python, not ML) — applies a
   condition multiplier (`Excellent` / `Good` / `Fair` / `Poor`) and an
   annual retention rate based on `purchase_year`, compounded by age.
   This produces the **current resale value** and **% value retained**.

This split is intentional and shown in the UI: the "Predicted market
value" card is purely model output, while "Current resale value" and
"Value retained" are explicitly labeled as the age/condition-adjusted
figures. Tune `CONDITION_MULTIPLIER` and `ANNUAL_RETENTION_RATE` in
`app.py` to match real resale data if you have it.

## API

### `POST /predict`

Request body (JSON or form-encoded):

```json
{
  "device_type": "Smartphone",
  "brand": "Apple",
  "os": "iOS",
  "ram": "6",
  "storage": "128",
  "screen_size": "6.1",
  "condition": "Good",
  "purchase_year": "2023"
}
```

`brand`, `os`, and `device_type` must exactly match one of the classes
the encoders were trained on (see dropdown options in `index.html` —
they were generated directly from `le_*.classes_` to guarantee a match,
including a couple of oddly-whitespaced OS labels like
`"Mac 10.15.3\t OS"`).

Success response (200):

```json
{
  "market_value": 48409.71,
  "resale_value": 19217.93,
  "retained_pct": 39.7,
  "grade": "B",
  "age_years": 3,
  "inputs": { "...": "echoed back input values" }
}
```

Error response (400): `{ "error": "..." }` — for missing fields, bad
numeric input, or a brand/os/device_type value the encoders don't
recognize.

## Notes

- Everything outside the Analyze Device form (hero, features, photo
  upload, forecasting, dashboard widgets, footer) is unchanged from the
  previous version.
- The results section is now populated live from the API response
  instead of showing the static sample — the sample copy only appears
  before the first successful analysis.
