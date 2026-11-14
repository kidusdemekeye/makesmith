import json
import unittest
from unittest.mock import Mock

from apps.api.app.design import DesignService, DesignError


class DesignServiceTests(unittest.TestCase):
    def setUp(self):
        self.transport = Mock()
        self.service = DesignService(api_key="test-key", model="gpt-6-astra", transport=self.transport)
        self.transport.return_value = {
            "output": [{"type": "message", "content": [{"type": "output_text", "text": json.dumps({"summary": "A small monitor"})}]}],
        }

    def test_rejects_blank_and_oversized_ideas(self):
        with self.assertRaises(DesignError):
            self.service.design("  ")
        with self.assertRaises(DesignError):
            self.service.design("x" * 5001)

    def test_normalizes_missing_design_fields(self):
        result = self.service.design("Build a monitor")
        self.assertEqual(result["idea"], "Build a monitor")
        self.assertEqual(result["summary"], "A small monitor")
        self.assertEqual(result["components"], [])
        self.assertEqual(result["parts"], [])
        self.assertEqual(result["connections"], [])
        self.assertEqual(result["power"], {"source": "", "voltage": "", "current": "", "capacity": "", "estimated_runtime": ""})
        self.assertEqual(result["dimensions"], {"width": "", "height": "", "depth": "", "units": ""})
        json.dumps(result)

    def test_rejects_wrongly_typed_output_without_caching(self):
        invalid_designs = [
            {"components": None},
            {"summary": {"text": "wrong type"}},
            {"components": [{"name": 4, "purpose": "invalid name"}]},
            {"parts": [{"name": "Sensor", "manufacturer": "Acme", "model": "M1", "specifications": [], "quantity": "one", "links": []}]},
            {"connections": [{"from": "sensor", "to": None, "description": "bad endpoint"}]},
            {"power": []},
            {"dimensions": {"width": 10}},
        ]
        for index, invalid in enumerate(invalid_designs):
            with self.subTest(invalid=invalid):
                generated = {"summary": "A monitor", "components": [], "parts": [], "connections": [], "power": {}, "dimensions": {}}
                generated.update(invalid)
                idea = "Build a monitor " + str(index)
                self.transport.return_value = {
                    "output": [{"type": "message", "content": [{"type": "output_text", "text": json.dumps(generated)}]}],
                }
                with self.assertRaises(DesignError):
                    self.service.design(idea)
                self.assertNotIn(idea, self.service.cache)

    def test_uses_openai_responses_with_strict_structured_output(self):
        self.service.design("Build a monitor")
        payload = self.transport.call_args.args[1]
        self.assertEqual(payload["model"], "gpt-6-astra")
        self.assertIn("input", payload)
        self.assertEqual(payload["text"]["format"]["type"], "json_schema")
        self.assertTrue(payload["text"]["format"]["strict"])

    def test_researches_with_openai_web_search_before_structured_design(self):
        self.service.design("Build a monitor")
        payload = self.transport.call_args.args[1]
        self.assertEqual(payload["tools"], [{"type": "web_search"}])
        self.assertEqual(payload["tool_choice"], "required")

    def test_prompts_for_cadquery_code_with_the_compilers_restricted_shape_grammar(self):
        self.service.design("Build a monitor")
        prompt = self.transport.call_args.args[1]["instructions"]
        self.assertIn("exactly two Python statements", prompt)
        self.assertIn("cq.Workplane", prompt)
        self.assertIn("literal numeric or short string arguments only", prompt)

    def test_includes_only_cited_http_sources_and_build_artifacts(self):
        generated = {
            "summary": "A compact monitor", "components": [],
            "parts": [{"name": "Sensor", "manufacturer": "Acme", "model": "M1", "specifications": ["3.3 V"], "quantity": 1, "links": ["javascript:alert(1)"], "source_urls": ["https://datasheets.example/sensor", "javascript:alert(1)"]}],
            "connections": [], "power": {}, "dimensions": {},
            "research": [{"title": "Sensor data sheet", "url": "https://datasheets.example/sensor", "snippet": "3.3 V"}, {"title": "Fake", "url": "javascript:alert(1)", "snippet": "fake"}],
            "custom_parts": [], "manual": [], "assumptions": ["Runtime is estimated"],
        }
        citation = {"type": "url_citation", "url": "https://datasheets.example/sensor", "title": "Sensor data sheet"}
        self.transport.return_value = {"output": [{"type": "message", "content": [{"type": "output_text", "text": json.dumps(generated), "annotations": [citation]}]}]}
        result = self.service.design("Build a monitor")
        self.assertEqual(result["research"], [{"title": "Sensor data sheet", "url": "https://datasheets.example/sensor", "snippet": "3.3 V"}])
        self.assertEqual(result["parts"][0]["source_urls"], ["https://datasheets.example/sensor"])
        self.assertTrue(result["parts"][0]["search_url"].startswith("https://www.google.com/search?q="))
        self.assertEqual(result["manual"], [])

    def test_answers_are_sent_to_ai_and_partition_the_cache(self):
        self.service.design_with_status("Build a monitor", {"budget": "Under $50", "size": "Handheld"})
        self.assertIn("Under $50", self.transport.call_args.args[1]["input"])
        self.service.design_with_status("Build a monitor", {"budget": "Flexible"})
        self.assertEqual(self.transport.call_count, 2)

    def test_configures_a_cheaper_model_for_small_tasks(self):
        service = DesignService(api_key="test-key", transport=self.transport)
        self.assertEqual(service.small_model, "gpt-6-luna")

    def test_caches_identical_ideas_without_second_upstream_call(self):
        first = self.service.design("Build a monitor")
        second = self.service.design("Build a monitor")
        self.assertEqual(first, second)
        self.assertEqual(self.transport.call_count, 1)

    def test_requires_openai_api_key_without_exposing_it(self):
        service = DesignService(api_key=None, transport=self.transport)
        with self.assertRaises(DesignError) as error:
            service.design("Build a monitor")
        self.assertIn("OPENAI_API_KEY", str(error.exception))
        self.assertEqual(self.transport.call_count, 0)

    def test_does_not_cache_malformed_openai_output(self):
        self.transport.return_value = {"output": [{"type": "message", "content": [{"type": "output_text", "text": "not json"}]}]}
        with self.assertRaises(DesignError):
            self.service.design("Build a monitor")
        with self.assertRaises(DesignError):
            self.service.design("Build a monitor")
        self.assertEqual(self.transport.call_count, 2)


if __name__ == "__main__":
    unittest.main()
