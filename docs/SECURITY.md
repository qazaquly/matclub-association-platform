# Security model

## Authentication

- Passwords use PBKDF2-HMAC-SHA256 with a random 128-bit salt and 210,000 iterations.
- Sessions are signed with HMAC-SHA256, expire after 12 hours, and use HttpOnly + SameSite=Lax cookies. Secure is enabled on HTTPS.
- Production mode refuses to operate without `AUTH_SECRET`.
- Login attempts are rate-limited by normalized email and client IP.

## Request protection

- Sensitive POST routes enforce same-origin checks when the browser supplies `Origin`.
- Zod validates public and administrative payloads.
- D1 prepared statements bind all user-controlled values.
- Server routes load actor and target records before checking authorization.
- Security response headers deny framing, MIME sniffing, camera, microphone, and geolocation access.

## Documents

- The public form accepts 1–3 PDF/JPEG/PNG files, each at most 5 MB.
- Filenames are metadata only; object keys are random UUID paths.
- Every file receives a SHA-256 checksum.
- R2 objects have no public URL.
- Downloads require an authenticated user who owns the profile or has central/own-branch access.
- Responses use `private, no-store` and `nosniff`.

## Personal data

- Public responses do not expose internal notes, decision history, or audit content.
- Department views omit contact details, application documents, and administrative fields.
- Branch access is region-scoped on the server.
- Member updates are restricted to phone, email, workplace, position, professional experience, specialization, achievements, and biography.

## Production checklist

- replace all fictional accounts and rotate the seed password;
- configure a strong hosted `AUTH_SECRET`;
- set production access policy for the internal workspace;
- review Kazakhstan personal-data retention and consent requirements with counsel;
- enable centralized security monitoring and backups;
- add malware scanning before accepting real uploaded documents;
- run an independent penetration test before launch.
