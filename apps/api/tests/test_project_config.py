import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


class ProjectConfigTests(unittest.TestCase):
    def test_readme_records_start_time_and_local_run_commands(self):
        readme = (ROOT / "README.md").read_text()
        self.assertIn("2026-11-14 04:51 CST", readme)
        self.assertIn("Phase 1 status:", readme)
        self.assertIn("pending completion of Phases 1–5", readme)
        self.assertIn("npm run dev", readme)
        self.assertIn("uvicorn --env-file .env app.main:app", readme)
        self.assertIn("OPENAI_API_KEY", readme)

    def test_environment_templates_keep_secret_values_empty(self):
        api_env = (ROOT / "apps/api/.env.example").read_text()
        web_env = (ROOT / "apps/web/.env.example").read_text()
        self.assertIn("OPENAI_API_KEY=", api_env)
        self.assertIn("OPENAI_DESIGN_MODEL=gpt-6-astra", api_env)
        self.assertIn("OPENAI_SMALL_MODEL=gpt-6-luna", api_env)
        self.assertIn("NEXT_PUBLIC_API_URL=http://localhost:8000", web_env)

    def test_deployment_files_target_the_two_apps(self):
        render = (ROOT / "apps/api/render.yaml").read_text()
        docker = (ROOT / "apps/api/Dockerfile").read_text()
        vercel = (ROOT / "apps/web/vercel.json").read_text()
        self.assertIn("apps/api/Dockerfile", render)
        self.assertIn("/health", render)
        self.assertIn("uvicorn app.main:app", docker)
        self.assertIn('"framework": "nextjs"', vercel)

    def test_gitignore_excludes_local_keys_builds_and_toolchains(self):
        gitignore = (ROOT / ".gitignore").read_text()
        for entry in (".env", ".venv/", ".tools/", "node_modules/", ".next/", "__pycache__/"):
            self.assertIn(entry, gitignore)

    def test_updated_provider_and_research_plan_remain_documented(self):
        readme = (ROOT / "README.md").read_text()
        self.assertIn("OpenAI's built-in web search", readme)
        self.assertNotIn("Anthropic", readme)
        self.assertNotIn("$20", readme)


if __name__ == "__main__":
    unittest.main()
