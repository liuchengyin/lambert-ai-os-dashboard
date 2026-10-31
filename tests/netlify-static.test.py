import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
def load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / file)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module
builder = load("mirror_build", "scripts/build-netlify-static.py")
auditor = load("mirror_audit", "scripts/audit-netlify-assets.py")

class MirrorTests(unittest.TestCase):
    def test_public_output_and_server_isolation(self):
        output = ROOT / "netlify-dist"
        self.assertEqual(auditor.audit(output)["missing"], [])
        for path in ["lib/link-recovery.js", "vendor/pdfjs/pdf.mjs", "vendor/pdfjs/pdf.worker.mjs", "mobile/update-notes.json", "brand/logo-mark.svg"]:
            self.assertTrue((output/path).is_file(), path)
        for path in ["api", "netlify", "supabase", "tests", "scripts", ".git", ".env.example", "package.json", "shared-sync/tooling", "lib/feishu-review.js"]:
            self.assertFalse((output/path).exists(), path)
        for file in output.rglob("*"):
            self.assertFalse(file.is_symlink())
            if file.is_file():
                self.assertNotIn(file.suffix, {".pem", ".key", ".map"})
        self.assertIn("/api/* /api-unavailable.json 404", (output/"_redirects").read_text())
        self.assertLess((output/"_redirects").read_text().index("/api/account-config "), (output/"_redirects").read_text().index("/api/* "))
        self.assertNotIn("/* /index.html", (output/"_redirects").read_text())

    def test_failure_on_missing_script_css_font_image(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root/"index.html").write_text('<script src="missing.js"></script><link href="missing.css" rel="stylesheet"><img src="missing.svg">')
            (root/"style.css").write_text('@font-face{src:url(missing.woff2)}')
            missing = {ref for _, ref in auditor.audit(root)["missing"]}
            self.assertEqual(missing, {"missing.js", "missing.css", "missing.svg", "missing.woff2"})

    def test_deny_new_root_server_and_secret_files(self):
        with tempfile.TemporaryDirectory() as folder:
            original = builder.ROOT
            try:
                builder.ROOT = Path(folder)
                for name in [".env", "server.js", "api/secret.js", "lib/server.js", "shared-sync/tooling/secret.js", "shared-sync/.env.js", "credentials.pem"]:
                    file = builder.ROOT/name; file.parent.mkdir(parents=True, exist_ok=True); file.write_text("SECRET_SENTINEL")
                    self.assertFalse(builder.allowed(file), name)
                target = builder.ROOT/"secret-source"; target.write_text("SECRET_SENTINEL")
                link = builder.ROOT/"app.js"; link.symlink_to(target)
                self.assertFalse(builder.allowed(link))
            finally:
                builder.ROOT = original

    def test_production_contracts_untouched(self):
        config = (ROOT/"netlify.toml").read_text()
        self.assertIn('publish = "netlify-dist"', config)
        self.assertIn('test -n', config)
        import tomllib
        tomllib.loads(config)
        self.assertNotIn("vercel.app/api", config)
        self.assertEqual(json.loads((ROOT/"vercel.json").read_text())["outputDirectory"], ".")
        # Mirror byte-copies shared login/sync code; no rewrite or storage migration.
        for path in ["index.html", "shared-sync/private-storage.js", "shared-sync/engine.mjs", "shared-sync/journal.mjs"]:
            self.assertEqual((ROOT/path).read_bytes(), (ROOT/"netlify-dist"/path).read_bytes())
        source = (ROOT/"shared-sync/account-ui.mjs").read_text()
        emitted = (ROOT/"netlify-dist/shared-sync/account-ui.mjs").read_text()
        self.assertEqual(source.count("fetch(configUrl,{cache:'no-store',credentials:'omit',signal:"), 1)
        self.assertEqual(emitted, source.replace("fetch(configUrl,{cache:'no-store',credentials:'omit',signal:", "fetch(configUrl,{cache:'no-store',credentials:'same-origin',signal:", 1))

if __name__ == "__main__": unittest.main()
