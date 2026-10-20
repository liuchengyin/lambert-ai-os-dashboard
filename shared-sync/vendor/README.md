# Supabase browser SDK

`supabase-2.118.0.mjs` is the locally bundled ESM browser export of `@supabase/supabase-js@2.118.0`. No runtime CDN scripts are loaded. The official SDK owns authentication sessions, refresh tokens and email callback handling; the app does not hash passwords or mint authentication tokens.

Rebuild from the pinned lockfile:

```
npm ci --prefix shared-sync/tooling
npm run build:sdk --prefix shared-sync/tooling
```

Bundler: esbuild 0.28.2; source entry: `shared-sync/tooling/sdk-entry.mjs`. License: `SUPABASE-LICENSE`. Test-only PostgreSQL engine PGlite and Playwright are tooling dependencies and are not included in the App bundle.
