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

    The deployment name is used later when calling the model.
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

    Azure OpenAI uses the deployment name when calling chat completions.
    This should match the deployment name in Azure AI Foundry / Azure portal.
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

    But for safety, this function also handles cases where the model
    accidentally adds text before or after the JSON object.
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

def validate_evaluation_result(result: dict[str, Any]) -> dict[str, Any]:
    """
    4) Evaluation output validation rule

    Ensures the LLM returns the fields our frontend expects.

    Required fields:
        competitiveness_category
        reasoning
        what_top_resumes_usually_have
        weak_sections
        weak_bullets
        improvement_priorities

    Competitiveness must be one of:
        하, 중, 상
    """
    allowed_categories = {"하", "중", "상"}

    category = result.get("competitiveness_category")
    if category not in allowed_categories:
        result["competitiveness_category"] = "중"

    result.setdefault("reasoning", "")
    result.setdefault("what_top_resumes_usually_have", [])
    result.setdefault("weak_sections", [])
    result.setdefault("weak_bullets", [])
    result.setdefault("improvement_priorities", [])

    return result


# ============================================================
# Prompt builder
# ============================================================

def build_evaluation_prompt(
    resume: dict[str, Any],
    target_role: str,
    target_level: str,
    rule_based_signals: dict[str, Any],
) -> list[dict[str, str]]:
    """
    5) Prompt construction rule

    The Evaluation Agent receives:
        - target role
        - target level
        - structured resume JSON
        - rule-based scoring signals

    It must judge competitiveness, not rewrite the resume.
    """
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
- "중": acceptable MVP-level resume, but needs stronger evidence/keywords/impact
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
        }
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
    6) Evaluation Agent rule

    This function is called by /evaluate and /reevaluate.

    Flow:
        1) Load Azure OpenAI client
        2) Build strict evaluation prompt
        3) Ask LLM for JSON output
        4) Parse JSON
        5) Validate required fields
        6) Return clean dictionary to FastAPI
    """
    client = get_azure_client()
    deployment_name = get_deployment_name()

    messages = build_evaluation_prompt(
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