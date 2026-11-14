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
