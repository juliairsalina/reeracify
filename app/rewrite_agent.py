from __future__ import annotations

import asyncio
import json
from typing import Any

from agent_framework import Agent
from agent_framework.foundry import FoundryChatClient
from azure.identity.aio import AzureCliCredential

from app.config import settings


# ============================================================
# JSON parsing helper
# ============================================================

def extract_json_from_text(text: str) -> dict[str, Any]:
    """
    The agent is instructed to return only JSON.

    This helper is defensive:
    - first tries normal json.loads()
    - if that fails, extracts the first JSON object from the response
    """
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
    """
    Ensures the Rewrite Agent output matches the frontend schema.

    Required field:
        rewrite_suggestions

    Each suggestion:
        - suggestion
        - why_it_is_better
        - used_signals
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
# Settings helpers
# ============================================================

def get_foundry_project_endpoint() -> str:
    """
    Gets Foundry project endpoint from settings.

    Recommended:
        FOUNDRY_PROJECT_ENDPOINT

    Fallback:
        AZURE_AI_PROJECT_ENDPOINT
    """
    endpoint = getattr(settings, "FOUNDRY_PROJECT_ENDPOINT", None)

    if not endpoint:
        endpoint = getattr(settings, "AZURE_AI_PROJECT_ENDPOINT", None)

    if not endpoint:
        raise ValueError(
            "Missing Foundry project endpoint. "
            "Add FOUNDRY_PROJECT_ENDPOINT or AZURE_AI_PROJECT_ENDPOINT in app/.env."
        )

    return endpoint


def get_foundry_model() -> str:
    """
    Gets model/deployment name from settings.

    Recommended:
        FOUNDRY_MODEL

    Fallback:
        AZURE_OPENAI_DEPLOYMENT_NAME
    """
    model = getattr(settings, "FOUNDRY_MODEL", None)

    if not model:
        model = getattr(settings, "AZURE_OPENAI_DEPLOYMENT_NAME", None)

    if not model:
        raise ValueError(
            "Missing Foundry model name. "
            "Add FOUNDRY_MODEL or AZURE_OPENAI_DEPLOYMENT_NAME in app/.env."
        )

    return model


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
    """
    Returns grammar flags relevant to the selected bullet.

    If exact matching fails, returns all grammar flags.
    This is useful because frontend may not always send bullet IDs yet.
    """
    grammar_flags = rule_based_signals.get("grammar_flags", [])

    if not isinstance(grammar_flags, list):
        return []

    exact_matches = []

    for flag in grammar_flags:
        if flag.get("text") == selected_bullet:
            exact_matches.append(flag)

    if exact_matches:
        return exact_matches

    return grammar_flags


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

    return weak_phrase_flags


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
    """
    Keeps only the useful parts of Evaluation Agent output.

    This avoids sending unnecessary data to the Rewrite Agent.
    """
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

def build_rewrite_prompts(
    target_role: str,
    target_level: str,
    selected_bullet: str,
    rule_based_signals: dict[str, Any],
    evaluation_agent_result: dict[str, Any],
    user_instruction: str | None = None,
) -> tuple[str, str]:
    """
    Builds the system instruction and user prompt.

    Rewrite Agent receives:
    - target role
    - target level
    - selected bullet
    - rule-based scoring signals
    - Evaluation Agent reasoning
    """
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

    return system_prompt, user_prompt


# ============================================================
# Agent response helper
# ============================================================

def agent_response_to_text(response: Any) -> str:
    """
    Converts Agent Framework response into plain text.

    Different versions may return slightly different objects,
    so this helper keeps the code stable during debugging.
    """
    if response is None:
        return ""

    if isinstance(response, str):
        return response

    text = getattr(response, "text", None)
    if isinstance(text, str):
        return text

    content = getattr(response, "content", None)
    if isinstance(content, str):
        return content

    messages = getattr(response, "messages", None)
    if messages:
        last_message = messages[-1]
        last_text = getattr(last_message, "text", None)
        if isinstance(last_text, str):
            return last_text

    return str(response)


# ============================================================
# Async Rewrite Agent runner
# ============================================================

async def rewrite_bullet_with_agent_async(
    target_role: str,
    target_level: str,
    selected_bullet: str,
    rule_based_signals: dict[str, Any],
    evaluation_agent_result: dict[str, Any],
    user_instruction: str | None = None,
) -> dict[str, Any]:
    """
    Async Rewrite Agent pipeline using Microsoft Agent Framework.

    Flow:
    1. Build rewrite prompt
    2. Create Azure CLI credential
    3. Create FoundryChatClient
    4. Create Rewrite Agent
    5. Run agent
    6. Parse JSON
    7. Validate schema
    """
    system_prompt, user_prompt = build_rewrite_prompts(
        target_role=target_role,
        target_level=target_level,
        selected_bullet=selected_bullet,
        rule_based_signals=rule_based_signals,
        evaluation_agent_result=evaluation_agent_result,
        user_instruction=user_instruction,
    )

    credential = AzureCliCredential()

    try:
        client = FoundryChatClient(
            project_endpoint=get_foundry_project_endpoint(),
            model=get_foundry_model(),
            credential=credential,
        )

        agent = Agent(
            client=client,
            name="RewriteAgent",
            instructions=system_prompt,
        )

        response = await agent.run(user_prompt)
        content = agent_response_to_text(response)

        if not content:
            raise ValueError("Rewrite Agent returned an empty response.")

        parsed_result = extract_json_from_text(content)
        validated_result = validate_rewrite_result(parsed_result)

        return validated_result

    finally:
        await credential.close()


# ============================================================
# Sync wrapper used by FastAPI/main.py
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
    Sync wrapper so main.py can call this normally.

    main.py can do:

        rewrite_bullet_with_agent(
            target_role=...,
            target_level=...,
            selected_bullet=...,
            rule_based_signals=...,
            evaluation_agent_result=...,
        )
    """
    try:
        running_loop = asyncio.get_running_loop()
    except RuntimeError:
        running_loop = None

    if running_loop and running_loop.is_running():
        raise RuntimeError(
            "rewrite_bullet_with_agent() was called inside an active event loop. "
            "Use await rewrite_bullet_with_agent_async(...) instead."
        )

    return asyncio.run(
        rewrite_bullet_with_agent_async(
            target_role=target_role,
            target_level=target_level,
            selected_bullet=selected_bullet,
            rule_based_signals=rule_based_signals,
            evaluation_agent_result=evaluation_agent_result,
            user_instruction=user_instruction,
        )
    )