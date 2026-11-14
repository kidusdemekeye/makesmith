import base64
import unittest

from apps.api.app.cad import CadError, CadService, validate_cadquery_code


class CadValidationTests(unittest.TestCase):
    def test_allows_simple_parametric_cadquery_shape(self):
        validate_cadquery_code('import cadquery as cq\nresult = cq.Workplane("XY").box(20, 10, 2)')

    def test_rejects_imports_and_python_execution(self):
        for code in [
            'import os\nresult = cq.Workplane().box(1, 1, 1)',
            'import cadquery as cq\n__import__("os").system("id")',
            'import cadquery as cq\nresult = cq.Workplane().box(1, 1, 1)\nprint("bad")',
            'import cadquery as cq\nresult = cq.Workplane().unknown(1)',
        ]:
            with self.subTest(code=code), self.assertRaises(CadError):
                validate_cadquery_code(code)

    def test_rejects_code_over_12000_characters(self):
        with self.assertRaises(CadError):
            validate_cadquery_code("x" * 12001)


class CadServiceTests(unittest.TestCase):
    def test_returns_compiled_stl_as_base64_for_custom_parts(self):
        service = CadService(compiler=lambda code: b"STL", generator=lambda *args: "")
        result = service.compile_design({"custom_parts": [{"name": "Bracket", "purpose": "Mount the board", "cadquery_code": "import cadquery as cq\nresult = cq.Workplane().box(2, 3, 4)", "dimensions": "2 x 3 x 4 mm"}]})
        self.assertEqual(result["models"][0]["name"], "Bracket")
        self.assertEqual(base64.b64decode(result["models"][0]["stl_base64"]), b"STL")
        self.assertEqual(result["assembly"], ["Bracket"])

    def test_repairs_compile_failure_at_most_three_attempts(self):
        attempts = []
        def compiler(code):
            attempts.append(code)
            if len(attempts) < 3:
                raise CadError("CadQuery could not compile the shape.")
            return b"fixed"
        def repair(code, error, name):
            return 'import cadquery as cq\nresult = cq.Workplane().box(1, 1, 1)'
        service = CadService(compiler=compiler, generator=repair)
        result = service.compile_design({"custom_parts": [{"name": "Cap", "purpose": "Cover", "cadquery_code": "import cadquery as cq\nresult = cq.Workplane().box(1, 1, 1)", "dimensions": "1 mm"}]})
        self.assertEqual(len(attempts), 3)
        self.assertEqual(base64.b64decode(result["models"][0]["stl_base64"]), b"fixed")

    def test_stops_after_three_failed_compile_attempts(self):
        attempts = []
        def compiler(code):
            attempts.append(code)
            raise CadError("Compile failed")
        service = CadService(compiler=compiler, generator=lambda *args: "import cadquery as cq\nresult = cq.Workplane().box(1, 1, 1)")
        with self.assertRaises(CadError):
            service.compile_design({"custom_parts": [{"name": "Cap", "purpose": "Cover", "cadquery_code": "import cadquery as cq\nresult = cq.Workplane().box(1, 1, 1)", "dimensions": "1 mm"}]})
        self.assertEqual(len(attempts), 3)


if __name__ == "__main__":
    unittest.main()
