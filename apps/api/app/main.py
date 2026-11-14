"""FastAPI application for Makesmith's design workspace."""

from concurrent.futures import Future, ThreadPoolExecutor
from collections import OrderedDict
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from typing import Optional

from .design import DesignError, DesignService
from .intake import IntakeError, IntakeService
from .cad import CadError, CadService
from .checks import ChecksService

app = FastAPI(title="Makesmith API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin for origin in __import__("os").getenv("WEB_ORIGINS", "http://localhost:3000").split(",") if origin],
    allow_methods=["GET", "POST"],
    allow_headers=["content-type"],
)
service = DesignService()
intake_service = IntakeService()
cad_service = CadService()
checks_service = ChecksService()
_design_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="makesmith-design")
_design_jobs: OrderedDict[str, Future] = OrderedDict()


class DesignRequest(BaseModel):
    idea: str = Field(min_length=1, max_length=5000)
    answers: dict[str, Optional[str]] = Field(default_factory=dict)

    @field_validator("idea")
    @classmethod
    def design_idea_must_contain_text(cls, value):
        if not value.strip():
            raise ValueError("Describe your hardware idea.")
        return value


class IntakeRequest(BaseModel):
    idea: str = Field(min_length=1, max_length=5000)

    @field_validator("idea")
    @classmethod
    def idea_must_contain_text(cls, value):
        if not value.strip():
            raise ValueError("Describe your hardware idea.")
        return value


class CadRequest(BaseModel):
    design: dict


class ChecksRequest(BaseModel):
    design: dict


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/design")
def create_design(request: DesignRequest):
    try:
        intake = intake_service.intake(request.idea)
        if intake["feasibility"] == "unsafe":
            raise HTTPException(status_code=422, detail=intake["explanation"])
        if intake["feasibility"] == "impossible":
            raise HTTPException(status_code=422, detail="This idea was marked physically impossible. Choose one of the alternatives from the feasibility check.")
        design, cached = service.design_with_status(request.idea, request.answers)
        return {"design": design, "cached": cached}
    except IntakeError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error))
    except DesignError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error))


@app.post("/api/design/jobs", status_code=202)
def start_design_job(request: DesignRequest):
    """Queue long-running research and design work so the browser can poll it."""
    try:
        intake = intake_service.intake(request.idea)
        if intake["feasibility"] == "unsafe":
            raise HTTPException(status_code=422, detail=intake["explanation"])
        if intake["feasibility"] == "impossible":
            raise HTTPException(status_code=422, detail="This idea was marked physically impossible. Choose one of the alternatives from the feasibility check.")
        job_id = uuid4().hex
        _design_jobs[job_id] = _design_executor.submit(service.design_with_status, request.idea, request.answers)
        while len(_design_jobs) > 32:
            oldest_id, oldest = next(iter(_design_jobs.items()))
            if not oldest.done():
                break
            _design_jobs.pop(oldest_id)
        return {"job_id": job_id}
    except IntakeError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error))
    except DesignError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error))


@app.get("/api/design/jobs/{job_id}")
def get_design_job(job_id: str):
    future = _design_jobs.get(job_id)
    if future is None:
        raise HTTPException(status_code=404, detail="This design job expired. Start the design again.")
    if not future.done():
        return {"status": "pending"}
    try:
        design, cached = future.result()
        return {"status": "complete", "design": design, "cached": cached}
    except DesignError as error:
        return {"status": "error", "detail": str(error)}
    except Exception:
        return {"status": "error", "detail": "OpenAI design could not be generated. Please try again."}


@app.post("/api/intake")
def create_intake(request: IntakeRequest):
    try:
        return intake_service.intake(request.idea)
    except IntakeError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error))


@app.post("/api/cad")
def create_cad(request: CadRequest):
    try:
        return cad_service.compile_design(request.design)
    except CadError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error))


@app.post("/api/checks")
def create_checks(request: ChecksRequest):
    try:
        return checks_service.calculate(request.design)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error))
