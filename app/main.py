from __future__ import annotations

import os
from typing import Any, Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.evaluation_agent import evaluate_resume_with_agent
from app.rewrite_agent import rewrite_bullet_with_agent
from app.rule_scoring import run_rule_based_scoring


# ============================================================
# Load .env
# ============================================================

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))


# ============================================================
# FastAPI app
# ============================================================

app = FastAPI(
    title="Reeracify Resume Evaluation Backend",
    description="Minimal backend for ATS scoring, evaluation agent, rewrite agent, and reevaluation.",
    version="0.1.0",
)


# ============================================================
# Allowed role/level values
# ============================================================

TargetRole = str
TargetLevel = Literal["Entry-level", "Experienced"]


# ============================================================
# Pydantic models
# ============================================================

class EducationItem(BaseModel):
    school: str
    degree: str | None = None
    field: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    gpa: str | None = None


class ExperienceItem(BaseModel):
    company: str
    role: str
    start_date: str | None = None
    end_date: str | None = None
    description: str | None = None
    bullets: list[str] = Field(default_factory=list)


class ProjectItem(BaseModel):
    name: str
    description: str | None = None
    technologies: list[str] = Field(default_factory=list)
    bullets: list[str] = Field(default_factory=list)


class ResumeInput(BaseModel):
    target_role: TargetRole
    target_level: TargetLevel
    education: list[EducationItem] = Field(default_factory=list)
    experience: list[ExperienceItem] = Field(default_factory=list)
    projects: list[ProjectItem] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)


class RewriteRequest(BaseModel):
    target_role: TargetRole
    target_level: TargetLevel
    selected_bullet: str
    weakness_reason: str
    missing_keywords: list[str] = Field(default_factory=list)
    grammar_flags: list[dict[str, Any]] = Field(default_factory=list)


# ============================================================
# Shared helper
# ============================================================

def run_full_evaluation_pipeline(resume_input: ResumeInput) -> dict[str, Any]:
    """
    1) Full evaluation pipeline rule

    This helper is used by both:
        - POST /evaluate
        - POST /reevaluate

    Flow:
        1. Convert Pydantic input into plain dictionary
        2. Run rule-based ATS scoring
        3. Run Evaluation Agent
        4. Return ATS score + rule signals + agent result
    """
    resume_dict = resume_input.model_dump()

    languagetool_url = os.getenv(
        "LANGUAGETOOL_URL",
        "https://api.languagetool.org/v2/check",
    )

    # 1) Rule-based ATS scoring
    rule_based_signals = run_rule_based_scoring(
        resume=resume_dict,
        target_role=resume_input.target_role,
        target_level=resume_input.target_level,
        languagetool_url=languagetool_url,
    )

    # 2) LLM-based evaluation agent
    evaluation_agent_result = evaluate_resume_with_agent(
        resume=resume_dict,
        target_role=resume_input.target_role,
        target_level=resume_input.target_level,
        rule_based_signals=rule_based_signals,
    )

    return {
        "ats_score": rule_based_signals["ats_score"],
        "rule_based_signals": rule_based_signals,
        "evaluation_agent_result": evaluation_agent_result,
    }


# ============================================================
# API endpoints
# ============================================================

@app.get("/")
def health_check() -> dict[str, str]:
    """
    2) Health check endpoint

    Used to confirm the backend is running.
    """
    return {
        "status": "ok",
        "message": "Reeracify backend is running.",
    }


@app.post("/evaluate")
def evaluate_resume(resume_input: ResumeInput) -> dict[str, Any]:
    """
    3) Evaluate endpoint

    Input:
        structured resume JSON

    Output:
        - ats_score
        - rule_based_signals
        - evaluation_agent_result
    """
    try:
        return run_full_evaluation_pipeline(resume_input)

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Evaluation failed: {str(exc)}",
        ) from exc


@app.post("/rewrite")
def rewrite_bullet(request: RewriteRequest) -> dict[str, Any]:
    """
    4) Rewrite endpoint

    Input:
        - target_role
        - target_level
        - selected_bullet
        - weakness_reason
        - missing_keywords
        - grammar_flags

    Output:
        - 1 to 3 rewrite suggestions
    """
    try:
        return rewrite_bullet_with_agent(
            target_role=request.target_role,
            target_level=request.target_level,
            selected_bullet=request.selected_bullet,
            weakness_reason=request.weakness_reason,
            missing_keywords=request.missing_keywords,
            grammar_flags=request.grammar_flags,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Rewrite failed: {str(exc)}",
        ) from exc


@app.post("/reevaluate")
def reevaluate_resume(updated_resume_input: ResumeInput) -> dict[str, Any]:
    """
    5) Reevaluate endpoint

    MVP behavior:
        The frontend sends the updated structured resume JSON.

    Backend simply reruns the same full evaluation pipeline:
        - rule-based scoring
        - evaluation agent

    No database is used.
    No resume state is stored.
    """
    try:
        return run_full_evaluation_pipeline(updated_resume_input)

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Reevaluation failed: {str(exc)}",
        ) from exc