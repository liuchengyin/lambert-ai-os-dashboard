"""Inventory literal browser dependencies without copying arbitrary source files.

Walk all published HTML/CSS/JS/MJS plus manifests; inventory external URLs
separately. User data, API routes and template-computed URLs are not files.
Browser regression additionally checks dynamically requested dependencies.
"""
import json
import re
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote

EXT = r"(?:html|css|js|mjs|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|wasm|webmanifest|json|apk|sha256|zip|pdf)"
LITERAL = re.compile(r'''["'`]((?:https?://|\.?\.?/|/)?[A-Za-z0-9_./@%+:-]+\.''' + EXT + r'''(?:\?[^"'`\s${}]*)?)["'`]''')
CSS_URL = re.compile(r'''url\(\s*["']?([^)'"\s]+)''')
EXTERNAL = re.compile(r'''https?://[^\s"'`<>\\)]+''')

def audit(directory):
    root = Path(directory).resolve()
    missing, external, checked = set(), set(), 0
    class Resources(HTMLParser):
        def __init__(self):
            super().__init__(); self.refs = set()
        def handle_starttag(self, tag, attrs):
            for key, value in attrs:
                if value and key in {"src", "href", "poster"}:
                    self.refs.add(value)
    for file in sorted(root.rglob("*")):
        if not file.is_file() or file.suffix not in {".html", ".css", ".js", ".mjs", ".webmanifest"}:
            continue
        # Vendor-internal strings may be documentation/examples rather than requests.
        # Executed vendor requests are checked by the browser test.
        if "vendor" in file.relative_to(root).parts:
            continue
        text = file.read_text()
        external.update(EXTERNAL.findall(text))
        refs = set()
        if file.suffix == ".html":
            parser = Resources(); parser.feed(text); refs.update(parser.refs)
            # Include inline module imports and the ordered application script list.
            for block in re.findall(r"<script[^>]*>(.*?)</script>", text, re.S):
                refs.update(LITERAL.findall(block))
        else:
            for match in LITERAL.finditer(text):
                # CDN prefix concatenations and remote favicon path construction.
                before = text[max(0, match.start()-20):match.start()].rstrip()
                if before.endswith("+"):
                    continue
                line = text[text.rfind("\n", 0, match.start())+1:text.find("\n", match.end()) if "\n" in text[match.end():] else len(text)]
                if match.group(1) == "/apple-touch-icon.png" and "new URL(" in line:
                    continue
                refs.add(match.group(1))
        if file.suffix in {".css", ".html"}:
            refs.update(CSS_URL.findall(text))
        for ref in refs:
            if ref.startswith(("http:", "https:", "data:", "blob:", "#")):
                continue
            path = unquote(urlsplit(ref).path)
            if not path:
                continue
            rel = file.relative_to(root).as_posix()
            if rel == "shared-sync/app-updates.mjs" and path in {"release.json", "update-notes.json"}:
                # release.json is optional in static previews; it is not an OTA feed.
                if path == "release.json":
                    continue
                path = "../mobile/" + path
            if path.startswith("/api/") or "${" in path:
                continue
            # Service worker FILES use URLs relative to the worker itself.
            target = (root / path.lstrip("/") if path.startswith("/") else file.parent / path).resolve()
            if not target.exists() and not path.startswith(("/", ".")) and (root/path).is_file():
                target = root/path
            if not target.is_relative_to(root):
                missing.add((str(file.relative_to(root)), ref))
                continue
            checked += 1
            if not target.is_file() and not (target.is_dir() and (target / "index.html").is_file()):
                missing.add((str(file.relative_to(root)), ref))
    return {"checked": checked, "missing": sorted(missing), "external": sorted(external),
            "limitations": "Literal dependency audit plus browser tests; external URLs require separate network verification. No API migration or user-data synchronization is implied."}

if __name__ == "__main__":
    import sys
    report = audit(sys.argv[1] if len(sys.argv) > 1 else "netlify-dist")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(bool(report["missing"]))
