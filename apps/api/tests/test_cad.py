import base64
import multiprocessing
import unittest
from unittest.mock import Mock, call

from apps.api.app.cad import CadError, CadService, read_worker_result, validate_cadquery_code


def _send_large_worker_result(connection, payload):
    connection.send((True, payload))
    connection.close()


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

    def test_rejects_excessive_geometry_operation_count(self):
        chain = 'cq.Workplane("XY")' + ".translate((1, 0, 0))" * 60
        with self.assertRaises(CadError):
            validate_cadquery_code("import cadquery as cq\nresult = " + chain)

    def test_worker_has_a_hard_address_space_limit(self):
        from apps.api.app.cad import configure_worker_limits, MAX_WORKER_MEMORY_BYTES, MAX_WORKER_DATA_BYTES
        resource = Mock(RLIMIT_CPU=1, RLIMIT_FSIZE=2, RLIMIT_NOFILE=3, RLIMIT_AS=4, RLIMIT_DATA=5)
        configure_worker_limits(resource, platform="linux")
        calls = resource.setrlimit.call_args_list
        self.assertIn(call(4, (MAX_WORKER_MEMORY_BYTES, MAX_WORKER_MEMORY_BYTES)), calls)
        self.assertIn(call(5, (MAX_WORKER_DATA_BYTES, MAX_WORKER_DATA_BYTES)), calls)


class CadWorkerTransferTests(unittest.TestCase):
    def test_parent_drains_large_result_before_joining_child(self):
        context = multiprocessing.get_context("spawn")
        parent, child = context.Pipe(duplex=False)
        payload = b"x" * 200_000
        process = context.Process(target=_send_large_worker_result, args=(child, payload), daemon=True)
        process.start()
        child.close()
        ok, received = read_worker_result(parent, process, timeout_seconds=5)
        self.assertTrue(ok)
        self.assertEqual(received, payload)
        self.assertFalse(process.is_alive())


class CadServiceTests(unittest.TestCase):
    def test_gives_worker_a_longer_bounded_compile_window(self):
        from unittest.mock import patch
        timeouts = []
        service = CadService(compiler=lambda code, timeout_seconds: (timeouts.append(timeout_seconds) or b"STL"))
        part = {"name": "Spacer", "purpose": "Test", "cadquery_code": 'import cadquery as cq\nresult = cq.Workplane("XY").box(1, 1, 1)'}
        with patch("apps.api.app.cad.MAX_DESIGN_CAD_SECONDS", 40), patch("apps.api.app.cad.MAX_CAD_COMPILE_SECONDS", 30):
            service.compile_design({"custom_parts": [part]})
        self.assertEqual(timeouts, [30])

    def test_returns_compiled_stl_as_base64_for_custom_parts(self):
        service = CadService(compiler=lambda code, **kwargs: b"STL", generator=lambda *args: "")
        result = service.compile_design({"custom_parts": [{"name": "Bracket", "purpose": "Mount the board", "cadquery_code": "import cadquery as cq\nresult = cq.Workplane().box(2, 3, 4)", "dimensions": "2 x 3 x 4 mm"}]})
        self.assertEqual(result["models"][0]["name"], "Bracket")
        self.assertEqual(base64.b64decode(result["models"][0]["stl_base64"]), b"STL")
        self.assertEqual(result["assembly"], [{"name": "Bracket", "position_mm": [0, 0, 0], "rotation_deg": [0, 0, 0]}])

    def test_returns_ai_assembly_transforms_with_each_stl(self):
        service = CadService(compiler=lambda code, **kwargs: b"STL", generator=lambda *args: "")
        parts = [
            {"name": "Base", "purpose": "Support", "cadquery_code": "import cadquery as cq\nresult = cq.Workplane().box(2, 3, 4)", "position_mm": [0, 0, 0], "rotation_deg": [0, 0, 0]},
            {"name": "Arm", "purpose": "Move", "cadquery_code": "import cadquery as cq\nresult = cq.Workplane().box(1, 1, 5)", "position_mm": [10, 0, 2], "rotation_deg": [0, 90, 0]},
        ]
        result = service.compile_design({"custom_parts": parts})
        self.assertEqual(result["models"][1]["position_mm"], [10.0, 0.0, 2.0])
        self.assertEqual(result["models"][1]["rotation_deg"], [0.0, 90.0, 0.0])
        self.assertEqual(result["assembly"][1]["name"], "Arm")

    def test_rejects_another_design_when_cad_workers_are_saturated(self):
        from unittest.mock import patch
        service = CadService(compiler=lambda code, **kwargs: b"STL")
        with patch("apps.api.app.cad._CAD_REQUEST_SLOTS") as slots:
            slots.acquire.return_value = False
            with self.assertRaises(CadError) as error:
                service.compile_design({"custom_parts": []})
        self.assertEqual(error.exception.status_code, 429)

    def test_enforces_one_total_time_budget_for_all_custom_parts(self):
        from unittest.mock import patch
        import time
        service = CadService(compiler=lambda code, **kwargs: (time.sleep(0.02) or b"STL"))
        part = {"name": "Part", "purpose": "Test", "cadquery_code": "import cadquery as cq\nresult = cq.Workplane().box(1, 1, 1)"}
        with patch("apps.api.app.cad.MAX_DESIGN_CAD_SECONDS", 0.01):
            with self.assertRaises(CadError):
                service.compile_design({"custom_parts": [part, {**part, "name": "Second"}]})

    def test_repairs_compile_failure_at_most_three_attempts(self):
        attempts = []
        def compiler(code, **kwargs):
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
        def compiler(code, **kwargs):
            attempts.append(code)
            raise CadError("Compile failed")
        service = CadService(compiler=compiler, generator=lambda *args: "import cadquery as cq\nresult = cq.Workplane().box(1, 1, 1)")
        with self.assertRaises(CadError):
            service.compile_design({"custom_parts": [{"name": "Cap", "purpose": "Cover", "cadquery_code": "import cadquery as cq\nresult = cq.Workplane().box(1, 1, 1)", "dimensions": "1 mm"}]})
        self.assertEqual(len(attempts), 3)


if __name__ == "__main__":
    unittest.main()
