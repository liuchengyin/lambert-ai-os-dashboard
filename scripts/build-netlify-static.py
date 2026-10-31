#!/usr/bin/env python3
"""Build a public-only Lambert AI OS *static preview* for Netlify.

Do not expose server-side API handlers, credentials, tests, source tooling or
repository metadata. This mirror is for reachability testing; /api/* still
requires a separately configured backend.
"""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "netlify-dist"
PUBLIC_EXT = {".html", ".css", ".js", ".mjs", ".svg", ".png", ".jpg",
              ".jpeg", ".webp", ".gif", ".ico", ".woff", ".woff2",
              ".ttf", ".webmanifest", ".wasm", ".map", ".pdf", ".mp3", ".mp4",
              ".srt", ".vtt"}
PUBLIC_ROOT_NAMES = {"manifest.webmanifest", "robots.txt", "sw.js"}
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
        return path.suffix.lower() in PUBLIC_EXT or path.name in PUBLIC_ROOT_NAMES
    if rel.parts[0] == "lib":
        return len(rel.parts) == 2 and rel.parts[1] in PUBLIC_LIB
    return rel.parts[0] in PUBLIC_FOLDERS and path.suffix.lower() in PUBLIC_EXT

def main():
    if DEST.exists():
        shutil.rmtree(DEST)
    DEST.mkdir()
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
    (DEST / "_redirects").write_text("/api/* /api/unavailable 404\n")
    print(f"Netlify static preview: {count} public assets, no server APIs")

if __name__ == "__main__":
    main()
