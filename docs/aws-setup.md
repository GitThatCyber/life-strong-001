# AWS setup for the private Life Strong API

> **Deferred October 17, 2026. Historical server architecture only.** The owner approved SwiftUI + local SwiftData + private CloudKit. Do not provision AWS or use the server-deployment instructions below for the new target. Follow [native migration plan](swiftdata-migration-plan.md) and [current release checklist](release-checklist.md). Existing resources, if any, are not automatically stopped or deleted by this documentation change.


Updated October 17, 2026. Gates 1–6 are accepted. The owner will perform these steps; Codex has not accessed accounts or created resources. AWS account creation is confirmed, but MFA, DNS management and Apple paid enrollment have not been verified. This guide hosts the API; native iPhone signing follows separately.

## 1 Choose the services and protect the account

Use one Lightsail Linux VM running the prepared API, PostgreSQL 17 and Caddy containers. Use S3 for private database backups and the existing DNS provider for vineandvolt.com. A managed database, load balancer, NAT gateway and domain transfer are unnecessary for this initial one-owner configuration.

1. Sign into AWS and enable root-user MFA under Security credentials. Keep recovery information in your password manager; do not create root access keys.
2. Configure non-root console access through IAM Identity Center or an MFA-protected IAM administrator. Use that identity for provisioning. The backup uploader created later has separate restricted permissions.
3. Open Billing and Cost Management → Budgets. Create a monthly cost budget, suggested starting amount $20, with email alerts at 80% and 100% actual spend and a forecast alert. This is a notification budget, not a hard spending cap.
4. Keep the region consistent: this guide proposes US East Ohio, `us-east-2`. Confirm its price before clicking Create.

The [published Lightsail Linux public-IPv4 2 GB plan](https://aws.amazon.com/lightsail/pricing/) is $12/month for the VM. S3, snapshots, excess usage and tax are additional. New-account credits do not establish the ongoing price. Apple membership and domain renewal are separate.

## 2 Create the Lightsail server

1. Open [Lightsail](https://lightsail.aws.amazon.com/), then Instances → Create instance.
2. Select Ohio, Linux/Unix, OS Only, Ubuntu 24.04 LTS. Choose the base OS rather than an application image. If this image/plan is unavailable, stop and review the alternative rather than silently choosing a different engine or price.
3. Choose the plan with public IPv4, 2 GB RAM and the expected $12/month price. An IPv6-only plan will not work with the static IPv4 instructions below.
4. Name it `lifestrong-private`. Confirm the displayed price and create it. Billing starts when resources are created; stopping a Lightsail instance is not a billing shutdown procedure.
5. Record its region, instance name and selected plan. Enable automatic snapshots only after reviewing their separate cost; snapshots supplement database backups.
6. In Lightsail Account → SSH keys, download the private key for the selected region if using the default key pair. Keep it private. Do not put it in the project or chat.

## 3 Attach a static IP and set firewall rules

1. Open the instance → Networking → Create static IP. Attach it to `lifestrong-private`, name it `lifestrong-static`, and record the address.
2. Set IPv4 firewall rules:

| Port | Protocol | Allowed source |
| --- | --- | --- |
| 22 SSH | TCP | Your Mac network's current public IP /32; optionally allow Lightsail browser SSH |
| 80 HTTP | TCP | All IPv4 addresses |
| 443 HTTPS | TCP | All IPv4 addresses |

3. Remove an existing unrestricted SSH rule; adding a restricted rule does not override a more permissive one. Do not add API port 3000 or database port 5432.
4. Disable IPv6 for this first deployment, or separately apply equivalent restrictive IPv6 rules. IPv4 rules do not protect IPv6.
5. If your home public IP changes, update the SSH rule. Use your Internet public IP here, not a 10.x LAN address.

An [attached Lightsail static IP has no additional charge](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-frequently-asked-questions-faq-billing-and-account-management.html); an unattached one can incur charges. See [firewall instructions](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-editing-firewall-rules.html).

## 4 Add the API DNS record

At the provider currently hosting DNS for vineandvolt.com, add:

| Setting | Value |
| --- | --- |
| Type | A |
| Name or host | lifestrong-api |
| Address | The attached Lightsail static IPv4 address |
| TTL | 300 seconds, if available |

Some providers require the full host `lifestrong-api.vineandvolt.com`. If using Cloudflare, choose DNS only for this initial deployment. Keep existing website/email records and nameservers. Remove or correct conflicting records for this API host only. Do not add an AAAA record without an IPv6 deployment.

On your Mac:

```bash
dig +short A lifestrong-api.vineandvolt.com
dig +short AAAA lifestrong-api.vineandvolt.com
```

Expect the static IPv4 address and no AAAA result. DNS may take time to update. Caddy will obtain its certificate after DNS resolves and ports 80/443 reach the server; no paid certificate or Lightsail load balancer is needed for this configuration.

## 5 Prepare and transfer the accepted application

First synchronize every pending workout on the iPhone to the local API. Do not change its API URL yet. On the Mac, start Docker Desktop and run from the project root:

```bash
cd /Users/jondutton/Documents/Codex/life-strong-001
umask 077
mkdir -p backups
docker compose exec -T postgres pg_dump -U lifestrong -d lifestrong -Fc > backups/before-aws-20261017.dump
npm run verify:backup -- backups/before-aws-20261017.dump
npm run archive
```

Use a new backup filename if that one already exists. Stop if backup restoration verification fails. These commands assume the accepted development database in Docker; back up the actual database if your setup differs. Keep the original dump on the Mac.

The archive command prints its exact source archive path. It includes current source changes, including the exercise-creation follow-up, and excludes .env files, dependencies and backups. For the final release, record a committed source version and archive checksum. Never upload the entire working folder with its .env files.

On the Mac, move the downloaded SSH key into a private location and set permissions; replace the download filename:

```bash
mkdir -p ~/.ssh
cp ~/Downloads/YOUR_DOWNLOADED_LIGHTSAIL_KEY.pem ~/.ssh/life-strong-lightsail.pem
chmod 600 ~/.ssh/life-strong-lightsail.pem
```

Set the real address and connect:

```bash
LIFE_STRONG_HOST=YOUR_STATIC_IPV4
ssh -i ~/.ssh/life-strong-lightsail.pem ubuntu@"$LIFE_STRONG_HOST"
```

Check the SSH host identity through the Lightsail console before accepting it. In this SSH session:

```bash
mkdir -p ~/life-strong-transfer
chmod 700 ~/life-strong-transfer
```

In a second Mac Terminal, set LIFE_STRONG_HOST again and transfer the specific archive/dump, replacing the archive filename printed earlier:

```bash
LIFE_STRONG_HOST=YOUR_STATIC_IPV4
cd /Users/jondutton/Documents/Codex/life-strong-001
scp -i ~/.ssh/life-strong-lightsail.pem archives/YOUR_SOURCE_ARCHIVE.tar.gz ubuntu@"$LIFE_STRONG_HOST":life-strong-transfer/source.tar.gz
scp -i ~/.ssh/life-strong-lightsail.pem backups/before-aws-20261017.dump ubuntu@"$LIFE_STRONG_HOST":life-strong-transfer/training.dump
```

## 6 Install Docker on the server

All commands from here through section 9 run in the Ubuntu SSH session, not on the Mac.

```bash
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install -y ca-certificates curl unzip unattended-upgrades
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

Add the official Docker repository:

```bash
. /etc/os-release
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu %s stable\n' "$(dpkg --print-architecture)" "$VERSION_CODENAME" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker version
sudo docker compose version
sudo dpkg-reconfigure -plow unattended-upgrades
```

Enable automatic security updates when prompted. Reboot if the OS reports it is needed, then reconnect. This follows the [official Docker Ubuntu installation](https://docs.docker.com/engine/install/ubuntu/). Use a fresh host; review package conflicts if Docker was already installed.

Create the application folder and extract only this trusted source archive:

```bash
sudo mkdir -p /opt/life-strong
sudo chown ubuntu:ubuntu /opt/life-strong
chmod 700 /opt/life-strong
tar -xzf ~/life-strong-transfer/source.tar.gz -C /opt/life-strong
cd /opt/life-strong
```

## 7 Configure private production settings

```bash
umask 077
cp -n deployment/.env.example deployment/.env
chmod 600 deployment/.env
nano deployment/.env
```

Set PUBLIC_HOST=lifestrong-api.vineandvolt.com and RELEASE_TAG=candidate-20261017. Replace both database placeholders with different random 64-character hex strings, generated separately with `openssl rand -hex 32`. Store them in your password manager.

Set OWNER_EMAIL to your sign-in email and OWNER_PASSWORD to a new private production password, 15–128 characters. Random letters/digits avoid Compose .env interpolation/quoting surprises. Store it in your password manager and use it only over HTTPS. Do not reuse the LAN development password or paste it into chat. These owner fields are bootstrap values; remove OWNER_PASSWORD after setup.

Validate without printing the resolved credentials:

```bash
sudo docker compose --env-file deployment/.env -f deployment/compose.yml config --quiet
sudo docker compose --env-file deployment/.env -f deployment/compose.yml build api
sudo docker compose --env-file deployment/.env -f deployment/compose.yml up -d postgres
sudo docker compose --env-file deployment/.env -f deployment/compose.yml ps
```

Wait for PostgreSQL to be healthy. Build on this host; do not assume a Mac-built ARM image runs on a different CPU architecture. No API/database host port is published by the supplied Compose configuration.

## 8 Import training data and provision the owner

Only restore into this new empty database. Confirm there are zero application tables:

```bash
sudo docker compose --env-file deployment/.env -f deployment/compose.yml exec -T postgres psql -U lifestrong_admin -d lifestrong -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"
```

If the count is not zero, stop and inspect the target. Do not restore over existing data or reset the volume.

```bash
sudo docker compose --env-file deployment/.env -f deployment/compose.yml exec -T postgres pg_restore -U lifestrong_admin -d lifestrong --no-owner --no-privileges --exit-on-error < ~/life-strong-transfer/training.dump
sudo docker compose --env-file deployment/.env -f deployment/compose.yml run --rm tools npm run migrate:built
sudo docker compose --env-file deployment/.env -f deployment/compose.yml run --rm tools npm run migrate:built
sudo docker compose --env-file deployment/.env -f deployment/compose.yml exec -T postgres psql -U lifestrong_admin -d lifestrong -v ON_ERROR_STOP=1 < deployment/runtime-grants.sql
sudo docker compose --env-file deployment/.env -f deployment/compose.yml run --rm tools npm run owner:setup:built
```

Expect migrations through 005 to apply/skip, then owner setup success. Owner setup replaces the password hash and revokes imported sessions. Do not seed over the imported library. For a deliberately fresh installation instead of migration, skip the restore and seed after migrations only if desired.

Edit deployment/.env again and remove OWNER_PASSWORD. Retain the database passwords; changing their .env values alone does not rotate existing PostgreSQL role passwords.

## 9 Start HTTPS and verify restrictions

```bash
sudo docker compose --env-file deployment/.env -f deployment/compose.yml up -d api caddy
sudo docker compose --env-file deployment/.env -f deployment/compose.yml ps
```

On the Mac:

```bash
curl -i https://lifestrong-api.vineandvolt.com/api/v1/health
curl -i https://lifestrong-api.vineandvolt.com/api/v1/sessions
```

Expect valid HTTPS, health 200, and sessions 401. An unauthenticated 200 containing training data is a failure. Do not enter your production password until valid HTTPS works. Ports 3000/5432 must remain closed publicly.

If HTTPS fails, check A/AAAA records, ports 80/443, conflicting CAA restrictions at your DNS provider, and the Caddy logs on the server:

```bash
cd /opt/life-strong
sudo docker compose --env-file deployment/.env -f deployment/compose.yml logs --tail 100 caddy api
```

Keep Caddy as the sole proxy. Do not insert Cloudflare proxying or another proxy without revisiting the API's one-hop trust configuration.

## 10 Create the private S3 backup destination

1. Open S3 → Create bucket; choose a general-purpose bucket in Ohio.
2. Use a globally unique lowercase name, such as vineandvolt-lifestrong-backups followed by your own unique suffix. Record it as YOUR_BACKUP_BUCKET below.
3. Keep Object Ownership at bucket-owner-enforced/ACLs disabled. Keep all Block Public Access settings enabled. Keep default SSE-S3 encryption enabled.
4. Enable bucket versioning for protection against accidental replacement. In Management → Lifecycle, create a rule scoped to `backups/`: expire current versions after 14 days, permanently expire noncurrent versions after 14 days, and abort incomplete multipart uploads after 1 day. Add expired-delete-marker cleanup if needed as a separate rule.
5. This is not a strict 14-day deletion promise: versioned expiration can retain a noncurrent copy longer, and lifecycle removal is asynchronous. Review actual retention before final privacy acceptance. No transition to archival storage is needed for these small short-lived backups.

See [AWS lifecycle instructions](https://docs.aws.amazon.com/AmazonS3/latest/userguide/how-to-set-lifecycle-configuration-intro.html). S3 storage and requests are additional usage charges.

Create an IAM user named `lifestrong-backup`, with no console login and only this customer-managed policy. Replace YOUR_BACKUP_BUCKET in the ARN:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts"],
    "Resource": "arn:aws:s3:::YOUR_BACKUP_BUCKET/backups/*"
  }]
}
```

Create an access key for this uploader only; never copy an administrator or root key onto the server. This restricted uploader can upload within that prefix, but has no restore/download/list/delete permissions. Restore access stays with your separate operator identity. Standard EC2 instance-profile instructions are not interchangeable with Lightsail. [AWS advises restricted IAM-user permissions when workload access keys are necessary](https://docs.aws.amazon.com/IAM/latest/UserGuide/securing_access-keys.html); rotate/revoke this key when needed.

## 11 Configure and schedule server backups

On the server, install AWS CLI v2 using the [official Linux installer and signature-verification instructions](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html). Check `uname -m` and use the x86_64 or aarch64 package that matches the host. Do not install the Mac package on Ubuntu.

Configure the restricted uploader interactively:

```bash
sudo aws configure --profile life-strong-backup
```

Enter its access key ID and secret at the prompts, default region us-east-2 and output format json. These are backup-user keys, not account-root keys. Configure under sudo because the scheduled job below runs as the local OS root user. Keep /root/.aws/credentials private; these credentials do not enter the API container or mobile app.

Run a backup, replacing the bucket name:

```bash
cd /opt/life-strong
sudo env AWS_PROFILE=life-strong-backup AWS_DEFAULT_REGION=us-east-2 BACKUP_S3_URI=s3://YOUR_BACKUP_BUCKET/backups sh deployment/backup.sh
```

Expect “Backup verified and uploaded”. Confirm the new dump under backups/ in the S3 console using your operator login. The script validates the archive listing; this alone is not a complete restore drill.

Schedule a daily run:

```bash
sudo crontab -e
```

Add one line, substituting the bucket name:

```cron
15 3 * * * AWS_PROFILE=life-strong-backup AWS_DEFAULT_REGION=us-east-2 BACKUP_S3_URI=s3://YOUR_BACKUP_BUCKET/backups /usr/bin/flock -n /run/lock/life-strong-backup.lock /bin/sh /opt/life-strong/deployment/backup.sh >> /var/log/life-strong-backup.log 2>&1
```

This is 03:15 in the server's timezone; check with `timedatectl`. Inspect the log and verify a new S3 object after the scheduled run. Configure log rotation for /var/log/life-strong-backup.log. Cron plus logs is not a failure/freshness alert: backup failure notification and stale-backup monitoring remain required before closing the operations gate.

Download a resulting dump using the S3 console/operator identity to a secure Mac folder. On the Mac, run `npm run verify:backup -- /absolute/path/to/downloaded.dump` with Docker running. Expect an isolated restore and PASS. This verifies the uploaded backup rather than just the original local dump. Do not restore onto the live cloud database for a drill.

## 12 Connect the iPhone and finish the cloud acceptance gate

1. Ensure all existing local workout queues are synchronized before changing endpoints. Moving to the cloud URL creates a different device-cache namespace.
2. In the Mac frontend/.env set:

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://lifestrong-api.vineandvolt.com/api/v1
EXPO_PUBLIC_AUTH_MODE=owner
```

3. Restart Expo with `npm run dev:ios -- --clear` from the project root. Load Expo Go, sign in with the production owner and confirm the imported library/history.
4. Test exercise creation twice in a row, workout targets, recording, progress, offline force-quit/reconnect, export, logout and sign-in. Do not test account deletion on the real training account.
5. With Metro still reachable over Wi-Fi, stop the local Mac API. Cloud requests should still work. Expo Go still depends on Metro; running without the Mac entirely requires the separate signed standalone build.
6. In Lightsail Metrics/notifications configure owner email notifications and a supported instance health/status-check alarm. Add external HTTPS and backup-freshness/failure monitoring before declaring operations ready. Native app authentication acceptance and cloud acceptance are separate from the accepted local Gate 6.
7. Record region, plan, static IP, hostname, release source/archive checksum, API image ID/digest, migration level, uploaded-backup restore result and phone-test result. Keep original verified local backups securely.

Cloud hosting is ready for acceptance when HTTPS returns 200 health/401 protected data, owner access and imported data work, the restricted backup job uploads and the downloaded backup restores. Full release additionally requires dependency disposition, monitoring, private-data review and the signed standalone iPhone gate in private-release-runbook.md. No App Store submission is required for the selected private ad hoc build.
