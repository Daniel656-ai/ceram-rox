# API Layer

All backend access in this project goes through `src/lib/api`. Components,
hooks and pages must **never** import the Supabase client directly.

```ts
// ✅ correct
import { api } from "@/lib/api";
await api.from("orders").select("*");

// ❌ forbidden outside of src/lib/api/**
import { supabase } from "@/integrations/supabase/client";
```

## Why

- Single seam between application code and the backend.
- Easier to test / mock.
- If the backend is swapped (self-hosted Supabase, custom REST, etc.) only the
  files under `src/lib/api/` need to change.

## Note on `VITE_API_URL`

The current backend is Lovable Cloud (managed Supabase). The Supabase JS
client speaks a Supabase-specific protocol, so a single `VITE_API_URL` switch
cannot magically retarget the app to an arbitrary backend — the existing
`VITE_SUPABASE_URL` already plays that role for Supabase-compatible backends.
For non-Supabase backends, the implementation of the modules in this folder
would need to be rewritten; calling code stays unchanged.

## Structure

- `client.ts` — the only file allowed to import the auto-generated supabase
  client.
- `index.ts` — exports the `api` object (raw access + sub-systems).
- Domain modules (added incrementally): `orders.ts`, `samples.ts`, ...
