from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.evaluation_agent import evaluate_resume_with_agent
from app.rewrite_agent import rewrite_bullet_with_agent
from app.rule_scoring import run_rule_based_scoring


# ============================================================
# File path
# ============================================================

FINAL_JSON_PATH = Path("sample/final.json")


# ============================================================
# FastAPI app
# ============================================================

app = FastAPI(
    title="Reeracify Resume Evaluation Backend",
    description=(
        "Backend for rule-based ATS scoring, Evaluation Agent, "
        "Rewrite Agent, saving user edits, and accepting rewrite suggestions."
    ),
    version="0.1.0",
)


# ============================================================
# Type aliases
# ============================================================

TargetRole = str
TargetLevel = Literal["Entry-level", "Experienced"]


# ============================================================
# Pydantic models
# final.json structure after preprocessing
# ============================================================

class EducationItem(BaseModel):
    school: str = ""
    degree: str | None = None
    field: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    gpa: str | None = None


class ExperienceItem(BaseModel):
    company: str = ""
    role: str = ""
    start_date: str | None = None
    end_date: str | None = None
    bullets: list[str] = Field(default_factory=list)


class ProjectItem(BaseModel):
    name: str = ""
    technologies: list[str] = Field(default_factory=list)
    bullets: list[str] = Field(default_factory=list)


class AwardItem(BaseModel):
    title: str = ""
    issuer: str | None = None
    date: str | None = None
    bullets: list[str] = Field(default_factory=list)


class ResumeInput(BaseModel):
    target_role: TargetRole
    target_level: TargetLevel

    name: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    summary: str | None = None

    education: list[EducationItem] = Field(default_factory=list)
    experience: list[ExperienceItem] = Field(default_factory=list)
    projects: list[ProjectItem] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    awards: list[AwardItem] = Field(default_factory=list)


class RewriteRequest(BaseModel):
    target_role: TargetRole
    target_level: TargetLevel

    selected_bullet: str

    rule_based_signals: dict[str, Any]
    evaluation_agent_result: dict[str, Any]

    user_instruction: str | None = None


class AcceptRewriteRequest(BaseModel):
    bullet_id: str
    accepted_bullet: str


# ============================================================
# Validation helper
# ============================================================

def validate_resume_input(resume_input: ResumeInput) -> None:
    """
    Basic validation before running the pipeline.

    final.json must already contain:
        - target_role
        - target_level
    """
    if not resume_input.target_role.strip():
        raise ValueError(
            "Missing target_role in final.json. "
            "Example: \"target_role\": \"Data Analyst\""
        )

    if not resume_input.target_level.strip():
        raise ValueError(
            "Missing target_level in final.json. "
            "Example: \"target_level\": \"Entry-level\""
        )


# ============================================================
# final.json read/write helpers
# ============================================================

def read_final_json(path: Path = FINAL_JSON_PATH) -> ResumeInput:
    """
    Read the current preprocessed resume from sample/final.json.
    """
    if not path.exists():
        raise FileNotFoundError(
            f"Cannot find {path}. Make sure preprocessing created sample/final.json."
        )

    with open(path, "r", encoding="utf-8") as file:
        data = json.load(file)

    return ResumeInput.model_validate(data)


def write_final_json(
    resume_input: ResumeInput,
    path: Path = FINAL_JSON_PATH,
) -> None:
    """
    Save updated resume back to sample/final.json.
    """
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "w", encoding="utf-8") as file:
        json.dump(
            resume_input.model_dump(),
            file,
            indent=2,
            ensure_ascii=False,
        )


# ============================================================
# Bullet update helper
# ============================================================

def update_bullet_by_id(
    resume_input: ResumeInput,
    bullet_id: str,
    new_bullet: str,
) -> ResumeInput:
    """
    Update one bullet in the resume using bullet ID.

    Supported IDs:
        exp_1_b1
        proj_1_b1
    """
    if not new_bullet.strip():
        raise ValueError("New bullet cannot be empty.")

    parts = bullet_id.split("_")

    if len(parts) != 3:
        raise ValueError(
            "Invalid bullet_id format. Expected format like exp_1_b1 or proj_1_b1."
        )

    section = parts[0]

    try:
        item_index = int(parts[1]) - 1
        bullet_index = int(parts[2].replace("b", "")) - 1
    except ValueError as exc:
        raise ValueError(
            "Invalid bullet_id number format. Expected format like exp_1_b1."
        ) from exc

    if section == "exp":
        if item_index < 0 or item_index >= len(resume_input.experience):
            raise ValueError(f"Experience index out of range for bullet_id: {bullet_id}")

        bullets = resume_input.experience[item_index].bullets

        if bullet_index < 0 or bullet_index >= len(bullets):
            raise ValueError(f"Bullet index out of range for bullet_id: {bullet_id}")

        bullets[bullet_index] = new_bullet.strip()
        return resume_input

    if section == "proj":
        if item_index < 0 or item_index >= len(resume_input.projects):
            raise ValueError(f"Project index out of range for bullet_id: {bullet_id}")

        bullets = resume_input.projects[item_index].bullets

        if bullet_index < 0 or bullet_index >= len(bullets):
            raise ValueError(f"Bullet index out of range for bullet_id: {bullet_id}")

        bullets[bullet_index] = new_bullet.strip()
        return resume_input

    raise ValueError(
        "Invalid bullet_id section. Expected exp_1_b1 or proj_1_b1."
    )


# ============================================================
# Full evaluation pipeline
# ============================================================

def run_full_evaluation_pipeline(
    resume_input: ResumeInput,
    run_agent: bool = True,
) -> dict[str, Any]:
    """
    Full resume evaluation pipeline.

    Flow:
        1. Receive final.json-style structured resume
        2. Convert Pydantic model into normal dictionary
        3. Run rule-based ATS scoring
        4. Send rule-based signals to Evaluation Agent
        5. Return ATS score, rule signals, and evaluation result
    """
    validate_resume_input(resume_input)

    resume_dict = resume_input.model_dump()

    # 1) Rule-based scoring
    rule_based_signals = run_rule_based_scoring(
        resume=resume_dict,
        target_role=resume_input.target_role,
        target_level=resume_input.target_level,
    )

    # 2) Evaluation Agent
    evaluation_agent_result: dict[str, Any] | None = None

    if run_agent:
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
    Health check endpoint.
    """
    return {
        "status": "ok",
        "message": "Reeracify backend is running.",
    }


@app.post("/evaluate")
def evaluate_resume(resume_input: ResumeInput) -> dict[str, Any]:
    """
    Evaluates a resume sent directly in the request body.

    This does not automatically read sample/final.json.
    """
    try:
        return run_full_evaluation_pipeline(
            resume_input=resume_input,
            run_agent=True,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Evaluation failed: {str(exc)}",
        ) from exc


@app.post("/evaluate-file")
def evaluate_file() -> dict[str, Any]:
    """
    Reads sample/final.json and evaluates it.

    Use this after preprocessing creates sample/final.json.
    """
    try:
        resume_input = read_final_json()

        return run_full_evaluation_pipeline(
            resume_input=resume_input,
            run_agent=True,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Evaluation from sample/final.json failed: {str(exc)}",
        ) from exc


@app.post("/rewrite")
def rewrite_bullet(request: RewriteRequest) -> dict[str, Any]:
    """
    Rewrites one selected bullet.

    Input:
        - target_role
        - target_level
        - selected_bullet
        - rule_based_signals from /evaluate or /evaluate-file
        - evaluation_agent_result from /evaluate or /evaluate-file
        - optional user_instruction

    Important:
        This only generates suggestions.
        It does not save changes to sample/final.json yet.
    """
    try:
        return rewrite_bullet_with_agent(
            target_role=request.target_role,
            target_level=request.target_level,
            selected_bullet=request.selected_bullet,
            rule_based_signals=request.rule_based_signals,
            evaluation_agent_result=request.evaluation_agent_result,
            user_instruction=request.user_instruction,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Rewrite failed: {str(exc)}",
        ) from exc


@app.post("/accept-rewrite")
def accept_rewrite(request: AcceptRewriteRequest) -> dict[str, Any]:
    """
    User accepts one rewrite suggestion.

    Flow:
        1. Read sample/final.json
        2. Replace selected bullet
        3. Save updated resume to sample/final.json
        4. Rerun full evaluation
    """
    try:
        resume_input = read_final_json()

        updated_resume = update_bullet_by_id(
            resume_input=resume_input,
            bullet_id=request.bullet_id,
            new_bullet=request.accepted_bullet,
        )

        write_final_json(updated_resume)

        reevaluation_result = run_full_evaluation_pipeline(
            resume_input=updated_resume,
            run_agent=True,
        )

        return {
            "status": "saved",
            "message": "Accepted rewrite saved to sample/final.json.",
            "updated_resume": updated_resume.model_dump(),
            "reevaluation_result": reevaluation_result,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Accept rewrite failed: {str(exc)}",
        ) from exc


@app.post("/ignore-rewrite")
def ignore_rewrite() -> dict[str, str]:
    """
    User rejects or ignores a rewrite suggestion.

    No file change is made.
    """
    return {
        "status": "ignored",
        "message": "No changes were saved to sample/final.json.",
    }


@app.post("/save-resume")
def save_resume(updated_resume_input: ResumeInput) -> dict[str, str]:
    """
    Saves manually edited resume back to sample/final.json.

    Use this when the user edits text directly in the frontend.
    """
    try:
        validate_resume_input(updated_resume_input)
        write_final_json(updated_resume_input)

        return {
            "status": "saved",
            "message": "Updated resume saved to sample/final.json.",
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Saving resume failed: {str(exc)}",
        ) from exc


@app.post("/reevaluate")
def reevaluate_resume(updated_resume_input: ResumeInput) -> dict[str, Any]:
    """
    Reevaluate a resume sent directly in the request body.

    This is useful if the frontend already has the updated resume object.
    """
    try:
        return run_full_evaluation_pipeline(
            resume_input=updated_resume_input,
            run_agent=True,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Reevaluation failed: {str(exc)}",
        ) from exc


@app.post("/reevaluate-file")
def reevaluate_file() -> dict[str, Any]:
    """
    Rereads sample/final.json and reevaluates it.

    This is useful after /save-resume or /accept-rewrite.
    """
    try:
        resume_input = read_final_json()

        return run_full_evaluation_pipeline(
            resume_input=resume_input,
            run_agent=True,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Reevaluation from sample/final.json failed: {str(exc)}",
        ) from exc


# ============================================================
# CLI debugging helpers
# ============================================================

def load_resume_json(path: str) -> ResumeInput:
    """
    Load final.json from local file.

    Default path is sample/final.json.
    """
    file_path = Path(path)

    if not file_path.exists():
        raise FileNotFoundError(
            f"Resume JSON file not found: {file_path}. "
            "Make sure preprocessing created sample/final.json."
        )

    with open(file_path, "r", encoding="utf-8") as file:
        data = json.load(file)

    return ResumeInput.model_validate(data)


def print_debug_result(result: dict[str, Any]) -> None:
    """
    Pretty print important debugging result.
    """
    print("\n==============================")
    print("ATS SCORE")
    print("==============================")
    print(result["ats_score"])

    rule_signals = result["rule_based_signals"]

    print("\n==============================")
    print("RUBRIC USED")
    print("==============================")
    print(json.dumps(rule_signals["rubric_used"], indent=2, ensure_ascii=False))

    print("\n==============================")
    print("SECTION PRESENCE")
    print("==============================")
    print(json.dumps(rule_signals["section_presence"], indent=2, ensure_ascii=False))

    print("\n==============================")
    print("ALL BULLETS")
    print("==============================")
    print(json.dumps(rule_signals["all_bullets"], indent=2, ensure_ascii=False))

    print("\n==============================")
    print("KEYWORD RESULT")
    print("==============================")
    print(json.dumps(rule_signals["keyword_result"], indent=2, ensure_ascii=False))

    print("\n==============================")
    print("MEASURABLE EVIDENCE")
    print("==============================")
    print(json.dumps(rule_signals["measurable_evidence"], indent=2, ensure_ascii=False))

    print("\n==============================")
    print("WEAK PHRASE FLAGS")
    print("==============================")
    print(json.dumps(rule_signals["weak_phrase_flags"], indent=2, ensure_ascii=False))

    print("\n==============================")
    print("GRAMMAR FLAGS")
    print("==============================")
    print(json.dumps(rule_signals["grammar_flags"], indent=2, ensure_ascii=False))

    print("\n==============================")
    print("EVALUATION AGENT RESULT")
    print("==============================")
    print(json.dumps(result["evaluation_agent_result"], indent=2, ensure_ascii=False))


def main() -> None:
    """
    Terminal debugging entry point.

    Default:
        python -m app.main

    This reads:
        sample/final.json

    Rule-based only:
        python -m app.main --skip-agent

    Custom path:
        python -m app.main sample/final.json --skip-agent
    """
    parser = argparse.ArgumentParser(
        description="Run Reeracify rule-based scoring and Evaluation Agent."
    )

    parser.add_argument(
        "resume_json",
        nargs="?",
        default=str(FINAL_JSON_PATH),
        help="Path to preprocessed resume JSON file. Default: sample/final.json",
    )

    parser.add_argument(
        "--skip-agent",
        action="store_true",
        help="Run only rule-based scoring without Evaluation Agent.",
    )

    args = parser.parse_args()

    resume_input = load_resume_json(args.resume_json)

    result = run_full_evaluation_pipeline(
        resume_input=resume_input,
        run_agent=not args.skip_agent,
    )

    print_debug_result(result)


if __name__ == "__main__":
    main()