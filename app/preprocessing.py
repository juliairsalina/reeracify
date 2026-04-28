from __future__ import annotations

import re
from typing import Any


def clean_text(text: str) -> str:
    return (
        str(text or "")
        .replace("\r", "")
        .replace("\t", " ")
        .replace("\n\n", "\n")
        .strip()
    )


def extract_email(text: str) -> str:
    match = re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", text, re.I)
    return match.group(0) if match else ""


def extract_phone(text: str) -> str:
    match = re.search(r"\+?\d[\d\s-]{8,}\d", text)
    return match.group(0).strip() if match else ""


def extract_name(lines: list[str]) -> str:
    for line in lines:
        if "@" not in line and not re.search(r"\+?\d[\d\s-]{8,}\d", line):
            return line.split("|")[0].strip()
    return ""


def is_bullet(line: str) -> bool:
    return bool(re.match(r"^[•·\-–]\s+", line.strip()))


def clean_bullet(line: str) -> str:
    return re.sub(r"^[•·\-–]\s*", "", line).strip()


def split_sections(lines: list[str]) -> dict[str, list[str]]:
    current = "summary"

    sections = {
        "summary": [],
        "education": [],
        "experience": [],
        "projects": [],
        "skills": [],
        "awards": [],
    }

    for line in lines:
        upper = line.upper()

        if "SUMMARY" in upper or "PROFILE" in upper:
            current = "summary"
            continue
        if "EDUCATION" in upper:
            current = "education"
            continue
        if "WORK EXPERIENCE" in upper or "PROFESSIONAL EXPERIENCE" in upper or upper == "EXPERIENCE":
            current = "experience"
            continue
        if "PROJECT" in upper:
            current = "projects"
            continue
        if "SKILLS" in upper:
            current = "skills"
            continue
        if "AWARDS" in upper or "CERTIFICATION" in upper or "ACHIEVEMENT" in upper:
            current = "awards"
            continue

        sections[current].append(line)

    return sections


def extract_dates(text: str) -> tuple[str, str]:
    match = re.search(
        r"((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)?\.?\s*\d{4})\s*[-–]\s*(Present|Current|Now|((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)?\.?\s*\d{4}))",
        text,
        re.I,
    )

    if not match:
        return "", ""

    parts = re.split(r"[-–]", match.group(0))
    return parts[0].strip(), parts[1].strip() if len(parts) > 1 else ""


def remove_dates(text: str) -> str:
    return re.sub(
        r"((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)?\.?\s*\d{4})\s*[-–]\s*(Present|Current|Now|((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)?\.?\s*\d{4}))",
        "",
        text,
        flags=re.I,
    ).strip()


def parse_education(lines: list[str]) -> list[dict[str, Any]]:
    results = []

    block = " ".join(lines)
    if not block:
        return results

    school_matches = re.findall(
        r"([A-Z][A-Za-z&.'’\-\s]{2,}(University|College|Institute|School|Academy|MIIT))",
        block,
        re.I,
    )

    if not school_matches:
        return results

    for match in school_matches:
        school = match[0].strip()
        start_date, end_date = extract_dates(block)

        degree_match = re.search(
            r"(Bachelor|Master|PhD|Diploma|Foundation|Certificate|B\.S\.|BSc|M\.S\.|MSc)",
            block,
            re.I,
        )

        field_match = re.search(
            r"(Data Science|Computer Science|Information Technology|Software Engineering|Business|Marketing)",
            block,
            re.I,
        )

        gpa_match = re.search(r"(GPA|CGPA|Result)\s*[:\-]?\s*(\d\.\d{1,2}(?:/\d\.\d{1,2})?)", block, re.I)

        results.append(
            {
                "school": school,
                "degree": degree_match.group(0) if degree_match else "",
                "field": field_match.group(0) if field_match else "",
                "start_date": start_date,
                "end_date": end_date,
                "gpa": gpa_match.group(2) if gpa_match else "",
            }
        )

    return results


def parse_experience(lines: list[str]) -> list[dict[str, Any]]:
    results = []
    current = None

    def push_current() -> None:
        nonlocal current
        if current and (current["role"] or current["company"] or current["bullets"]):
            results.append(current)

    for line in lines:
        if is_bullet(line):
            if current is None:
                current = {
                    "company": "",
                    "role": "Experience",
                    "start_date": "",
                    "end_date": "",
                    "bullets": [],
                }

            current["bullets"].append(clean_bullet(line))
            continue

        push_current()

        start_date, end_date = extract_dates(line)
        title = remove_dates(line)

        role = title
        company = ""

        if " - " in title:
            parts = title.split(" - ")
            role = parts[0].strip()
            company = " - ".join(parts[1:]).strip()
        elif "|" in title:
            parts = title.split("|")
            role = parts[0].strip()
            company = parts[1].strip() if len(parts) > 1 else ""

        current = {
            "company": company,
            "role": role,
            "start_date": start_date,
            "end_date": end_date,
            "bullets": [],
        }

    push_current()

    return [
        item for item in results
        if item["role"] or item["company"] or item["bullets"]
    ]


def parse_projects(lines: list[str]) -> list[dict[str, Any]]:
    results = []
    current = None

    tech_pattern = re.compile(
        r"\b(Python|Java|JavaScript|TypeScript|React|Next\.js|FastAPI|Flask|Django|SQL|MySQL|PostgreSQL|MongoDB|Docker|Azure|OpenAI|PyTorch|TensorFlow|scikit-learn|Pandas|NumPy|Excel|Power BI|Tableau|Git)\b",
        re.I,
    )

    def push_current() -> None:
        nonlocal current
        if current and (current["name"] or current["bullets"]):
            current["technologies"] = sorted(set(current["technologies"]))
            results.append(current)

    for line in lines:
        if is_bullet(line):
            if current is None:
                current = {
                    "name": "Project",
                    "start_date": "",
                    "end_date": "",
                    "technologies": [],
                    "bullets": [],
                }

            bullet = clean_bullet(line)
            current["bullets"].append(bullet)
            current["technologies"].extend(tech_pattern.findall(bullet))
            continue

        push_current()

        start_date, end_date = extract_dates(line)

        current = {
            "name": remove_dates(line),
            "start_date": start_date,
            "end_date": end_date,
            "technologies": [],
            "bullets": [],
        }

    push_current()

    return [item for item in results if item["name"] or item["bullets"]]


def parse_skills(lines: list[str]) -> list[str]:
    text = " ".join(lines)

    skill_pattern = re.compile(
        r"\b(Python|Java|JavaScript|TypeScript|React|Next\.js|Node\.js|Express|FastAPI|Flask|Django|SQL|MySQL|PostgreSQL|MongoDB|Docker|Git|GitHub|Azure|OpenAI|Machine Learning|Deep Learning|NLP|Pandas|NumPy|scikit-learn|PyTorch|TensorFlow|Excel|Power BI|Tableau|HTML|CSS|Tailwind|Linux|Firebase|REST API|API)\b",
        re.I,
    )

    skills = skill_pattern.findall(text)

    for line in lines:
        cleaned = re.sub(r"skills\s*:?", "", line, flags=re.I)
        for part in re.split(r"[,;|]", cleaned):
            part = part.strip()
            if 1 < len(part) <= 35:
                skills.append(part)

    return sorted(set(skill.strip() for skill in skills if skill.strip()))


def parse_resume_text(
    text: str,
    target_role: str = "Data Analyst",
    target_level: str = "Entry-level",
) -> dict[str, Any]:
    cleaned = clean_text(text)

    lines = [
        line.strip()
        for line in cleaned.split("\n")
        if len(line.strip()) > 1
    ]

    sections = split_sections(lines)

    return {
        "target_role": target_role,
        "target_level": target_level,

        "name": extract_name(lines),
        "email": extract_email(cleaned),
        "phone": extract_phone(cleaned),
        "address": None,
        "summary": " ".join(sections["summary"]),

        "education": parse_education(sections["education"]),
        "experience": parse_experience(sections["experience"]),
        "projects": parse_projects(sections["projects"]),
        "skills": parse_skills(sections["skills"]),
        "awards": [],
    }