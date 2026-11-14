"""OpenAI-backed hardware design generation with a process-local response cache."""

import json
import os
import urllib.error
import urllib.request

MAX_IDEA_CHARS = 5000
POWER_FIELDS = ("source", "voltage", "current", "capacity", "estimated_runtime")
DIMENSION_FIELDS = ("width", "height", "depth", "units")

DESIGN_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "components": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"name": {"type": "string"}, "purpose": {"type": "string"}},
                "required": ["name", "purpose"],
                "additionalProperties": False,
            },
        },
        "parts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "manufacturer": {"type": "string"},
                    "model": {"type": "string"},
                    "specifications": {"type": "array", "items": {"type": "string"}},
                    "quantity": {"type": "integer"},
                    "links": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["name", "manufacturer", "model", "specifications", "quantity", "links"],
                "additionalProperties": False,
            },
        },
        "connections": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "from": {"type": "string"},
                    "to": {"type": "string"},
                    "description": {"type": "string"},
                },
                "required": ["from", "to", "description"],
                "additionalProperties": False,
            },
        },
        "power": {
            "type": "object",
            "properties": {
                "source": {"type": "string"},
                "voltage": {"type": "string"},
                "current": {"type": "string"},
                "capacity": {"type": "string"},
                "estimated_runtime": {"type": "string"},
            },
            "required": ["source", "voltage", "current", "capacity", "estimated_runtime"],
            "additionalProperties": False,
        },
        "dimensions": {
            "type": "object",
            "properties": {
                "width": {"type": "string"},
                "height": {"type": "string"},
                "depth": {"type": "string"},
                "units": {"type": "string"},
            },
            "required": ["width", "height", "depth", "units"],
            "additionalProperties": False,
        },
    },
    "required": ["summary", "components", "parts", "connections", "power", "dimensions"],
    "additionalProperties": False,
}


class DesignError(Exception):
    """Safe, user-facing design generation failure with an HTTP status."""
    def __init__(self, message, status_code=502):
        super().__init__(message)
        self.status_code = status_code


class DesignService:
    def __init__(self, api_key=None, model=None, small_model=None, transport=None):
        self.api_key = api_key if api_key is not None else os.getenv("OPENAI_API_KEY")
        self.model = model or os.getenv("OPENAI_DESIGN_MODEL", "gpt-6-astra")
        self.small_model = small_model or os.getenv("OPENAI_SMALL_MODEL", "gpt-6-luna")
        self.transport = transport or self._request_openai
        self.cache = {}

    def design(self, idea):
        """Return normalized design JSON for an idea, reusing exact-idea cache entries."""
        return self.design_with_status(idea)[0]

    def design_with_status(self, idea):
        idea = idea.strip() if isinstance(idea, str) else ""
        if not idea:
            raise DesignError("Describe your hardware idea before generating a design.", status_code=422)
        if len(idea) > MAX_IDEA_CHARS:
            raise DesignError("Keep the idea under 5,000 characters.", status_code=422)
        if idea in self.cache:
            return self.cache[idea], True
        if not self.api_key:
            raise DesignError("AI design is unavailable. Set OPENAI_API_KEY on the API service.", status_code=503)

        payload = {
            "model": self.model,
            "store": False,
            "instructions": (
                "Create a practical first-pass hardware concept. Be honest about uncertainty and label "
                "estimates. Return the specified JSON fields; use empty strings or arrays when unknown."
            ),
            "input": "Hardware idea:\n" + idea,
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "makesmith_design",
                    "strict": True,
                    "schema": DESIGN_SCHEMA,
                }
            },
        }
        try:
            response = self.transport(self.api_key, payload)
            output = response.get("output", [])
            text = "".join(
                part.get("text", "")
                for item in output if item.get("type") == "message"
                for part in item.get("content", []) if part.get("type") == "output_text"
            )
            generated = json.loads(text, parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)))
            if not isinstance(generated, dict):
                raise ValueError("Expected a JSON object")
            normalized = self._normalize_design(generated)
        except (ValueError, TypeError, KeyError, AttributeError):
            raise DesignError("OpenAI returned an unreadable design. Please try again.")
        except Exception:
            raise DesignError("OpenAI design could not be generated. Check the API configuration and try again.")

        design = {"idea": idea, **normalized}
        self.cache[idea] = design
        return design, False

    @staticmethod
    def _normalize_design(generated):
        def text(value, field):
            if not isinstance(value, str):
                raise ValueError("Invalid text field: " + field)
            return value

        def text_list(value, field):
            if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
                raise ValueError("Invalid text list: " + field)
            return value

        summary = text(generated.get("summary", ""), "summary")

        raw_components = generated.get("components", [])
        if not isinstance(raw_components, list):
            raise ValueError("Invalid components")
        components = []
        for item in raw_components:
            if not isinstance(item, dict):
                raise ValueError("Invalid component")
            components.append({
                "name": text(item.get("name", ""), "component.name"),
                "purpose": text(item.get("purpose", ""), "component.purpose"),
            })

        raw_parts = generated.get("parts", [])
        if not isinstance(raw_parts, list):
            raise ValueError("Invalid parts")
        parts = []
        for item in raw_parts:
            if not isinstance(item, dict):
                raise ValueError("Invalid part")
            quantity = item.get("quantity", 0)
            if isinstance(quantity, bool) or not isinstance(quantity, int):
                raise ValueError("Invalid part quantity")
            parts.append({
                "name": text(item.get("name", ""), "part.name"),
                "manufacturer": text(item.get("manufacturer", ""), "part.manufacturer"),
                "model": text(item.get("model", ""), "part.model"),
                "specifications": text_list(item.get("specifications", []), "part.specifications"),
                "quantity": quantity,
                "links": text_list(item.get("links", []), "part.links"),
            })

        raw_connections = generated.get("connections", [])
        if not isinstance(raw_connections, list):
            raise ValueError("Invalid connections")
        connections = []
        for item in raw_connections:
            if not isinstance(item, dict):
                raise ValueError("Invalid connection")
            connections.append({
                "from": text(item.get("from", ""), "connection.from"),
                "to": text(item.get("to", ""), "connection.to"),
                "description": text(item.get("description", ""), "connection.description"),
            })

        power = generated.get("power", {})
        dimensions = generated.get("dimensions", {})
        if not isinstance(power, dict) or not isinstance(dimensions, dict):
            raise ValueError("Invalid power or dimensions")
        power = {field: text(power.get(field, ""), "power." + field) for field in POWER_FIELDS}
        dimensions = {field: text(dimensions.get(field, ""), "dimensions." + field) for field in DIMENSION_FIELDS}

        return {
            "summary": summary,
            "components": components,
            "parts": parts,
            "connections": connections,
            "power": power,
            "dimensions": dimensions,
        }

    @staticmethod
    def _request_openai(api_key, payload):
        request = urllib.request.Request(
            "https://api.openai.com/v1/responses",
            data=json.dumps(payload).encode("utf-8"),
            headers={"content-type": "application/json", "authorization": "Bearer " + api_key},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                return json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            raise DesignError("OpenAI design could not be generated. Check the API configuration and try again.")
