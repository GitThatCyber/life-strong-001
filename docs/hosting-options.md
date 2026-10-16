# Native iPhone hosting and distribution decision

Updated October 16, 2026. The user selected a native iPhone app for one private owner, minimizing ongoing cost. The user owns vineandvolt.com but has no AWS account or active Apple Developer membership yet. Proposed API: lifestrong-api.vineandvolt.com. Proposed bundle identifier: com.vineandvolt.lifestrong, subject to registration availability. Neither has been registered/configured by this task.

## Distribution and hosting are separate

Apple Developer Program membership is [99 USD per year](https://developer.apple.com/programs/whats-included/). Hosting the API on AWS or Azure does not replace native signing/distribution. Free personal Xcode provisioning expires after [seven days](https://developer.apple.com/help/account/basics/about-your-developer-account), requiring reinstall/rebuild.

A public App Store listing is not the only paid native option. For the chosen single-owner target, recommend a signed ad hoc build installed on the owner's registered iPhone. [Apple's ad hoc provisioning workflow](https://developer.apple.com/help/account/provisioning-profiles/create-an-ad-hoc-provisioning-profile/) and [Expo internal distribution](https://docs.expo.dev/build/internal-distribution/) support registered devices. Membership/signing renewal remains required; record the actual certificate/profile expiration and renew before it expires. A public listing and TestFlight are separate optional distribution paths, not required for this private target.

A Home Screen PWA would avoid the native membership requirement, and [WebKit supports Web Push for installed web apps](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/). It would require browser storage/offline and notification implementations rather than direct reuse of the current native modules. The user chose to retain native behavior, so no web rewrite is being performed.

## Backend comparison

| Candidate | Cost model and fit |
| --- | --- |
| AWS Lightsail VM with Node, PostgreSQL 17 and Caddy | Recommended low-cost private starting point. Published Linux public-IPv4 2-GB plan is 12 USD/month; VM alone is 144 USD/year. Domain renewal, off-device backup storage, snapshots, transfer beyond allowances and tax are additional. This is one self-managed host, not high availability. |
| Azure Container Apps + PostgreSQL Flexible Server | More managed infrastructure; compare compute, database, storage, logs and networking in the regional calculator. Container Apps has free consumption grants, but those do not make the whole database-backed deployment free. Suitable if the user later has Azure credits or prefers managed services. |
| AWS managed compute + RDS PostgreSQL | Reduces database administration but adds separate service/network/backup costs. Obtain a regional quote before choosing it for a one-person app. RDS supports PostgreSQL 17. |

References: [Lightsail prices](https://aws.amazon.com/lightsail/pricing/), [Azure Container Apps billing](https://learn.microsoft.com/en-us/azure/container-apps/billing), [Azure PostgreSQL pricing](https://azure.microsoft.com/en-us/pricing/details/postgresql/flexible-server/), [RDS PostgreSQL 17](https://aws.amazon.com/about-aws/whats-new/2024/11/amazon-rds-postgresql-supports-version-17/). Prices/availability should be rechecked for the selected region when purchasing. This is a proposed architecture, not a cloud quote or completed deployment.

Lightsail managed databases should not be assumed interchangeable with this PostgreSQL 17 project: verify the offered engine major version first. Use the prepared PostgreSQL 17 container for the proposed small-host setup; never silently downgrade a PostgreSQL 17 backup into an older engine.

## Expected baseline budget

Apple membership 99 USD/year plus the proposed 12 USD/month VM totals 243 USD/year before domain renewal, backup/snapshot charges, other usage and taxes. This excludes optional paid build services. A local Mac build can avoid cloud build usage charges but still needs the signing membership and working native toolchain. The Mac currently has Xcode 27.0; actual signed SDK build compatibility remains to be verified with the owner's account.

## Work completed and remaining

Implemented compiled non-root API container, restricted database role, private owner authentication, ownership migration, secure iPhone token storage, sign-out/export/deletion controls, HTTPS proxy configuration, safe logs/timeouts and private build profiles/validation. Automated integration/container tests pass. No AWS resources, DNS records, Apple enrollment, signing certificates or public listing have been created.

Next: account enrollment; confirm regional price/instance plan; approve the concrete paid deployment; configure DNS/HTTPS; migrate verified data; run owner-mode physical iPhone tests; make and install the signed ad hoc build; review remaining dependency and operational risks. See private-release-runbook.md and release-checklist.md.
