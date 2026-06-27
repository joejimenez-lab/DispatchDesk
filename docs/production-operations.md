# Production operations

## Deployment and reliability plan

DispatchDesk has two production dependencies: the application host and Supabase. The application host serves the Next.js app and API routes; Supabase provides authentication, PostgreSQL data, and private document storage. If either dependency is unavailable, the app should be treated as degraded or unavailable rather than partially trusted for dispatch decisions.

- **Application hosting:** Deploy the app to a managed Node.js host with HTTPS, environment variables, build logs, and rollback support. If AWS is the host, use a managed service such as Amplify, App Runner, or ECS/Fargate behind an AWS-managed load balancer instead of a manually maintained server. Keep the last known-good build available for rollback.
- **Supabase dependency:** Supabase is a required runtime dependency. Login, load management, reports, maintenance records, and document access all depend on Supabase Auth, PostgreSQL, or Storage. The app exposes `GET /api/health`, which checks Supabase reachability and returns `503` when Supabase is unavailable.
- **AWS or host outage:** If the application host is down, users cannot access DispatchDesk through the normal URL. Recovery is to restore hosting service, roll back to the last known-good deployment if the outage is release-related, or redeploy the same build to a standby host using the existing environment variables.
- **Supabase outage:** If Supabase is down, the UI may load but authenticated data workflows are unavailable. Recovery is to monitor Supabase status, pause data entry in DispatchDesk, preserve any manual dispatch notes outside the app, and reconcile them after Supabase service is restored.
- **Backups:** Enable Supabase platform backups for production and keep the encrypted GitHub Actions database backup workflow enabled as a second copy. Store the backup encryption key separately from database credentials and test restores in a separate Supabase project at least quarterly.
- **Recovery expectations:** For beta, recovery is best-effort during business hours, with backups retained for short-term protection and manual reconciliation expected after provider outages. Before production launch, set explicit recovery targets with the client, provision monitored production backups, document the restore runbook, and perform a timed restore drill.
- **Beta versus production:** Beta is suitable for pilot use, validation, and low-volume operations where temporary provider outages can be handled manually. Production should not be declared until monitoring, alert routing, restore testing, provider status checks, and client-approved recovery targets are in place.

## Database backups

The `Encrypted database backup` GitHub Actions workflow runs daily and can also be started manually. Configure these repository Actions secrets before enabling production traffic:

- `DATABASE_URL`: the Supabase direct or session-pooler PostgreSQL connection string.
- `BACKUP_ENCRYPTION_KEY`: a long, randomly generated encryption passphrase stored separately from the database credentials.

Backups are encrypted with AES-256-CBC and PBKDF2 before upload. GitHub retains each artifact for 14 days. Test a restore at least once per quarter in a separate Supabase project:

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY -in backup.dump.enc -out backup.dump
pg_restore --clean --if-exists --no-owner --dbname "$RESTORE_DATABASE_URL" backup.dump
```

Supabase platform backups should also be enabled for the production project. The workflow provides a second, independently retained copy; it is not a replacement for testing restores.

## Monitoring and logs

- Poll `GET /api/health` every minute from the production uptime monitor.
- Application startup, maintenance mutations, and captured server errors use one-line structured JSON logs.
- Set `ERROR_MONITORING_WEBHOOK_URL` to send sanitized server-error events to the client's monitoring provider. If it requires bearer authentication, also set `ERROR_MONITORING_WEBHOOK_TOKEN`.
- Alert on any five-minute health-check outage, repeated `request.failed` events, backup workflow failures, and Supabase storage/database utilization thresholds.

Do not put database URLs, encryption keys, or monitoring tokens in committed environment files.
