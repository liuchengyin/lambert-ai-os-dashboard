# Web home AI layout verification

Base: main `5bf4384` (2026-10-20). Branch: `feat/web-home-ai-layout`.

Scope: web sidebar account entry, home AI row and chat introduction. The existing account button/status IDs and handlers are retained. No Supabase schema, migration, sync engine, Android, Feishu API, task-center layout or localStorage write logic changed.

Desktop: 60/40 columns with a 16px gap and 280px panels. The previous initial chat panel measured 341px at 1440px, so 280px is about 82%. The advisor previously varied with content; both panels now share a bounded height with internal scrolling. At 700px and below the panels stack and use natural height up to 420px. The account icon remains accessible in the collapsed rail and the open mobile menu.

Verified locally using Node 24.19.0, Python static HTTP server and Playwright 1.56.0 with system Chromium 154 via an external launcher adapter:

- `tests/web-home-layout.mjs`: desktop dimensions, send visible without scrolling, quick actions, unsent message preserved through home rerender, sidebar/rail/mobile account dialog, widths 1440/1000/768/700/390/320, task center 165px and unchanged business storage.
- `tests/ai-chat-ui.mjs`, `tests/ai-login-ui.mjs`, `tests/deepseek-ui-smoke.mjs`, `tests/task-filter-disclosure.mjs`: passed.
- `TEST_ORIGIN=http://127.0.0.1:8000 tests/shared-sync/browser.mjs`: passed; email login/logout, registration, recovery, simulated mobile-to-web sync and sync-before-Feishu archive. Real SDK, mocked services, no hosted database writes.
- `node --test tests/shared-sync/*.test.mjs`: 29 passed after installing existing tooling dependencies with `npm ci`. Database checks use local PGlite only.
- `node tests/deepseek-flash-review.mjs`: passed; mocked harness checks are not a paid review.
- `git diff --check`: passed.

The new browser regression is registered in the existing Workspace UI Smoke PR workflow.

Auxiliary review: reuse the existing DeepSeek Flash Independent Review workflow with `--home-ui`, restricted to index.html, web-home.css and ai-chat.js. Its branch push trigger only matches changes to that workflow file, avoiding another paid call on ordinary UI follow-ups. Requested model is fixed to `deepseek-flash`, no retries/fallback, max output 1800 tokens. The report artifact records reported model and input/output tokens. No local review credential is injected. Actual remote result must be verified separately; a queued workflow is not proof of a model call.

GitHub REST API currently returns Forbidden. PR creation, review outcome and Vercel Preview must not be claimed without confirmed remote evidence. No production deploy or merge is authorized.
