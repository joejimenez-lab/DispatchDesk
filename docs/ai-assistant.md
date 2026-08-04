# Dispatch Assistant beta

DispatchDesk exposes an authenticated, unlisted beta at `/AI_Assistant`. It is
intentionally absent from primary navigation and remains protected by the same
Supabase session and organization row-level security as the rest of the app.

## Configuration

Set these values in `.env.local` for local development and in the deployment
platform secret manager for hosted environments:

```dotenv
AI_ASSISTANT_ENABLED=true
AI_ASSISTANT_ALLOWED_EMAILS=owner@example.com
# AI_ASSISTANT_ALLOWED_USER_IDS=00000000-0000-0000-0000-000000000000
NVIDIA_API_KEY=replace-with-a-rotated-server-side-key
NVIDIA_AI_MODEL=moonshotai/kimi-k2.6
NVIDIA_API_URL=https://integrate.api.nvidia.com/v1/chat/completions
```

The beta fails closed unless `AI_ASSISTANT_ENABLED` is exactly `true`, the
signed-in viewer is an organization owner, and that owner matches at least one
email or user-ID allowlist. The model and URL use the values above by default.
The key must never use a `NEXT_PUBLIC_` prefix or be committed. Rotate any
credential that has appeared in chat, an issue, logs, or other shared text.

## Security model

- The provider selects only from hard-coded read-only tools. It cannot submit
  SQL, mutate records, choose tables, or request arbitrary URLs.
- Every database query uses the signed-in user Supabase client, preserving
  organization isolation.
- Tool arguments, request history, provider responses, and returned links are
  bounded and validated.
- Shared Postgres quotas enforce 12 accepted requests per user per fixed minute
  and 500 accepted requests per organization per UTC day across app instances.
- The API key remains in server-only code and is never returned to the browser.
- PDF requests return authenticated same-origin export or document links. PDF
  bytes and private storage paths are not sent to the model provider.

## Supported beta questions

The initial tools cover driver totals, unpaid and aged-unpaid loads, deliveries
this week, pending driver pay, upcoming truck maintenance, last-month broker
revenue, latest stored load documents, and existing PDF reports.

Available generated reports include weekly financial, weekly payroll, client
billing, maintenance history, yearly financial, and bookkeeping PDFs. If a
requested artifact is not available through a trusted report or stored document
endpoint, the assistant should explain that it cannot generate that artifact
yet instead of inventing a link.

## Production note

NVIDIA's developer-hosted endpoint can be throttled or changed. Before removing
the beta label, confirm the quota values against real usage and use an endpoint
or deployment agreement with appropriate reliability and data-handling
guarantees.
