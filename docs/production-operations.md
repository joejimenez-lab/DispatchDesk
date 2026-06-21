# Production operations

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
