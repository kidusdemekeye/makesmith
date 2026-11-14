import unittest

from apps.api.app.checks import calculate_checks


class EngineeringCheckTests(unittest.TestCase):
    def test_calculates_power_runtime_weight_fit_and_strength_from_numeric_inputs(self):
        result = calculate_checks({"engineering": {
            "battery_capacity_mah": 2000, "supply_power_w": 5,
            "consumers": [{"name": "controller", "voltage_v": 5, "current_a": 0.2, "power_w": None}, {"name": "sensor", "voltage_v": 5, "current_a": 0.1, "power_w": None}],
            "parts": [{"name": "controller board", "quantity": 1, "mass_g": 10, "dimensions_mm": [10, 10, 3]}],
            "enclosure_mm": [20, 20, 10],
            "strength": [{"name": "support", "load_n": 10, "cross_section_mm2": 10, "allowable_stress_mpa": 3}],
        }})
        checks = {check["id"]: check for check in result["checks"]}
        self.assertEqual(checks["power_budget"]["status"], "pass")
        self.assertAlmostEqual(checks["battery_life"]["result"]["estimated_hours"], 5.3333, places=3)
        self.assertEqual(checks["total_weight"]["result"]["total_g"], 10)
        self.assertEqual(checks["fit"]["status"], "pass")
        self.assertEqual(checks["basic_strength"]["result"]["minimum_safety_factor"], 3)

    def test_returns_unknown_when_required_numeric_data_is_missing(self):
        checks = {check["id"]: check for check in calculate_checks({"engineering": {}})["checks"]}
        self.assertEqual([checks[name]["status"] for name in ["power_budget", "battery_life", "total_weight", "fit", "basic_strength"]], ["unknown"] * 5)
        self.assertTrue(all(checks[name]["assumptions"] for name in checks))

    def test_flags_parts_that_do_not_fit_and_low_strength_margin(self):
        checks = {check["id"]: check for check in calculate_checks({"engineering": {
            "parts": [{"name": "oversized part", "quantity": 1, "mass_g": 20, "dimensions_mm": [25, 5, 5]}],
            "enclosure_mm": [20, 20, 20],
            "strength": [{"name": "thin tab", "load_n": 12, "cross_section_mm2": 2, "allowable_stress_mpa": 3}],
        }})["checks"]}
        self.assertEqual(checks["fit"]["status"], "warning")
        self.assertEqual(checks["basic_strength"]["status"], "warning")

    def test_rejects_invalid_quantities_in_design_data(self):
        with self.assertRaises(ValueError):
            calculate_checks({"engineering": {"parts": [{"name": "part", "quantity": -1, "mass_g": 2, "dimensions_mm": [1, 1, 1]}]}})


if __name__ == "__main__":
    unittest.main()
