import unittest
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError

from apps.api.app import main
from apps.api.app.design import DesignError


class ApiRouteTests(unittest.TestCase):
    def test_health_route_reports_ok(self):
        self.assertEqual(main.health(), {"status": "ok"})
        self.assertIn(("GET", "/health"), {(method, route.path) for route in main.app.routes for method in (getattr(route, "methods", None) or set())})

    def test_design_route_returns_design_and_cache_status(self):
        with patch.object(main.service, "design_with_status", return_value=({"idea": "Build a monitor"}, True)):
            self.assertEqual(
                main.create_design(main.DesignRequest(idea="Build a monitor")),
                {"design": {"idea": "Build a monitor"}, "cached": True},
            )

    def test_design_route_maps_provider_error_to_http_error(self):
        with patch.object(main.service, "design_with_status", side_effect=DesignError("OpenAI unavailable")):
            with self.assertRaises(HTTPException) as error:
                main.create_design(main.DesignRequest(idea="Build a monitor"))
        self.assertEqual(error.exception.status_code, 502)
        self.assertEqual(error.exception.detail, "OpenAI unavailable")

    def test_design_request_rejects_empty_or_oversized_input(self):
        with self.assertRaises(ValidationError):
            main.DesignRequest(idea="")
        with self.assertRaises(ValidationError):
            main.DesignRequest(idea="x" * 5001)

    def test_intake_endpoint_returns_questions_and_feasibility(self):
        expected = {"feasibility": "feasible", "explanation": "Workable", "alternatives": [], "questions": []}
        with patch.object(main.intake_service, "intake", return_value=expected):
            self.assertEqual(main.create_intake(main.IntakeRequest(idea="Build a monitor")), expected)

    def test_intake_endpoint_rejects_blank_idea(self):
        with self.assertRaises(ValidationError):
            main.IntakeRequest(idea=" ")


if __name__ == "__main__":
    unittest.main()
