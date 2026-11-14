import json
import unittest
from unittest.mock import Mock

from apps.api.app.intake import IntakeError, IntakeService


class IntakeServiceTests(unittest.TestCase):
    def setUp(self):
        self.transport = Mock(return_value={"output": [{"type": "message", "content": [{
            "type": "output_text",
            "text": json.dumps({"feasibility": "feasible", "explanation": "A workable concept.", "alternatives": []}),
        }]}]})
        self.service = IntakeService(api_key="test-key", transport=self.transport)

    def test_returns_four_skippable_questions_with_defaults(self):
        result = self.service.intake("A small indoor planter")
        self.assertEqual([question["id"] for question in result["questions"]], ["budget", "size", "purpose", "skill_level"])
        self.assertTrue(all(question["default"] and question["skip_allowed"] for question in result["questions"]))

    def test_impossible_idea_returns_two_or_three_realistic_alternatives(self):
        self.transport.return_value = {"output": [{"type": "message", "content": [{"type": "output_text", "text": json.dumps({
            "feasibility": "impossible",
            "explanation": "A pool cannot be placed on the Sun because water cannot remain liquid at its surface.",
            "alternatives": ["Build a solar-thermal pool heater", "Create a pool-shaped light sculpture on a Sun-facing platform"],
        })}]}]}
        result = self.service.intake("Build a swimming pool on the Sun")
        self.assertEqual(result["feasibility"], "impossible")
        self.assertEqual(len(result["alternatives"]), 2)

    def test_unsafe_idea_is_blocked_without_alternatives(self):
        self.transport.return_value = {"output": [{"type": "message", "content": [{"type": "output_text", "text": json.dumps({
            "feasibility": "unsafe", "explanation": "I can help plan a benign device instead.", "alternatives": [],
        })}]}]}
        self.assertEqual(self.service.intake("Create a weapon" )["feasibility"], "unsafe")

    def test_rejects_invalid_model_output_without_caching(self):
        self.transport.return_value = {"output": [{"type": "message", "content": [{"type": "output_text", "text": "not json"}]}]}
        with self.assertRaises(IntakeError):
            self.service.intake("Build a planter")
        self.assertEqual(self.service.cache, {})

    def test_rejects_blank_and_oversized_ideas(self):
        with self.assertRaises(IntakeError) as error:
            self.service.intake(" ")
        self.assertEqual(error.exception.status_code, 422)
        with self.assertRaises(IntakeError):
            self.service.intake("x" * 5001)

    def test_reuses_cached_intake_for_same_idea(self):
        first = self.service.intake("A small indoor planter")
        second = self.service.intake(" A small indoor planter ")
        self.assertEqual(first, second)
        self.assertEqual(self.transport.call_count, 1)


if __name__ == "__main__":
    unittest.main()
