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
        raise ValueError("Rewrite Agent response did not contain valid JSON.")

    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise ValueError("Failed to parse JSON from Rewrite Agent response.") from exc


# ============================================================
# Output validation helper
# ============================================================

def validate_rewrite_result(result: dict[str, Any]) -> dict[str, Any]:
    suggestions = result.get("rewrite_suggestions")

    if not isinstance(suggestions, list):
        result["rewrite_suggestions"] = []
        return result

    clean_suggestions = []

    for item in suggestions[:3]:
        if not isinstance(item, dict):
            continue

        used_signals = item.get("used_signals", [])
        if not isinstance(used_signals, list):
            used_signals = []

        clean_suggestions.append(
            {
                "suggestion": item.get("suggestion", ""),
                "why_it_is_better": item.get("why_it_is_better", ""),
                "used_signals": used_signals,
                "caution": item.get("caution", ""),
            }
        )

    result["rewrite_suggestions"] = clean_suggestions
    return result


# ============================================================
# Context extraction helpers
# ============================================================

def extract_missing_keywords(rule_based_signals: dict[str, Any]) -> list[str]:
    keyword_result = rule_based_signals.get("keyword_result", {})
    missing_keywords = keyword_result.get("missing_keywords", [])

    if not isinstance(missing_keywords, list):
        return []

    return missing_keywords


def extract_relevant_grammar_flags(
    selected_bullet: str,
    rule_based_signals: dict[str, Any],
) -> list[dict[str, Any]]:
    grammar_flags = rule_based_signals.get("grammar_flags", [])

    if not isinstance(grammar_flags, list):
        return []

    exact_matches = []

    for flag in grammar_flags:
        if flag.get("text") == selected_bullet:
            exact_matches.append(flag)

    if exact_matches:
        return exact_matches

    return []


def extract_relevant_weak_phrase_flags(
    selected_bullet: str,
    rule_based_signals: dict[str, Any],
) -> list[dict[str, Any]]:
    weak_phrase_flags = rule_based_signals.get("weak_phrase_flags", [])

    if not isinstance(weak_phrase_flags, list):
        return []

    exact_matches = []

    for flag in weak_phrase_flags:
        if flag.get("text") == selected_bullet:
            exact_matches.append(flag)

    if exact_matches:
        return exact_matches

    return []


def extract_relevant_measurable_evidence(
    rule_based_signals: dict[str, Any],
) -> dict[str, Any]:
    measurable_evidence = rule_based_signals.get("measurable_evidence", {})

    if not isinstance(measurable_evidence, dict):
        return {}

    return measurable_evidence


def extract_evaluation_reasoning(
    evaluation_agent_result: dict[str, Any],
) -> dict[str, Any]:
    return {
        "competitiveness_category": evaluation_agent_result.get(
            "competitiveness_category", ""
        ),
        "reasoning": evaluation_agent_result.get("reasoning", ""),
        "weak_sections": evaluation_agent_result.get("weak_sections", []),
        "weak_bullets": evaluation_agent_result.get("weak_bullets", []),
        "improvement_priorities": evaluation_agent_result.get(
            "improvement_priorities", []
        ),
    }


# ============================================================
# Prompt builder
# ============================================================

def build_rewrite_messages(
    target_role: str,
    target_level: str,
    selected_bullet: str,
    rule_based_signals: dict[str, Any],
    evaluation_agent_result: dict[str, Any],
    user_instruction: str | None = None,
) -> list[dict[str, str]]:
    missing_keywords = extract_missing_keywords(rule_based_signals)

    relevant_grammar_flags = extract_relevant_grammar_flags(
        selected_bullet=selected_bullet,
        rule_based_signals=rule_based_signals,
    )

    relevant_weak_phrase_flags = extract_relevant_weak_phrase_flags(
        selected_bullet=selected_bullet,
        rule_based_signals=rule_based_signals,
    )

    measurable_evidence = extract_relevant_measurable_evidence(
        rule_based_signals=rule_based_signals,
    )

    evaluation_reasoning = extract_evaluation_reasoning(
        evaluation_agent_result=evaluation_agent_result,
    )

    system_prompt = """
You are a practical resume Rewrite Agent for a resume improvement MVP.

Your job:
Rewrite ONE selected resume bullet to make it stronger for the target role and target level.

You must use:
1. the selected bullet
2. rule-based ATS scoring signals
3. Evaluation Agent reasoning

Important rules:
- Return ONLY valid JSON.
- Do not include markdown.
- Do not include explanations outside JSON.
- Preserve the original meaning.
- Do not invent fake numbers.
- Do not invent fake tools.
- Do not invent fake achievements.
- Do not invent fake impact.
- Do not add measurable impact unless the original bullet already gives enough evidence.
- Do not force missing keywords if they do not naturally fit.
- Fix grammar and spelling if needed.
- Remove weak or passive phrases when possible.
- Use stronger action verbs.
- Make the bullet concise and resume-friendly.
- Return 1 to 3 rewrite suggestions.

Good rewrite behavior:
- If the bullet says "Responsible for organizing student communication",
  rewrite it as "Coordinated student communication..."
- If the bullet already has numbers, preserve and strengthen them.
- If the bullet has no numbers, you may suggest where the user should add real metrics,
  but do not create fake metrics.

Bad rewrite behavior:
- Do not change a leadership bullet into a data analyst project unless the original meaning supports it.
- Do not add Python, SQL, dashboards, users, accuracy, or percentages unless supported by the original bullet.
""".strip()

    user_payload = {
        "target_role": target_role,
        "target_level": target_level,
        "selected_bullet": selected_bullet,
        "user_instruction": user_instruction or "",
        "rule_based_context": {
            "ats_score": rule_based_signals.get("ats_score"),
            "missing_keywords": missing_keywords,
            "relevant_grammar_flags": relevant_grammar_flags,
            "relevant_weak_phrase_flags": relevant_weak_phrase_flags,
            "measurable_evidence_summary": measurable_evidence,
        },
        "evaluation_agent_context": evaluation_reasoning,
        "required_output_schema": {
            "rewrite_suggestions": [
                {
                    "suggestion": "Improved bullet text.",
                    "why_it_is_better": (
                        "Explain briefly how this improves clarity, ATS alignment, "
                        "grammar, action verb, keyword fit, or measurable evidence."
                    ),
                    "used_signals": [
                        "Mention which signals were used, such as missing keyword, weak phrase, grammar issue, or evaluation priority."
                    ],
                    "caution": (
                        "Mention if the user should manually add real metrics, tools, "
                        "or details instead of inventing them."
                    ),
                }
            ]
        },
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
    rule_based_signals: dict[str, Any],
    evaluation_agent_result: dict[str, Any],
    user_instruction: str | None = None,
) -> dict[str, Any]:
    """
    Rewrite Agent using Azure OpenAI API key.

    This version does NOT use:
    - FoundryChatClient
    - AzureCliCredential
    - FOUNDRY_PROJECT_ENDPOINT
    """
    client = get_openai_client()
    deployment_name = get_deployment_name()

    messages = build_rewrite_messages(
        target_role=target_role,
        target_level=target_level,
        selected_bullet=selected_bullet,
        rule_based_signals=rule_based_signals,
        evaluation_agent_result=evaluation_agent_result,
        user_instruction=user_instruction,
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