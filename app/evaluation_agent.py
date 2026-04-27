from __future__ import annotations

import json
from typing import Any

from openai import OpenAI

from app.config import settings


# ============================================================
# OpenAI client setup
# ============================================================

def get_openai_client() -> OpenAI:
    if not settings.AZURE_OPENAI_ENDPOINT:
        raise ValueError("Missing AZURE_OPENAI_ENDPOINT in app/.env")

    if not settings.AZURE_OPENAI_API_KEY:
        raise ValueError("Missing AZURE_OPENAI_API_KEY in app/.env")

    return OpenAI(
        base_url=settings.AZURE_OPENAI_ENDPOINT,
        api_key=settings.AZURE_OPENAI_API_KEY,
    )


def get_deployment_name() -> str:
    if not settings.AZURE_OPENAI_DEPLOYMENT_NAME:
        raise ValueError("Missing AZURE_OPENAI_DEPLOYMENT_NAME in app/.env")

    return settings.AZURE_OPENAI_DEPLOYMENT_NAME


# ============================================================
# JSON parsing helper
# ============================================================

def extract_json_from_text(text: str) -> dict[str, Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")

    if start == -1 or end == -1 or end <= start:
        raise ValueError("Evaluation Agent response did not contain valid JSON.")

    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise ValueError("Failed to parse JSON from Evaluation Agent response.") from exc


# ============================================================
# Output validation helper
# ============================================================

def validate_evaluation_result(result: dict[str, Any]) -> dict[str, Any]:
    allowed_categories = {"하", "중", "상"}

    if result.get("competitiveness_category") not in allowed_categories:
        result["competitiveness_category"] = "중"

    if not isinstance(result.get("reasoning"), str):
        result["reasoning"] = ""

    if not isinstance(result.get("what_top_resumes_usually_have"), list):
        result["what_top_resumes_usually_have"] = []

    if not isinstance(result.get("weak_sections"), list):
        result["weak_sections"] = []

    if not isinstance(result.get("weak_bullets"), list):
        result["weak_bullets"] = []

    if not isinstance(result.get("improvement_priorities"), list):
        result["improvement_priorities"] = []

    return result


# ============================================================
# Prompt builder
# ============================================================

def build_evaluation_messages(
    resume: dict[str, Any],
    target_role: str,
    target_level: str,
    rule_based_signals: dict[str, Any],
) -> list[dict[str, str]]:
    system_prompt = """
You are a practical resume Evaluation Agent for a resume improvement MVP.

Your job:
Evaluate how competitive the resume is for the given target role and target level.

You must use:
1. target role
2. target level
3. structured resume JSON
4. rule-based ATS scoring signals

Important rules:
- Return ONLY valid JSON.
- Do not include markdown.
- Do not include explanations outside JSON.
- Do not invent resume experience.
- Do not rewrite bullets.
- Be strict but practical.
- Use Korean category labels only for competitiveness_category.

The competitiveness_category must be exactly one of:
- "하"
- "중"
- "상"

Category meaning:
- "하": weak fit, many missing basics, not yet competitive
- "중": acceptable MVP-level resume, but needs stronger evidence, keywords, or impact
- "상": strong resume, role-aligned, good evidence, clear impact

When judging, consider:
- ATS score
- section presence
- missing keywords
- measurable evidence
- weak phrases
- grammar/spelling flags
- project strength
- experience bullet strength
- target level expectations

Weak bullets must use bullet IDs when available, such as:
- exp_1_b2
- proj_1_b1
""".strip()

    user_payload = {
        "target_role": target_role,
        "target_level": target_level,
        "resume": resume,
        "rule_based_signals": rule_based_signals,
        "required_output_schema": {
            "competitiveness_category": "하 | 중 | 상",
            "reasoning": "Short practical explanation of the competitiveness decision.",
            "what_top_resumes_usually_have": [
                "Specific traits stronger resumes for this role/level usually have."
            ],
            "weak_sections": [
                {
                    "section": "experience | projects | skills | education",
                    "reason": "Why this section is weak or incomplete."
                }
            ],
            "weak_bullets": [
                {
                    "id": "exp_1_b1",
                    "text": "Original bullet text.",
                    "reason": "Why this bullet is weak."
                }
            ],
            "improvement_priorities": [
                "Highest priority action first.",
                "Second priority action.",
                "Third priority action."
            ]
        },
    }

    user_prompt = f"""
Evaluate this resume and return the result using the required JSON schema.

Input:
{json.dumps(user_payload, ensure_ascii=False, indent=2)}
""".strip()

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


# ============================================================
# Main Evaluation Agent function
# ============================================================

def evaluate_resume_with_agent(
    resume: dict[str, Any],
    target_role: str,
    target_level: str,
    rule_based_signals: dict[str, Any],
) -> dict[str, Any]:
    """
    Evaluation Agent using Azure OpenAI API key.

    This version does NOT use:
    - FoundryChatClient
    - AzureCliCredential
    - FOUNDRY_PROJECT_ENDPOINT
    """
    client = get_openai_client()
    deployment_name = get_deployment_name()

    messages = build_evaluation_messages(
        resume=resume,
        target_role=target_role,
        target_level=target_level,
        rule_based_signals=rule_based_signals,
    )

    response = client.chat.completions.create(
        model=deployment_name,
        messages=messages,
        temperature=0.2,
    )

    content = response.choices[0].message.content

    if not content:
        raise ValueError("Evaluation Agent returned an empty response.")

    parsed_result = extract_json_from_text(content)
    validated_result = validate_evaluation_result(parsed_result)

    return validated_result