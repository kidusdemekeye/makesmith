"""Deterministic cross-idea fixtures for the phase-five workflow contract."""
import json
import unittest

from apps.api.app.design import DesignService
from apps.api.app.intake import IntakeService


class HardwareIdeaAcceptanceTests(unittest.TestCase):
    def test_design_contract_accepts_distinct_hardware_ideas_without_category_routing(self):
        ideas = [
            "Build a small drone for indoor aerial photography",
            "Build comfortable wired headphones for listening to music",
            "Build a home blood pressure monitor enclosure and sensor plan",
            "Build a tabletop robotic arm that sorts lightweight objects",
        ]

        def deterministic_design(_key, payload):
            request = json.loads(payload["input"].split("\n", 1)[1])
            idea = request["idea"]
            generated = {
                "summary": "A first-pass concept for the requested hardware.",
                "components": [{"name": "Core assembly", "purpose": "Implements the requested function."}],
                "parts": [{"name": "Candidate component", "manufacturer": "Example supplier", "model": "Example-1", "specifications": ["Verify compatibility"], "quantity": 1, "links": [], "source_urls": ["https://example.test/datasheet"]}],
                "connections": [],
                "power": {"source": "", "voltage": "", "current": "", "capacity": "", "estimated_runtime": ""},
                "dimensions": {"width": "", "height": "", "depth": "", "units": ""},
                "research": [{"title": "Datasheet", "url": "https://example.test/datasheet", "snippet": "Example test citation."}],
                "custom_parts": [], "manual": [], "assumptions": [],
                "engineering": {"battery_capacity_mah": None, "supply_power_w": None, "consumers": [], "parts": [], "enclosure_mm": None, "strength": []},
                "simulation": {"model_xml": "", "test_name": "", "test_description": "", "success_condition": "finite_state", "duration_seconds": 1, "velocity_threshold": 0.1},
            }
            text = json.dumps(generated)
            return {"output": [{"type": "message", "content": [{"type": "output_text", "text": text, "annotations": [{"type": "url_citation", "url": "https://example.test/datasheet", "title": "Datasheet"}]}]}]}

        service = DesignService(api_key="test-key", transport=deterministic_design)
        for idea in ideas:
            with self.subTest(idea=idea):
                design = service.design(idea)
                self.assertEqual(design["idea"], idea)
                self.assertEqual(design["parts"][0]["name"], "Candidate component")
                self.assertEqual(design["research"][0]["url"], "https://example.test/datasheet")
                self.assertEqual(design["simulation"]["model_xml"], "")

    def test_impossible_pool_on_sun_returns_explanation_and_pickable_alternatives(self):
        def impossible_check(_key, _payload):
            value = {
                "feasibility": "impossible",
                "explanation": "Liquid water and pool materials cannot remain intact at the Sun's surface conditions.",
                "alternatives": ["Build a solar-thermal pool heater on Earth", "Make a pool-shaped light sculpture"],
            }
            return {"output": [{"type": "message", "content": [{"type": "output_text", "text": json.dumps(value)}]}]}

        result = IntakeService(api_key="test-key", transport=impossible_check).intake("Build a swimming pool on the Sun")
        self.assertEqual(result["feasibility"], "impossible")
        self.assertIn("Liquid water", result["explanation"])
        self.assertEqual(len(result["alternatives"]), 2)
        self.assertTrue(all(question["default"] and question["skip_allowed"] for question in result["questions"]))


if __name__ == "__main__":
    unittest.main()
