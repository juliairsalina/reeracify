from __future__ import annotations

import json
import os
from typing import Any

from dotenv import load_dotenv
from openai import AzureOpenAI


# ============================================================
# Load .env
# ============================================================

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))


# ============================================================
# Azure OpenAI client
# ============================================================

def get_azure_client() -> AzureOpenAI:
    """
    1) Azure client setup rule

    Reads Azure OpenAI values from app/.env.

    Required .env values:
        AZURE_OPENAI_ENDPOINT
        AZURE_OPENAI_API_KEY
        AZURE_OPENAI_API_VERSION
    """
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")

    if not endpoint:
        raise ValueError("Missing AZURE_OPENAI_ENDPOINT in app/.env")

    if not api_key:
        raise ValueError("Missing AZURE_OPENAI_API_KEY in app/.env")

    return AzureOpenAI(
        azure_endpoint=endpoint,
        api_key=api_key,
        api_version=api_version,
    )


def get_deployment_name() -> str:
    """
    2) Deployment name rule

    Azure OpenAI uses the deployment name as the model value.
    """
    deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")

    if not deployment_name:
        raise ValueError("Missing AZURE_OPENAI_DEPLOYMENT_NAME in app/.env")

    return deployment_name


# ============================================================
# JSON parsing helper
# ============================================================

def extract_json_from_text(text: str) -> dict[str, Any]:
    """
    3) JSON extraction rule

    The prompt asks the LLM to return only JSON.

    This helper also handles cases where the model accidentally adds
    text before or after the JSON object.
    """
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")

    if start == -1 or end == -1 or end <= start:
        raise ValueError("LLM response did not contain a valid JSON object.")

    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise ValueError("Failed to parse JSON from LLM response.") from exc


# ============================================================
# Output validation helper
# ============================================================

def validate_rewrite_result(result: dict[str, Any]) -> dict[str, Any]:
    """
    4) Rewrite output validation rule

    Ensures the LLM returns the field our frontend expects:

        rewrite_suggestions

    Each suggestion should contain:
        - suggestion
        - why_it_is_better
        - caution
    """
    suggestions = result.get("rewrite_suggestions")

    if not isinstance(suggestions, list):
        result["rewrite_suggestions"] = []
        return result

    clean_suggestions = []

    for item in suggestions[:3]:
        if not isinstance(item, dict):
            continue

        clean_suggestions.append(
            {
                "suggestion": item.get("suggestion", ""),
                "why_it_is_better": item.get("why_it_is_better", ""),
                "caution": item.get("caution", ""),
            }
        )

    result["rewrite_suggestions"] = clean_suggestions

    return result


# ============================================================
# Prompt builder
# ============================================================

def build_rewrite_prompt(
    target_role: str,
    target_level: str,
    selected_bullet: str,
    weakness_reason: str,
    missing_keywords: list[str] | None = None,
    grammar_flags: list[dict[str, Any]] | None = None,
) -> list[dict[str, str]]:
    """
    5) Prompt construction rule

    The Rewrite Agent receives:
        - target role
        - target level
        - selected bullet
        - weakness reason
        - missing keywords
        - grammar/spelling flags

    It returns 1 to 3 improved bullet suggestions.
    """
    system_prompt = """
You are a practical resume Rewrite Agent for a resume improvement MVP.

Your job:
Rewrite ONE selected resume bullet to make it stronger for the target role and target level.

Important rules:
- Return ONLY valid JSON.
- Do not include markdown.
- Do not include explanations outside JSON.
- Preserve the original meaning.
- Do not invent fake numbers.
- Do not invent fake tools.
- Do not invent fake achievements.
- Do not invent fake impact.
- Do not add measurable impact unless the original bullet already provides enough evidence.
- Do not rewrite unrelated sections.
- Fix grammar and spelling if needed.
- Improve ATS wording.
- Use stronger action verbs.
- Make the bullet concise and resume-friendly.
- If missing keywords are relevant, include them naturally.
- If missing keywords do not fit the original meaning, do not force them.
- Return 1 to 3 rewrite suggestions.

Good rewrite behavior:
- "Responsible for organizing student communication"
  can become:
  "Coordinated student communication..."

Bad rewrite behavior:
- Do not change a leadership bullet into a data analyst project unless the original meaning supports it.
- Do not add numbers such as 30%, 100 users, or 10 dashboards unless provided.
""".strip()

    user_payload = {
        "target_role": target_role,
        "target_level": target_level,
        "selected_bullet": selected_bullet,
        "weakness_reason": weakness_reason,
        "missing_keywords": missing_keywords or [],
        "grammar_flags": grammar_flags or [],
        "required_output_schema": {
            "rewrite_suggestions": [
                {
                    "suggestion": "Improved bullet text.",
                    "why_it_is_better": "Short reason why this is stronger.",
                    "caution": "Mention if the user should add real metrics/details manually."
                }
            ]
        }
    }

    user_prompt = f"""
Rewrite the selected bullet and return the result using the required JSON schema.

Input:
{json.dumps(user_payload, ensure_ascii=False, indent=2)}
""".strip()

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


# ============================================================
# Main Rewrite Agent function
# ============================================================

def rewrite_bullet_with_agent(
    target_role: str,
    target_level: str,
    selected_bullet: str,
    weakness_reason: str,
    missing_keywords: list[str] | None = None,
    grammar_flags: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    6) Rewrite Agent rule

    This function is called by POST /rewrite.

    Flow:
        1) Load Azure OpenAI client
        2) Build strict rewrite prompt
        3) Ask LLM for JSON output
        4) Parse JSON
        5) Validate required fields
        6) Return clean rewrite suggestions to FastAPI
    """
    client = get_azure_client()
    deployment_name = get_deployment_name()

    messages = build_rewrite_prompt(
        target_role=target_role,
        target_level=target_level,
        selected_bullet=selected_bullet,
        weakness_reason=weakness_reason,
        missing_keywords=missing_keywords,
        grammar_flags=grammar_flags,
    )

    response = client.chat.completions.create(
        model=deployment_name,
        messages=messages,
        temperature=0.4,
    )

    content = response.choices[0].message.content

    if not content:
        raise ValueError("Rewrite Agent returned an empty response.")

    parsed_result = extract_json_from_text(content)
    validated_result = validate_rewrite_result(parsed_result)

    return validated_result