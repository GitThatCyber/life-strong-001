# Storage and distribution decision

## Current decision October 17 2026

The owner deferred AWS and approved converting Life Strong to native SwiftUI, local SwiftData and private CloudKit. The current app still uses Expo/Express/PostgreSQL; this is a migration decision rather than a completed conversion. See [migration plan](swiftdata-migration-plan.md).

| Concern | Approved target |
| --- | --- |
| iPhone interface | SwiftUI |
| Durable training storage | Local SwiftData store; workouts/library editing work offline |
| Synchronization | Owner's private CloudKit database |
| Drafts/timers/notification settings | Device-local storage and UserNotifications |
| Dedicated API hosting | No AWS service required for the native target |
| Backup/recovery | Versioned exports with tested import/restore; iCloud sync is not an independent backup |
| Installation | Signed native app on owner's iPhone; public listing optional |

Private CloudKit data counts toward the user's [iCloud storage allowance](https://developer.apple.com/documentation/cloudkit/ckcontainer/privateclouddatabase). The owner reports ample storage, so no additional storage purchase is anticipated for the current scope. Cloud availability, quota, throttling, account access and schema limitations still need handling. Membership/signing and any domain/iCloud subscriptions remain separate costs.

Apple [SwiftData iCloud synchronization](https://developer.apple.com/documentation/swiftdata/syncing-model-data-across-a-persons-devices) requires the appropriate iCloud and background capabilities. Verify paid developer enrollment/signing before real container tests. An existing Apple account alone does not establish the required program membership or entitlements.

## Previous server proposal deferred

The prepared AWS approach was a Lightsail Linux VM hosting API, PostgreSQL 17 and Caddy, plus private S3 backups. Its earlier $12/month VM estimate is historical, not a required expense for the selected native target. deployment/, aws-setup.md and private-release-runbook.md remain reference material for the accepted legacy architecture; do not execute them for this migration.

No AWS resource has been created or deleted by Codex. If the owner independently created any, account creation/deferred integration does not cancel their bills; review actual resources in the owner's console separately. vineandvolt.com and the proposed API hostname are unnecessary for native SwiftData/CloudKit operation. Keep domain ownership if desired without configuring an API DNS record.
