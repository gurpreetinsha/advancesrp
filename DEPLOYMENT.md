# SRGC SRP production rollout checklist

This repository change is a hardening patch, not a claim that the live service or its database has been deployed and certified.

## Required environment

Set these in the hosting platform's secret manager (never commit them):

- NODE_ENV=production
- DATABASE_URL: pooled PostgreSQL connection string
- DIRECT_URL: direct PostgreSQL connection string for schema administration
- JWT_SECRET: cryptographically random secret of at least 32 characters; rotate any previously exposed value
- COLLEGE_NAME=Shri Ram Group of Colleges
- COLLEGE_CODE=SRGC

Use a separate database and separate secrets for staging and production.

## Database rollout

1. Take a full PostgreSQL backup and verify that it can be restored.
2. Check for duplicate all-sections faculty assignments (same faculty, subject, academic year, semester with NULL sectionId).
3. Check for more than one active ResultPublication per examId and duplicate (examId, version) pairs.
4. Resolve any duplicates before applying prisma/production-hardening.sql.
5. Review the Prisma schema change that makes MarkCorrectionAudit relations restrictive. Apply it through a reviewed migration.
6. This repository currently has no Prisma migration history. Establish and baseline a migration history against a staging copy before adopting prisma migrate deploy. Do not blindly run prisma db push against production.
7. Run the rollout on staging first, then verify login, faculty scope, mark entry, import, publication, correction, unpublishing, rankings, exports, and PDF generation.

## Identity and security

- Do not run prisma/seed.js in production. It intentionally refuses to run when NODE_ENV=production because it contains development/demo accounts and resets demo credentials.
- Bootstrap the first production administrator through a controlled one-time process, then remove or disable that bootstrap path.
- Configure a shared/distributed login rate limiter at the edge or through a managed rate-limit service. An in-process counter is not sufficient for serverless or multi-instance hosting.
- Enforce MFA for administrators where the identity provider supports it.
- Restrict production database access to the application and approved operators.
- Configure error monitoring, security alerting, log retention, and secret rotation.

## Operational readiness

- Configure automated encrypted backups and perform restore drills.
- Set database connection pool limits appropriate to the hosting platform.
- Confirm TLS and custom-domain behavior, including HSTS implications for all subdomains.
- Configure availability monitoring and incident contacts.
- Review institutional grade boundaries, withheld-result policy, retention policy, and student-data privacy rules with the examination office.
- Review the draft pull request and require CI and a human security review before merging.
