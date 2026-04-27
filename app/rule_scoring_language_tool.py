from __future__ import annotations

from typing import Any

import language_tool_python

from app.rule_scoring import (
    calculate_ats_score,
    check_section_presence,
    count_experience_bullets,
    count_project_bullets,
    count_projects,
    detect_measurable_evidence,
    detect_weak_phrases,
    get_all_bullets,
    get_rubric,
    match_keywords,
)


# ============================================================
# Local LanguageTool grammar checker
# ============================================================

def check_grammar_with_local_languagetool(
    resume: dict[str, Any],
    language: str = "en-US",
) -> list[dict[str, Any]]:
    """
    8) Grammar/spelling rule using local LanguageTool

    This version uses:
        language_tool_python

    Difference from the original rule_scoring.py:
        - No public LanguageTool API request
        - No paid API call
        - No per-IP public API limit
        - Requires Java installed locally

    Output is kept similar to the original:
        - bullet ID
        - original bullet text
        - issue count
        - simplified issue list
    """
    grammar_flags: list[dict[str, Any]] = []

    try:
        tool = language_tool_python.LanguageTool(language)
    except Exception as exc:
        return [
            {
                "id": "language_tool_setup_error",
                "text": "",
                "issue_count": 0,
                "issues": [],
                "warning": f"Failed to start local LanguageTool: {str(exc)}",
            }
        ]

    for bullet in get_all_bullets(resume):
        text = bullet["text"]

        try:
            matches = tool.check(text)
        except Exception as exc:
            grammar_flags.append(
                {
                    "id": bullet["id"],
                    "text": text,
                    "issue_count": 0,
                    "issues": [],
                    "warning": f"Local LanguageTool check failed: {str(exc)}",
                }
            )
            continue

        if matches:
            simplified_issues = []

            for match in matches[:3]:
                simplified_issues.append(
                    {
                        "message": match.message,
                        "short_message": getattr(match, "short_message", ""),
                        "rule_id": match.rule_id,
                        "category": match.category,
                        "suggestions": match.replacements[:3],
                    }
                )

            grammar_flags.append(
                {
                    "id": bullet["id"],
                    "text": text,
                    "issue_count": len(matches),
                    "issues": simplified_issues,
                }
            )

    tool.close()
    return grammar_flags


# ============================================================
# Main rule-based scoring pipeline using local LanguageTool
# ============================================================

def run_rule_based_scoring_with_local_languagetool(
    resume: dict[str, Any],
    target_role: str,
    target_level: str,
) -> dict[str, Any]:
    """
    Main rule-based scoring pipeline.

    Same structure as run_rule_based_scoring() from rule_scoring.py,
    but grammar checking uses local language_tool_python.

    Flow:
        1) Load rubric from CSV
        2) Check section presence
        3) Count experience bullets
        4) Count projects
        5) Count project bullets
        6) Match role keywords
        7) Detect measurable evidence
        8) Detect weak phrases
        9) Run local LanguageTool grammar/spelling check
        10) Calculate ATS score
    """
    rubric = get_rubric(target_role, target_level)

    # 1) Check whether important resume sections exist
    section_presence = check_section_presence(resume)

    # 2) Count experience bullets
    experience_bullet_count = count_experience_bullets(resume)

    # 3) Count projects
    project_count = count_projects(resume)

    # 4) Count project bullets
    project_bullet_count = count_project_bullets(resume)

    # 5) Check present/missing keywords based on selected role + level
    keyword_result = match_keywords(resume, rubric["expected_keywords"])

    # 6) Detect whether bullets contain numbers or measurable evidence
    measurable_result = detect_measurable_evidence(resume)

    # 7) Detect weak phrases from config/weak_phrases.csv
    weak_phrase_flags = detect_weak_phrases(resume)

    # 8) Run local LanguageTool grammar/spelling check
    grammar_flags = check_grammar_with_local_languagetool(resume)

    # 9) Calculate final ATS score percentage
    ats_score = calculate_ats_score(
        section_presence=section_presence,
        experience_bullet_count=experience_bullet_count,
        project_count=project_count,
        project_bullet_count=project_bullet_count,
        keyword_result=keyword_result,
        measurable_result=measurable_result,
        weak_phrase_flags=weak_phrase_flags,
        grammar_flags=grammar_flags,
        rubric=rubric,
    )

    return {
        "ats_score": ats_score,
        "rubric_used": {
            "target_role": target_role,
            "target_level": target_level,
            "expected_keywords": rubric["expected_keywords"],
            "expected_skills": rubric["expected_skills"],
            "preferred_min_projects": rubric["preferred_min_projects"],
            "preferred_min_experience_bullets": rubric["preferred_min_experience_bullets"],
            "preferred_min_project_bullets": rubric["preferred_min_project_bullets"],
            "notes": rubric["notes"],
        },
        "section_presence": section_presence,
        "experience_bullet_count": experience_bullet_count,
        "project_count": project_count,
        "project_bullet_count": project_bullet_count,
        "keyword_result": keyword_result,
        "measurable_evidence": measurable_result,
        "weak_phrase_flags": weak_phrase_flags,
        "grammar_flags": grammar_flags,
    }