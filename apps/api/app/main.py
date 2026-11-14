"""FastAPI application for Makesmith's design workspace."""

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
        design, cached = service.design_with_status(request.idea, request.answers)
        return {"design": design, "cached": cached}
    except DesignError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error))


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
