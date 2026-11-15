import base64
import multiprocessing
import unittest
from unittest.mock import Mock, call

from apps.api.app.cad import CadError, CadService, read_worker_result, validate_cadquery_code


def matching_geometry(part, source):
    return True, ""


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
        service = CadService(compiler=lambda code, timeout_seconds: (timeouts.append(timeout_seconds) or b"STL"), verifier=matching_geometry)
        part = {"name": "Spacer", "purpose": "Test", "cadquery_code": 'import cadquery as cq\nresult = cq.Workplane("XY").box(1, 1, 1)'}
        with patch("apps.api.app.cad.MAX_DESIGN_CAD_SECONDS", 40), patch("apps.api.app.cad.MAX_CAD_COMPILE_SECONDS", 30):
            service.compile_design({"custom_parts": [part]})
        self.assertEqual(timeouts, [30])

    def test_returns_compiled_stl_as_base64_for_custom_parts(self):
        service = CadService(compiler=lambda code, **kwargs: b"STL", generator=lambda *args: "", verifier=matching_geometry)
        result = service.compile_design({"custom_parts": [{"name": "Bracket", "purpose": "Mount the board", "cadquery_code": "import cadquery as cq\nresult = cq.Workplane().box(2, 3, 4)", "dimensions": "2 x 3 x 4 mm"}]})
        self.assertEqual(result["models"][0]["name"], "Bracket")
        self.assertEqual(base64.b64decode(result["models"][0]["stl_base64"]), b"STL")
        self.assertEqual(result["assembly"], [{"name": "Bracket", "position_mm": [0, 0, 0], "rotation_deg": [0, 0, 0]}])

    def test_returns_ai_assembly_transforms_with_each_stl(self):
        service = CadService(compiler=lambda code, **kwargs: b"STL", generator=lambda *args: "", verifier=matching_geometry)
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
        service = CadService(compiler=lambda code, **kwargs: (time.sleep(0.02) or b"STL"), verifier=matching_geometry)
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
        service = CadService(compiler=compiler, generator=repair, verifier=matching_geometry)
        result = service.compile_design({"custom_parts": [{"name": "Cap", "purpose": "Cover", "cadquery_code": "import cadquery as cq\nresult = cq.Workplane().box(1, 1, 1)", "dimensions": "1 mm"}]})
        self.assertEqual(len(attempts), 3)
        self.assertEqual(base64.b64decode(result["models"][0]["stl_base64"]), b"fixed")

    def test_stops_after_three_failed_compile_attempts(self):
        attempts = []
        def compiler(code, **kwargs):
            attempts.append(code)
            raise CadError("Compile failed")
        service = CadService(compiler=compiler, generator=lambda *args: "import cadquery as cq\nresult = cq.Workplane().box(1, 1, 1)", verifier=matching_geometry)
        with self.assertRaises(CadError):
            service.compile_design({"custom_parts": [{"name": "Cap", "purpose": "Cover", "cadquery_code": "import cadquery as cq\nresult = cq.Workplane().box(1, 1, 1)", "dimensions": "1 mm"}]})
        self.assertEqual(len(attempts), 3)

    def test_repairs_geometry_mismatch_before_compiling(self):
        checks = []
        repairs = []
        compiled = []
        initial = 'import cadquery as cq\nresult = cq.Workplane("XY").box(76, 154, 11)'
        corrected = 'import cadquery as cq\nresult = cq.Workplane("XY").box(76, 154, 11).cut(cq.Workplane("XY").box(72, 150, 8).translate((0, 0, 2)))'

        def verify(part, source):
            checks.append((part, source))
            return (False, "The description requires a cavity but this shape is a solid block.") if len(checks) == 1 else (True, "")

        def repair(code, reason, name):
            repairs.append((code, reason, name))
            return corrected

        def compile_shape(code, **kwargs):
            compiled.append(code)
            return b"HOLLOW-STL"

        service = CadService(compiler=compile_shape, generator=repair, verifier=verify)
        part = {"name": "Printed case shell", "purpose": "A hollow protective enclosure", "dimensions": "76 x 154 x 11 mm", "cadquery_code": initial}
        result = service.compile_design({"custom_parts": [part]})
        self.assertEqual(len(checks), 2)
        self.assertEqual(len(repairs), 1)
        self.assertIn("hollow protective enclosure", repairs[0][1])
        self.assertEqual(compiled, [corrected])
        self.assertEqual(base64.b64decode(result["models"][0]["stl_base64"]), b"HOLLOW-STL")

    def test_three_description_mismatches_fail_without_returning_an_stl(self):
        verify = Mock(return_value=(False, "This is a solid block, not the requested hollow part."))
        repair = Mock(return_value='import cadquery as cq\nresult = cq.Workplane("XY").box(76, 154, 11)')
        compiler = Mock(return_value=b"MISLEADING-STL")
        service = CadService(compiler=compiler, generator=repair, verifier=verify)
        part = {"name": "Printed case shell", "purpose": "A hollow protective enclosure", "cadquery_code": 'import cadquery as cq\nresult = cq.Workplane("XY").box(76, 154, 11)'}
        with self.assertRaises(CadError):
            service.compile_design({"custom_parts": [part]})
        self.assertEqual(verify.call_count, 3)
        self.assertEqual(repair.call_count, 2)
        compiler.assert_not_called()

    def test_verification_errors_fail_closed_before_compilation(self):
        compiler = Mock(return_value=b"UNVERIFIED-STL")
        def unavailable(part, source):
            raise CadError("OpenAI could not verify this part. No STL was generated.", status_code=502)
        service = CadService(compiler=compiler, verifier=unavailable)
        part = {"name": "Bracket", "purpose": "Mount a board", "cadquery_code": 'import cadquery as cq\nresult = cq.Workplane().box(2, 3, 4)'}
        with self.assertRaises(CadError) as error:
            service.compile_design({"custom_parts": [part]})
        self.assertEqual(error.exception.status_code, 502)
        compiler.assert_not_called()

    def test_openai_geometry_review_receives_the_part_description_and_source(self):
        service = CadService(api_key="test-key", small_model="gpt-6-luna")
        service._request_openai = Mock(return_value={"output": [{"type": "message", "content": [{"type": "output_text", "text": '{"matches_description": false, "issue": "The box has no cavity."}'}]}]})
        part = {"name": "Printed case shell", "purpose": "A hollow protective enclosure", "dimensions": "76 x 154 x 11 mm"}
        source = 'import cadquery as cq\nresult = cq.Workplane("XY").box(76, 154, 11)'
        self.assertEqual(service._verify_with_openai(part, source), (False, "The box has no cavity."))
        payload = service._request_openai.call_args.args[1]
        self.assertEqual(payload["model"], "gpt-6-luna")
        self.assertTrue(payload["text"]["format"]["strict"])
        self.assertIn("hollow protective enclosure", payload["input"])
        self.assertIn(".box(76, 154, 11)", payload["input"])

    def test_caches_geometry_reviews_for_the_same_part_and_source(self):
        service = CadService(api_key="test-key")
        service._request_openai = Mock(return_value={"output": [{"type": "message", "content": [{"type": "output_text", "text": '{"matches_description": false, "issue": "The box has no cavity."}'}]}]})
        part = {"name": "Printed case shell", "purpose": "A hollow protective enclosure", "dimensions": "76 x 154 x 11 mm"}
        source = 'import cadquery as cq\nresult = cq.Workplane("XY").box(76, 154, 11)'
        self.assertEqual(service._verify_with_openai(part, source), (False, "The box has no cavity."))
        self.assertEqual(service._verify_with_openai(part, source), (False, "The box has no cavity."))
        self.assertEqual(service._request_openai.call_count, 1)


if __name__ == "__main__":
    unittest.main()
