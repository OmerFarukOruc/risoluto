---
paths:
  - "src/**/*"
---

# Secrets & Credential Handling

## Storage

Use `SecretsPort` (`src/secrets/port.ts`) for reading and writing secrets. Concrete implementation: `SecretsStore` (`src/secrets/store.ts`) — encrypted at rest.

## Environment Variables

- Prefer env expansion (`$LINEAR_API_KEY`) over hardcoding values in config files
- Client-side variables limited to `VITE_*` prefix and must be non-sensitive
- Never commit `.env` files — they are gitignored

## Logging

Never log:
- API keys, tokens, or passwords
- Secret store contents
- Auth headers or bearer tokens
- Webhook signing secrets

Mask sensitive fields in structured logs. When logging config, exclude the `secrets` and `auth` sections.

## WORKFLOW.md Sensitivity

`WORKFLOW.md` contains the agent prompt template with YAML frontmatter. It may reference env vars for secrets. Treat changes to WORKFLOW.md with the same care as config changes — review for leaked credentials.

## Auth & Trust

When changing auth, trust, or sandbox behavior, update `docs/TRUST_AND_AUTH.md` in the same commit.
