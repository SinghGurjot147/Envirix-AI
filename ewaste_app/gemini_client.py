"""
============================================================
ECOBOT CHATBOT MODULE — GEMINI INTEGRATION (PLACEHOLDER)
============================================================
This module is the ONLY place that should ever talk to the
Gemini API. Isolating it here means:
  - The API key never reaches the frontend (browser never sees it)
  - Swapping providers or finalizing the real Gemini call only
    requires editing this one file
  - chatbot_routes.py stays clean and provider-agnostic

This is intentionally a PLACEHOLDER. No live network call is
made here — wire up the real `google-generativeai` (or REST)
call where indicated below, once you have:
  1. A Gemini API key stored in an environment variable
     (e.g. GEMINI_API_KEY) — never hardcoded, never sent to
     the browser.
  2. The `google-generativeai` package installed, OR a direct
     HTTPS call to Gemini's REST endpoint.
============================================================
"""

import os
import time
import google.generativeai as genai

API_KEYS = [
    os.getenv("GEMINI_API_KEY_1"),
    os.getenv("GEMINI_API_KEY_2"),
    os.getenv("GEMINI_API_KEY_3"),
    os.getenv("GEMINI_API_KEY_4"),
    os.getenv("GEMINI_API_KEY_5"),
]

API_KEYS = [k for k in API_KEYS if k]

if not API_KEYS:
    raise ValueError("No Gemini API keys found.")

current_key_index = 0


def get_model():
    global current_key_index

    genai.configure(api_key=API_KEYS[current_key_index])

    return genai.GenerativeModel(
        model_name="gemini-2.5-flash"
    )


def _build_prompt(system_prompt: str, history: list, user_message: str) -> str:
    """
    Build a single prompt containing:
    - System Prompt
    - Conversation History
    - Current User Message
    """

    prompt = system_prompt + "\n\n"

    if history:
        prompt += "Conversation History:\n"

        for turn in history:
            if turn["role"] == "user":
                prompt += f"User: {turn['text']}\n"
            else:
                prompt += f"EcoBot: {turn['text']}\n"

    prompt += f"\nUser: {user_message}\n"
    prompt += "EcoBot:"

    return prompt


def generate_ecobot_response(system_prompt, history, user_message):

    global current_key_index

    prompt = _build_prompt(
        system_prompt,
        history,
        user_message
    )

    last_error = None

    for _ in range(len(API_KEYS)):

        model = get_model()

        try:

            response = model.generate_content(
                prompt,
                generation_config={
                    "temperature": 0.4,
                    "top_p": 0.9,
                    "max_output_tokens": 500,
                }
            )

            if response.text:
                return response.text.strip()

            return "I'm sorry, I couldn't generate a response."

        except Exception as e:

            last_error = e
            error = str(e).lower()

            # If quota/rate limit is reached, switch to the next key
            if (
                "429" in error
                or "quota" in error
                or "rate" in error
                or "resource_exhausted" in error
            ):

                current_key_index = (current_key_index + 1) % len(API_KEYS)
                print(f"[Gemini] Switched to API Key {current_key_index + 1}")

                continue

            # For any other error, stop immediately
            return f"Error contacting Gemini API: {str(e)}"

    return f"All Gemini API keys exhausted.\n{last_error}"