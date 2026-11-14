"""FastAPI application for Makesmith's design workspace."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .design import DesignError, DesignService

app = FastAPI(title="Makesmith API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin for origin in __import__("os").getenv("WEB_ORIGINS", "http://localhost:3000").split(",") if origin],
    allow_methods=["GET", "POST"],
    allow_headers=["content-type"],
)
service = DesignService()


class DesignRequest(BaseModel):
    idea: str = Field(min_length=1, max_length=5000)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/design")
def create_design(request: DesignRequest):
    try:
        design, cached = service.design_with_status(request.idea)
        return {"design": design, "cached": cached}
    except DesignError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error))
