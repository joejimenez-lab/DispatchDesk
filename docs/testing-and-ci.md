# Testing and pull-request verification

Every pull request runs the separate **Pull request verification** workflow. It has two required jobs:

- **Lint, types, tests, and build** installs the locked dependencies, runs ESLint, checks TypeScript without emitting files, runs the Vitest unit/integration suite, and creates a production Next.js build.
- **Disposable database and browser smoke** starts a fresh local Supabase stack, reapplies every migration and the demo seed, runs the pgTAP database suite, builds the application against that local stack, and uses Chromium to verify login, dashboard rendering, and navigation to a seeded load.

The browser fixture script refuses any Supabase URL that is not plain HTTP on a loopback host. The workflow also invokes database reset with `--local`, uses only fictional credentials, and deletes the local database volume when the job ends. These guards keep test setup from writing to a linked or hosted Supabase project.

## Pull requests from forks and secrets

Pull-request verification requests read-only repository contents and does not use repository secrets. Both jobs can therefore run for forked pull requests without exposing production credentials. The local Supabase keys and browser credentials are generated or fixed only for the disposable runner and are not production secrets.

The scheduled database backup remains in `.github/workflows/database-backup.yml`. It does not run for pull requests and separately requires the `DATABASE_URL` and `BACKUP_ENCRYPTION_KEY` repository secrets. Those secrets are not available to, referenced by, or required for code verification.

## Local commands

Run the fast application checks with:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

To reproduce the complete browser job, start a local Supabase stack, reset it, and export the local values reported by `supabase status -o env` as `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Then set fictional local-only `E2E_EMAIL` and `E2E_PASSWORD` values and run:

```bash
npm run db:test
npm run test:e2e:fixture
npm run build
npm run test:e2e
```

The browser configuration starts `next start` on port 3100. Failure traces, screenshots, and videos are written under `test-results/`; CI retains them for seven days.
