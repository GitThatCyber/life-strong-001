# Private native release runbook

Target: one owner, native iPhone, proposed lifestrong-api.vineandvolt.com and com.vineandvolt.lifestrong. This runbook prepares a small self-managed Lightsail host; no paid resources are created by the code. Existing local .env files/database have not been migrated automatically. AWS and Apple accounts are not configured yet.

## 1 Account prerequisites

Create an [AWS account](https://aws.amazon.com/) and secure the root account with MFA; use a separate least-privilege deployment identity rather than root credentials/access keys. Set a billing budget/alerts. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/enroll/). Keep credentials, payment information and recovery codes out of chat and source control.

Use an individual membership for the owner's personal target unless an organization account is actually appropriate. Final membership/account verification and bundle-ID availability are external prerequisites. No Expo project or Apple certificates have been created here. The cloud CLI is not installed/configured on the Mac yet; plugin discovery did not find a matching Lightsail provisioning integration.

## 2 Review code and preserve data

The accepted local MVP baseline is commit 30ad053. Release preparation adds migration 004_private_owner.sql and Phase 6 adds 005_training_customization.sql and the files listed in release-checklist.md. Review the private-owner design: no public signup, no second owner, no horizontal multi-user deployment. Existing root resources migrate to the singleton owner; descendants inherit their parent's ownership. Adding another user requires a new data isolation design and acceptance gate.

Synchronize all device queues to the current local API before data transfer. Back up and restore-verify the working database as documented in phase-5-testing.md. Keep a copy off the Mac securely. Do not change a device's API endpoint while it has pending work.

Run locally:

```bash
cd /Users/jondutton/Documents/Codex/life-strong-001
npm --prefix backend ci
npm --prefix frontend ci
npm run check
npm run test:integration
npm run test:release-image
```

The release-image suite creates only an isolated tmpfs PostgreSQL container and test network, checks production owner access and database privileges, then removes those test resources. It does not touch the working volume or open host ports. Unit/integration deletion tests delete only fixture data.

## 3 Local owner-flow acceptance before hosting

After a verified backup, run npm run db:migrate twice; migration 004 must apply then skip. Existing data becomes owned by the private profile. In backend/.env, temporarily add OWNER_EMAIL and a development-only OWNER_PASSWORD of 15–128 characters, set AUTH_MODE=owner, run npm run owner:setup, then remove OWNER_PASSWORD. Setup hashes the password and revokes prior sessions. Do not put the password in shell command arguments or commit it.

Set EXPO_PUBLIC_AUTH_MODE=owner in frontend/.env. Restart both API and Expo. For LAN HTTP testing use only a development password distinct from the final cloud password; the final password should be entered only over the real HTTPS endpoint. Local development HTTP is not the release transport.

Verify on iPhone:

- Wrong credentials fail; the owner can sign in; there is no signup UI.
- Workouts/history/progress/reminders still work while signed in.
- Cached workouts can be recorded offline and synchronize after reauthentication; expired/invalid credentials retain the queue rather than discarding it.
- Account and data exports synchronized records through the iPhone share sheet without credentials/session tokens.
- Sign out is disabled while pending changes/unconfirmed starts exist; after synchronization it revokes the current token, clears the current device cache/credentials and cancels scheduled alerts.
- Sign back in and confirm server history remains.
- Test account deletion only against a disposable copy/fixture deployment, never the real training account just to check the button. It deletes live training records, disables credentials and revokes sessions. Backups follow their retention policy. Reprovisioning requires the admin setup command.

Local mode remains available only for development. Production configuration requires AUTH_MODE=owner, a private DATABASE_URL and HTTPS PUBLIC_ORIGIN. Unauthenticated data requests return 401; only the basic process health endpoint is public.

## 4 Concrete cloud approval before purchase

Proposed plan: one Linux Lightsail instance with public IPv4 and 2 GB RAM, published 12 USD/month VM baseline, plus domain/backup/usage/tax. Choose the closest suitable region and current Ubuntu LTS image, then verify current plan/price before creation. Do not proceed with a different billable architecture silently. Approve the actual region, plan, backup policy and account before provisioning.

Use a static IP and DNS A record for lifestrong-api.vineandvolt.com. Open TCP 80/443 publicly for HTTPS and certificate issuance; restrict SSH to the owner's current IP. Do not open ports 3000 or 5432 publicly. Enable/verify host storage encryption, security updates, SSH-key authentication and Docker log/disk monitoring. The deployment has no managed database failover.

## 5 Install the prepared deployment

Copy the reviewed source to the host through a secure channel. Build on the target architecture; a local Apple Silicon image must not be assumed compatible with an x86 host. Use immutable release tags/digests for the actual approved rollout, retaining the previous authenticated release image.

On the host from the project root:

```bash
cp -n deployment/.env.example deployment/.env
chmod 600 deployment/.env
```

Edit that private file with two different values generated separately by openssl rand -hex 32, the actual API hostname, and the release tag. Hex avoids URL-encoding ambiguity in the prepared connection strings. Do not reuse the documented development database password. Set OWNER_EMAIL/OWNER_PASSWORD privately for initial provisioning, then remove the password afterward.

```bash
docker compose --env-file deployment/.env -f deployment/compose.yml build api
docker compose --env-file deployment/.env -f deployment/compose.yml up -d postgres
```

If importing the existing training database, restore its verified custom-format dump into this new, otherwise-empty database **before** running migrations:

```bash
docker compose --env-file deployment/.env -f deployment/compose.yml exec -T postgres pg_restore -U lifestrong_admin -d lifestrong --no-owner --no-privileges --exit-on-error < /secure/path/verified-training.dump
```

Do not restore over a populated database. Review/approve the target and backup first; use a separate verified recovery procedure if the target is not empty. The supplied Compose project/volume is isolated from the local development Compose project.

Then:

```bash
docker compose --env-file deployment/.env -f deployment/compose.yml run --rm tools npm run migrate:built
docker compose --env-file deployment/.env -f deployment/compose.yml exec -T postgres psql -U lifestrong_admin -d lifestrong -v ON_ERROR_STOP=1 < deployment/runtime-grants.sql
docker compose --env-file deployment/.env -f deployment/compose.yml run --rm tools npm run owner:setup:built
```

If this is a fresh database, seed through the tools service only when desired; never use seeding to overwrite a restored plan. Remove OWNER_PASSWORD from deployment/.env after provisioning. The runtime gets only the restricted lifestrong_app connection, never admin or bootstrap passwords.

```bash
docker compose --env-file deployment/.env -f deployment/compose.yml up -d api caddy
docker compose --env-file deployment/.env -f deployment/compose.yml ps
curl -i https://lifestrong-api.vineandvolt.com/api/v1/health
curl -i https://lifestrong-api.vineandvolt.com/api/v1/sessions
```

Expected: a valid public TLS certificate, HTTP 200 health and HTTP 401 for unauthenticated training data. Test owner sign-in through the phone without printing tokens in logs. Caddy is the sole public proxy; the API trusts exactly one proxy hop. Do not expose the API container directly or add a CDN/proxy without revisiting that trust configuration.

## 6 Backups, monitoring and recovery

Prepare a private S3 backup bucket with public access blocked, server-side encryption, a reviewed 14-day lifecycle (or another explicitly chosen period) and an upload identity limited to its backup prefix. The instance needs AWS CLI and that restricted identity; it must not store root/admin account credentials. Set BACKUP_S3_URI to the chosen private prefix and test deployment/backup.sh. It creates a custom dump, validates its archive listing and uploads with SSE AES256. Cloud upload/scheduling has not been run or authorized by merely preparing this script.

After the destination/IAM/retention are reviewed, schedule daily backups and alert on failed jobs; perform a real isolated restoration drill periodically. Account deletion removes live data but does not immediately remove existing retained backup objects. Keep that distinction in privacy notes. Monitor process/database health, host disk and backup freshness. Request logs omit authorization headers, bodies, query strings and resource IDs; Docker rotates logs.

## 7 Signed installation on the owner's iPhone

Complete the HTTPS and owner-mode phone tests in Expo Go first. Confirm the proposed bundle identifier is available in the owner's Apple account. In the frontend build environment set:

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://lifestrong-api.vineandvolt.com/api/v1
EXPO_PUBLIC_AUTH_MODE=owner
IOS_BUNDLE_IDENTIFIER=com.vineandvolt.lifestrong
```

No secret belongs in EXPO_PUBLIC variables. Create/sign into the owner's Expo project, record its project ID as EXPO_PUBLIC_EAS_PROJECT_ID if required by the dynamic config, and register the iPhone for ad hoc provisioning using the official EAS workflow. Suggested commands from frontend after account setup:

```bash
npx eas-cli login
npx eas-cli init
npx eas-cli device:create
npx eas-cli build --platform ios --profile preview --local
```

These commands involve external accounts/signing; they have not been executed. A local build needs the supported Xcode/native dependencies and avoids paid cloud build usage. The Mac has Xcode 27.0, but the actual SDK/native toolchain and signing still need validation. If native dependencies are missing, resolve them before claiming a signed build succeeds. Use the installed certificate/profile's actual expiration dates and plan renewal.

Install the resulting signed app through the approved ad hoc distribution workflow. It must launch without Metro, Expo Go or the Mac running. Repeat sign-in, offline force-quit/recovery, locked-screen notifications, export, progress and logout on the standalone app. Verify uninstall/reinstall behavior on a disposable test install: iOS Keychain credentials may survive uninstall. Revoke sessions through owner setup when a fresh sign-in is required. Do not clear the real device's pending queue to test a reinstall. A public App Store submission is optional and requires separate listing/privacy/review work.

## 8 Rollback and final release decision

Record the source commit, backend image digest, database migration level, app version/build number, TLS hostname, backup restore result and device-test evidence. Keep a previous authenticated image compatible with migrations 004 and 005 and Phase 6 target preservation. Older library-writing code can discard structured targets; freeze authoring and review compatibility rather than rolling it back unrestricted. Never roll a public host back to the unauthenticated local-MVP image.

If database restoration is needed, stop writes, verify the target/backup, restore to an isolated instance first and compare records. Revoke restored auth_sessions so previously revoked credentials are not resurrected from a backup. Review device outboxes before replaying against restored records; acknowledged operations lost during restore need deliberate reconciliation. Do not use Docker volume deletion as rollback.

Remaining release gates: physical owner-mode acceptance, real HTTPS/DNS health, off-device backup/monitoring, dependency risk disposition, actual signing/standalone install and explicit final rollout approval. No paid resource, DNS record or signed app is claimed complete yet.
