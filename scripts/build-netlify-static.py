#!/usr/bin/env python3
"""Build a public-only Lambert AI OS *static preview* for Netlify.

Do not expose server-side API handlers, credentials, tests, source tooling or
repository metadata. This mirror is for reachability testing; /api/* still
requires a separately configured backend.
"""
from pathlib import Path
import shutil
import json
import importlib.util

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "netlify-dist"
PUBLIC_EXT = {".html", ".css", ".js", ".mjs", ".svg", ".png", ".jpg",
              ".jpeg", ".webp", ".gif", ".ico", ".woff", ".woff2",
              ".ttf", ".webmanifest", ".wasm", ".map", ".pdf", ".mp3", ".mp4",
              ".srt", ".vtt"}
PUBLIC_ROOT_NAMES = set(json.loads((ROOT / "scripts/netlify-public-root.json").read_text()))
PUBLIC_FOLDERS = {
    "brand", "shared-sync", "mobile", "vendor", "downloads",
    "assets", "images", "icons", "fonts",
}
PUBLIC_LIB = {
    "task-center-model.js", "link-sites.js", "link-recovery.js",
}
BLOCKED_PARTS = {
    ".git", ".github", "node_modules", "tests", "scripts", "tooling",
    "__pycache__", ".netlify", "updates", "api", "server", "secrets",
}
BLOCKED_SUFFIX = {".env", ".key", ".pem", ".p12", ".pfx"}

def allowed(path):
    if not path.is_file() or path.is_symlink():
        return False
    rel = path.relative_to(ROOT)
    if any(p.startswith(".") for p in rel.parts):
        return False
    if any(p in BLOCKED_PARTS for p in rel.parts):
        return False
    if path.suffix.lower() in BLOCKED_SUFFIX:
        return False
    if len(rel.parts) == 1:
        return path.name in PUBLIC_ROOT_NAMES
    if rel.parts[0] == "lib":
        return len(rel.parts) == 2 and rel.parts[1] in PUBLIC_LIB
    if rel.as_posix() == "mobile/update-notes.json":
        return True
    if rel.parts[0] == "downloads":
        return len(rel.parts) == 2 and path.suffix.lower() in {".apk", ".sha256", ".zip"}
    if rel.as_posix() == "vendor/pdfjs/LICENSE":
        return True
    return rel.parts[0] in PUBLIC_FOLDERS and path.suffix.lower() in PUBLIC_EXT - {".map"}

def main():
    if DEST.exists():
        shutil.rmtree(DEST)
    DEST.mkdir()
    # Prune private/tooling folders rather than descending into them.
    count = 0
    for f in ROOT.rglob("*"):
        if DEST in f.parents or not allowed(f):
            continue
        rel = f.relative_to(ROOT)
        out = DEST / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(f, out)
        count += 1
    assert (DEST / "index.html").is_file(), "Missing entry point"
    assert (DEST / "app.js").is_file(), "Missing web app"
    assert not (DEST / "api").exists(), "API code exposed"
    (DEST / "_redirects").write_text("/api/account-config /.netlify/functions/account-config 200\n/api/* /api-unavailable.json 404\n")
    (DEST / "api-unavailable.json").write_text(json.dumps({"error":"mirror_backend_unavailable","configured":False})+"\n")
    shutil.copy2(ROOT / "netlify/account-diagnostics.html", DEST / "account-diagnostics.html")
    spec = importlib.util.spec_from_file_location("netlify_audit", ROOT / "scripts/audit-netlify-assets.py")
    audit = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(audit)
    report = audit.audit(DEST)
    (DEST / "mirror-assets.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    if report["missing"]:
        raise RuntimeError("Missing public dependencies: " + json.dumps(report["missing"], ensure_ascii=False))
    print(f"Netlify static preview: {count} public assets; {report['checked']} references checked; no server APIs")

if __name__ == "__main__":
    main()
