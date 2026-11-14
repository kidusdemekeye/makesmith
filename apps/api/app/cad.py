"""Bounded CadQuery validation and STL generation for custom design parts."""

import ast
import base64
import json
import math
import multiprocessing
import os
import tempfile
import urllib.error
import urllib.request

MAX_CODE_CHARS = 12000
MAX_CUSTOM_PARTS = 12
ALLOWED_METHODS = {"Workplane", "box", "cylinder", "sphere", "workplane", "faces", "edges", "vertices", "fillet", "chamfer", "hole", "cutBlind", "extrude", "translate", "rotate", "union", "cut", "intersect"}
REPAIR_SCHEMA = {"type": "object", "properties": {"cadquery_code": {"type": "string"}}, "required": ["cadquery_code"], "additionalProperties": False}


class CadError(Exception):
    def __init__(self, message, status_code=422):
        super().__init__(message)
        self.status_code = status_code


def validate_cadquery_code(source):
    if not isinstance(source, str) or not source.strip() or len(source) > MAX_CODE_CHARS:
        raise CadError("Custom part code must contain 1–12,000 characters.")
    try:
        module = ast.parse(source)
    except SyntaxError:
        raise CadError("CadQuery code has a syntax error.")
    if len(module.body) != 2:
        raise CadError("Use one CadQuery import and one result assignment only.")
    imported, assignment = module.body
    if not isinstance(imported, ast.Import) or len(imported.names) != 1 or imported.names[0].name != "cadquery" or imported.names[0].asname != "cq":
        raise CadError("Only `import cadquery as cq` is permitted.")
    if not isinstance(assignment, ast.Assign) or len(assignment.targets) != 1 or not isinstance(assignment.targets[0], ast.Name) or assignment.targets[0].id != "result":
        raise CadError("Assign one CadQuery shape to `result`.")
    _validate_expression(assignment.value)
    if not isinstance(assignment.value, ast.Call) or not isinstance(assignment.value.func, ast.Attribute) or assignment.value.func.attr not in ALLOWED_METHODS:
        raise CadError("Build the custom shape with supported CadQuery workplane operations.")


def _validate_expression(node):
    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)) and (not math.isfinite(node.value) or abs(node.value) > 5000):
            raise CadError("Numeric CAD values must be finite and no larger than 5,000 mm or degrees.")
        if isinstance(node.value, str) and len(node.value) > 100:
            raise CadError("CAD text values are limited to 100 characters.")
        if not isinstance(node.value, (int, float, str, bool, type(None))):
            raise CadError("Only simple literal CadQuery arguments are permitted.")
        return
    if isinstance(node, (ast.Tuple, ast.List)):
        for value in node.elts:
            _validate_expression(value)
        return
    if isinstance(node, ast.Name):
        if node.id not in {"cq", "result"}:
            raise CadError("CadQuery code references an unsupported name.")
        return
    if isinstance(node, ast.Attribute):
        if node.attr not in ALLOWED_METHODS:
            raise CadError("CadQuery operation is not permitted: " + node.attr)
        _validate_expression(node.value)
        return
    if isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Attribute) or node.func.attr not in ALLOWED_METHODS:
            raise CadError("CadQuery operation is not permitted.")
        _validate_expression(node.func.value)
        for argument in node.args:
            _validate_expression(argument)
        for keyword in node.keywords:
            if keyword.arg is None or keyword.arg.startswith("__"):
                raise CadError("Dynamic CadQuery arguments are not permitted.")
            _validate_expression(keyword.value)
        return
    raise CadError("CadQuery code contains unsupported Python syntax.")


def _literal(node):
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.Tuple):
        return tuple(_literal(value) for value in node.elts)
    if isinstance(node, ast.List):
        return [_literal(value) for value in node.elts]
    raise CadError("Unsupported CadQuery argument.")


def _evaluate(node, cq, current=None):
    if isinstance(node, ast.Call):
        args = [_literal(value) if isinstance(value, (ast.Constant, ast.Tuple, ast.List)) else _evaluate(value, cq, current) for value in node.args]
        kwargs = {value.arg: _literal(value.value) for value in node.keywords}
        if isinstance(node.func.value, ast.Name) and node.func.value.id == "cq" and node.func.attr == "Workplane":
            return cq.Workplane(*args, **kwargs)
        receiver = _evaluate(node.func.value, cq, current)
        return getattr(receiver, node.func.attr)(*args, **kwargs)
    if isinstance(node, ast.Name) and node.id == "result":
        return current
    raise CadError("Unsupported CadQuery expression.")


def _cad_worker(connection, source):
    try:
        import resource
        import cadquery as cq
        resource.setrlimit(resource.RLIMIT_CPU, (10, 10))
        resource.setrlimit(resource.RLIMIT_FSIZE, (4_000_000, 4_000_000))
        resource.setrlimit(resource.RLIMIT_NOFILE, (128, 128))
        module = ast.parse(source)
        result = _evaluate(module.body[1].value, cq)
        with tempfile.NamedTemporaryFile(suffix=".stl") as output:
            result.export(output.name, tolerance=0.2, angularTolerance=0.1)
            output.seek(0)
            data = output.read(4_000_001)
        if not data or len(data) > 4_000_000:
            raise CadError("Generated STL is empty or exceeds 4 MB.")
        connection.send((True, data))
    except Exception as error:
        connection.send((False, str(error)[:500]))
    finally:
        connection.close()


def compile_cadquery_stl(source, timeout_seconds=15):
    validate_cadquery_code(source)
    parent, child = multiprocessing.get_context("spawn").Pipe(duplex=False)
    process = multiprocessing.get_context("spawn").Process(target=_cad_worker, args=(child, source), daemon=True)
    process.start()
    child.close()
    process.join(timeout_seconds)
    if process.is_alive():
        process.kill()
        process.join()
        parent.close()
        raise CadError("CadQuery compilation exceeded the 15 second time limit.", status_code=422)
    if not parent.poll():
        parent.close()
        raise CadError("CadQuery could not compile the custom part. Check that CadQuery is installed.", status_code=503)
    ok, result = parent.recv()
    parent.close()
    if not ok:
        message = "CadQuery could not compile the custom part. Check the shape and dimensions."
        if "No module named 'cadquery'" in result:
            raise CadError("3D compilation is not installed on this API service yet.", status_code=503)
        raise CadError(message)
    return result


class CadService:
    def __init__(self, api_key=None, small_model=None, generator=None, compiler=None):
        self.api_key = api_key if api_key is not None else os.getenv("OPENAI_API_KEY")
        self.small_model = small_model or os.getenv("OPENAI_SMALL_MODEL", "gpt-6-luna")
        self.can_repair = generator is not None or bool(self.api_key)
        self.generator = generator or self._repair_with_openai
        self.compiler = compiler or compile_cadquery_stl

    def compile_design(self, design):
        if not isinstance(design, dict) or not isinstance(design.get("custom_parts", []), list):
            raise CadError("The design does not contain valid custom parts.")
        parts = design.get("custom_parts", [])
        if len(parts) > MAX_CUSTOM_PARTS:
            raise CadError("A design can contain at most 12 custom parts.")
        models = []
        for part in parts:
            if not isinstance(part, dict) or not isinstance(part.get("name"), str) or not isinstance(part.get("cadquery_code"), str):
                raise CadError("A custom part is missing its name or CadQuery code.")
            code = part["cadquery_code"]
            failure = None
            for attempt in range(3):
                try:
                    validate_cadquery_code(code)
                    stl = self.compiler(code)
                    if not isinstance(stl, bytes) or not stl:
                        raise CadError("CadQuery returned an empty STL.")
                    models.append({"name": part["name"], "purpose": part.get("purpose", ""), "dimensions": part.get("dimensions", ""), "stl_base64": base64.b64encode(stl).decode("ascii")})
                    failure = None
                    break
                except CadError as error:
                    failure = error
                    if attempt == 2 or not self.can_repair:
                        break
                    code = self.generator(code, str(error), part["name"])
            if failure:
                raise failure
        return {"models": models, "assembly": [model["name"] for model in models]}

    def _repair_with_openai(self, code, error, name):
        if not self.api_key:
            return code
        payload = {
            "model": self.small_model, "store": False,
            "instructions": "Fix this simple CadQuery shape so it compiles. Use exactly `import cadquery as cq` and a single `result = cq.Workplane(...).box(...)` style assignment. Use only safe parametric geometry, no other imports or Python logic. Return corrected code only.",
            "input": json.dumps({"part": name, "code": code, "compile_error": error}),
            "text": {"format": {"type": "json_schema", "name": "makesmith_cad_repair", "strict": True, "schema": REPAIR_SCHEMA}},
        }
        try:
            response = self._request_openai(self.api_key, payload)
            for item in response.get("output", []):
                if item.get("type") != "message":
                    continue
                for content in item.get("content", []):
                    if content.get("type") == "output_text":
                        result = json.loads(content.get("text", "{}"))
                        return result.get("cadquery_code", code)
        except Exception:
            pass
        return code

    @staticmethod
    def _request_openai(api_key, payload):
        request = urllib.request.Request("https://api.openai.com/v1/responses", data=json.dumps(payload).encode("utf-8"), headers={"content-type": "application/json", "authorization": "Bearer " + api_key}, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            return {"output": []}
