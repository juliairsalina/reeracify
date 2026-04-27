from __future__ import annotations

import csv
import re
from pathlib import Path
from typing import Any

import language_tool_python


# ============================================================
# CSV config paths
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent
CONFIG_DIR = BASE_DIR / "config"

ROLE_RUBRIC_CSV = CONFIG_DIR / "role_level_rubrics.csv"
WEAK_PHRASES_CSV = CONFIG_DIR / "weak_phrases.csv"


# ============================================================
# CSV loading helpers
# ============================================================

def split_semicolon_list(value: str | None) -> list[str]:
    """
    Convert:
        "python;sql;excel"

    Into:
        ["python", "sql", "excel"]
    """
    if not value:
        return []

    return [item.strip() for item in value.split(";") if item.strip()]


def load_role_level_rubrics() -> dict[str, dict[str, dict[str, Any]]]:
    """
    Load role/level rubric from:
        config/role_level_rubrics.csv
    """
    if not ROLE_RUBRIC_CSV.exists():
        raise FileNotFoundError(f"Missing rubric CSV file: {ROLE_RUBRIC_CSV}")

    rubrics: dict[str, dict[str, dict[str, Any]]] = {}

    with open(ROLE_RUBRIC_CSV, newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)

        for row in reader:
            target_role = row.get("target_role", "").strip()
            target_level = row.get("target_level", "").strip()

            if not target_role or not target_level:
                continue

            if target_role not in rubrics:
                rubrics[target_role] = {}

            rubrics[target_role][target_level] = {
                "expected_keywords": split_semicolon_list(
                    row.get("expected_keywords")
                ),
                "expected_skills": split_semicolon_list(
                    row.get("expected_skills")
                ),
                "preferred_min_projects": int(
                    row.get("preferred_min_projects") or 1
                ),
                "preferred_min_experience_bullets": int(
                    row.get("preferred_min_experience_bullets") or 1
                ),
                "preferred_min_project_bullets": int(
                    row.get("preferred_min_project_bullets") or 1
                ),
                "notes": row.get("notes", "").strip(),
            }

    if not rubrics:
        raise ValueError("Rubric CSV exists but no valid rubrics were loaded.")

    return rubrics


def load_weak_phrases() -> list[str]:
    """
    Load weak phrases from:
        config/weak_phrases.csv
    """
    if not WEAK_PHRASES_CSV.exists():
        raise FileNotFoundError(f"Missing weak phrases CSV file: {WEAK_PHRASES_CSV}")

    phrases: list[str] = []

    with open(WEAK_PHRASES_CSV, newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)

        for row in reader:
            phrase = row.get("phrase", "").strip().lower()

            if phrase:
                phrases.append(phrase)

    return phrases


def get_rubric(target_role: str, target_level: str) -> dict[str, Any]:
    """
    Get rubric for selected role + level.

    Fallback behavior:
    1. exact role + exact level
    2. exact role + Entry-level
    3. Data Analyst + Entry-level
    4. first available rubric
    """
    rubrics = load_role_level_rubrics()

    target_role = target_role.strip() if target_role else ""
    target_level = target_level.strip() if target_level else ""

    if target_role in rubrics:
        role_rubric = rubrics[target_role]

        if target_level in role_rubric:
            return role_rubric[target_level]

        if "Entry-level" in role_rubric:
            return role_rubric["Entry-level"]

        return next(iter(role_rubric.values()))

    if "Data Analyst" in rubrics and "Entry-level" in rubrics["Data Analyst"]:
        return rubrics["Data Analyst"]["Entry-level"]

    first_role = next(iter(rubrics.values()))
    return next(iter(first_role.values()))


# ============================================================
# Text extraction helpers
# ============================================================

def normalize_text(text: str | None) -> str:
    if not text:
        return ""

    return text.lower().strip()


def clean_string_list(values: list[Any]) -> list[str]:
    """
    Removes empty strings and non-string values from a list.
    """
    clean_values = []

    for value in values:
        if isinstance(value, str) and value.strip():
            clean_values.append(value.strip())

    return clean_values


def collect_resume_text(resume: dict[str, Any]) -> str:
    """
    Collect all important resume text into one string.

    Used for keyword matching.
    """
    parts: list[str] = []

    for edu in resume.get("education", []):
        parts.extend(
            [
                edu.get("school", "") or "",
                edu.get("degree", "") or "",
                edu.get("field", "") or "",
                edu.get("gpa", "") or "",
            ]
        )

    for exp in resume.get("experience", []):
        parts.extend(
            [
                exp.get("company", "") or "",
                exp.get("role", "") or "",
                exp.get("description", "") or "",
            ]
        )
        parts.extend(clean_string_list(exp.get("bullets", [])))

    for project in resume.get("projects", []):
        parts.extend(
            [
                project.get("name", "") or "",
                project.get("description", "") or "",
            ]
        )
        parts.extend(clean_string_list(project.get("technologies", [])))
        parts.extend(clean_string_list(project.get("bullets", [])))

    parts.extend(clean_string_list(resume.get("skills", [])))

    for award in resume.get("awards", []):
        parts.extend(
            [
                award.get("title", "") or "",
                award.get("issuer", "") or "",
                award.get("description", "") or "",
            ]
        )

    return " ".join(part for part in parts if part.strip())


def get_all_bullets(resume: dict[str, Any]) -> list[dict[str, str]]:
    """
    Return every non-empty experience/project bullet with a stable ID.

    Example IDs:
        exp_1_b1
        proj_1_b1
    """
    bullets: list[dict[str, str]] = []

    for exp_index, exp in enumerate(resume.get("experience", []), start=1):
        for bullet_index, bullet in enumerate(exp.get("bullets", []), start=1):
            if not isinstance(bullet, str) or not bullet.strip():
                continue

            bullets.append(
                {
                    "id": f"exp_{exp_index}_b{bullet_index}",
                    "section": "experience",
                    "text": bullet.strip(),
                }
            )

    for project_index, project in enumerate(resume.get("projects", []), start=1):
        for bullet_index, bullet in enumerate(project.get("bullets", []), start=1):
            if not isinstance(bullet, str) or not bullet.strip():
                continue

            bullets.append(
                {
                    "id": f"proj_{project_index}_b{bullet_index}",
                    "section": "projects",
                    "text": bullet.strip(),
                }
            )

    return bullets


# ============================================================
# Rule-based scoring checks
# ============================================================

def check_section_presence(resume: dict[str, Any]) -> dict[str, bool]:
    """
    Checks whether important resume sections exist.
    """
    education = resume.get("education", [])
    experience = resume.get("experience", [])
    projects = resume.get("projects", [])
    skills = clean_string_list(resume.get("skills", []))

    return {
        "education": bool(education),
        "experience": bool(experience),
        "projects": bool(projects),
        "skills": bool(skills),
    }


def count_experience_bullets(resume: dict[str, Any]) -> int:
    """
    Counts non-empty experience bullets.
    """
    count = 0

    for exp in resume.get("experience", []):
        count += len(clean_string_list(exp.get("bullets", [])))

    return count


def count_projects(resume: dict[str, Any]) -> int:
    """
    Counts projects that have at least a name, description, technology, or bullet.
    """
    count = 0

    for project in resume.get("projects", []):
        name = project.get("name", "")
        description = project.get("description", "")
        technologies = clean_string_list(project.get("technologies", []))
        bullets = clean_string_list(project.get("bullets", []))

        if name or description or technologies or bullets:
            count += 1

    return count


def count_project_bullets(resume: dict[str, Any]) -> int:
    """
    Counts non-empty project bullets.
    """
    count = 0

    for project in resume.get("projects", []):
        count += len(clean_string_list(project.get("bullets", [])))

    return count


def match_keywords(
    resume: dict[str, Any],
    expected_keywords: list[str],
) -> dict[str, list[str]]:
    """
    Checks whether expected role keywords appear anywhere in the resume.

    Single-word keyword:
        uses word boundary matching

    Multi-word keyword:
        uses phrase matching
    """
    resume_text = normalize_text(collect_resume_text(resume))

    present = []
    missing = []

    for keyword in expected_keywords:
        keyword_normalized = normalize_text(keyword)

        if not keyword_normalized:
            continue

        if " " in keyword_normalized:
            found = keyword_normalized in resume_text
        else:
            pattern = r"\b" + re.escape(keyword_normalized) + r"\b"
            found = re.search(pattern, resume_text) is not None

        if found:
            present.append(keyword)
        else:
            missing.append(keyword)

    return {
        "present_keywords": present,
        "missing_keywords": missing,
    }


def has_measurable_evidence(text: str) -> bool:
    """
    Detects simple measurable evidence, such as:
    - 20%
    - 100 users
    - 5 projects
    - 3 months
    - $500
    - 2x
    """
    patterns = [
        r"\d+%",
        r"\$\d+",
        r"\d+x",
        r"\b\d+\b",
        r"\b\d+\s*(users|customers|records|rows|students|projects|hours|days|weeks|months|events|reports|dashboards|models|experiments|classes|members)\b",
    ]

    text_lower = normalize_text(text)

    return any(re.search(pattern, text_lower) for pattern in patterns)


def detect_measurable_evidence(resume: dict[str, Any]) -> dict[str, Any]:
    """
    Checks whether bullets include numbers or measurable outcomes.
    """
    bullets = get_all_bullets(resume)

    bullets_with_metrics = []
    bullets_without_metrics = []

    for bullet in bullets:
        if has_measurable_evidence(bullet["text"]):
            bullets_with_metrics.append(bullet["id"])
        else:
            bullets_without_metrics.append(bullet["id"])

    return {
        "bullets_with_metrics": bullets_with_metrics,
        "bullets_without_metrics": bullets_without_metrics,
        "metric_bullet_count": len(bullets_with_metrics),
        "total_bullet_count": len(bullets),
    }


def detect_weak_phrases(resume: dict[str, Any]) -> list[dict[str, str]]:
    """
    Detects weak/passive phrases from config/weak_phrases.csv.
    """
    weak_phrases = load_weak_phrases()
    weak_bullets = []

    for bullet in get_all_bullets(resume):
        text_lower = normalize_text(bullet["text"])

        for phrase in weak_phrases:
            if phrase in text_lower:
                weak_bullets.append(
                    {
                        "id": bullet["id"],
                        "section": bullet["section"],
                        "text": bullet["text"],
                        "weak_phrase": phrase,
                        "reason": f"Uses weak phrase: '{phrase}'",
                    }
                )
                break

    return weak_bullets


def check_grammar_with_languagetool(
    resume: dict[str, Any],
    language: str = "en-US",
) -> list[dict[str, Any]]:
    """
    Runs local LanguageTool grammar/spelling check.

    Requirements:
        pip install language-tool-python
        Java installed locally

    If LanguageTool fails, it returns a warning instead of crashing
    the whole ATS pipeline.
    """
    grammar_flags: list[dict[str, Any]] = []

    try:
        tool = language_tool_python.LanguageTool(language)
    except Exception as exc:
        return [
            {
                "id": "language_tool_setup_error",
                "section": "system",
                "text": "",
                "issue_count": 0,
                "issues": [],
                "warning": f"Failed to start local LanguageTool: {str(exc)}",
            }
        ]

    try:
        for bullet in get_all_bullets(resume):
            text = bullet["text"]

            try:
                matches = tool.check(text)
            except Exception as exc:
                grammar_flags.append(
                    {
                        "id": bullet["id"],
                        "section": bullet["section"],
                        "text": text,
                        "issue_count": 0,
                        "issues": [],
                        "warning": f"Local LanguageTool check failed: {str(exc)}",
                    }
                )
                continue

            if not matches:
                continue

            simplified_issues = []

            for match in matches[:3]:
                offset = getattr(match, "offset", None)
                error_length = getattr(match, "error_length", None)

                matched_text = ""

                if isinstance(offset, int) and isinstance(error_length, int):
                    matched_text = text[offset : offset + error_length]

                simplified_issues.append(
                    {
                        "message": getattr(match, "message", ""),
                        "short_message": getattr(match, "short_message", ""),
                        "rule_id": getattr(
                            match,
                            "rule_id",
                            getattr(match, "ruleId", ""),
                        ),
                        "category": str(getattr(match, "category", "")),
                        "matched_text": matched_text,
                        "suggestions": getattr(match, "replacements", [])[:3],
                    }
                )

            grammar_flags.append(
                {
                    "id": bullet["id"],
                    "section": bullet["section"],
                    "text": text,
                    "issue_count": len(matches),
                    "issues": simplified_issues,
                }
            )

    finally:
        tool.close()

    return grammar_flags


# ============================================================
# ATS score calculation
# ============================================================

def calculate_ats_score(
    section_presence: dict[str, bool],
    experience_bullet_count: int,
    project_count: int,
    project_bullet_count: int,
    keyword_result: dict[str, list[str]],
    measurable_result: dict[str, Any],
    weak_phrase_flags: list[dict[str, str]],
    grammar_flags: list[dict[str, Any]],
    rubric: dict[str, Any],
) -> int:
    """
    Simple MVP ATS score out of 100.

    Score breakdown:
    1. Section presence:             20 points
    2. Experience bullet count:      15 points
    3. Project count:                10 points
    4. Project bullet count:          5 points
    5. Keyword matching:             25 points
    6. Measurable evidence:          15 points
    7. Weak phrase penalty:          - up to 12 points
    8. Grammar/spelling penalty:     - up to 10 points
    """
    score = 0

    # 1) Section presence: max 20
    if section_presence:
        section_score = sum(section_presence.values()) / len(section_presence) * 20
        score += int(section_score)

    # 2) Experience bullet count: max 15
    preferred_exp_bullets = max(
        int(rubric.get("preferred_min_experience_bullets", 1)),
        1,
    )
    exp_score = min(experience_bullet_count / preferred_exp_bullets, 1.0) * 15
    score += int(exp_score)

    # 3) Project count: max 10
    preferred_projects = max(
        int(rubric.get("preferred_min_projects", 1)),
        1,
    )
    project_score = min(project_count / preferred_projects, 1.0) * 10
    score += int(project_score)

    # 4) Project bullet count: max 5
    preferred_project_bullets = max(
        int(rubric.get("preferred_min_project_bullets", 1)),
        1,
    )
    project_bullet_score = min(
        project_bullet_count / preferred_project_bullets,
        1.0,
    ) * 5
    score += int(project_bullet_score)

    # 5) Keyword matching: max 25
    total_keywords = (
        len(keyword_result.get("present_keywords", []))
        + len(keyword_result.get("missing_keywords", []))
    )

    if total_keywords > 0:
        keyword_score = (
            len(keyword_result.get("present_keywords", [])) / total_keywords
        ) * 25
        score += int(keyword_score)

    # 6) Measurable evidence: max 15
    total_bullets = measurable_result.get("total_bullet_count", 0)

    if total_bullets > 0:
        metric_score = (
            measurable_result.get("metric_bullet_count", 0) / total_bullets
        ) * 15
        score += int(metric_score)

    # 7) Weak phrase penalty: max -12
    score -= min(len(weak_phrase_flags) * 3, 12)

    # 8) Grammar/spelling penalty: max -10
    score -= min(len(grammar_flags) * 2, 10)

    return max(0, min(score, 100))


# ============================================================
# Main function used by FastAPI and CLI
# ============================================================

def run_rule_based_scoring(
    resume: dict[str, Any],
    target_role: str,
    target_level: str,
) -> dict[str, Any]:
    """
    Main rule-based scoring pipeline.

    This function should not call any LLM agent.

    Flow:
    1. Load rubric
    2. Extract all bullets
    3. Check section presence
    4. Count experience/project evidence
    5. Match keywords
    6. Detect measurable evidence
    7. Detect weak phrases
    8. Run grammar/spelling check
    9. Calculate ATS score
    10. Return structured signals for Evaluation Agent and Rewrite Agent
    """
    rubric = get_rubric(target_role, target_level)

    all_bullets = get_all_bullets(resume)

    section_presence = check_section_presence(resume)
    experience_bullet_count = count_experience_bullets(resume)
    project_count = count_projects(resume)
    project_bullet_count = count_project_bullets(resume)

    keyword_result = match_keywords(
        resume=resume,
        expected_keywords=rubric["expected_keywords"],
    )

    measurable_result = detect_measurable_evidence(resume)
    weak_phrase_flags = detect_weak_phrases(resume)
    grammar_flags = check_grammar_with_languagetool(resume)

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
            "preferred_min_experience_bullets": rubric[
                "preferred_min_experience_bullets"
            ],
            "preferred_min_project_bullets": rubric[
                "preferred_min_project_bullets"
            ],
            "notes": rubric["notes"],
        },
        "all_bullets": all_bullets,
        "section_presence": section_presence,
        "experience_bullet_count": experience_bullet_count,
        "project_count": project_count,
        "project_bullet_count": project_bullet_count,
        "keyword_result": keyword_result,
        "measurable_evidence": measurable_result,
        "weak_phrase_flags": weak_phrase_flags,
        "grammar_flags": grammar_flags,
    }