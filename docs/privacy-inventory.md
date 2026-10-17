# Private-owner data inventory

## Approved native target October 17 2026

SwiftUI + local SwiftData + private CloudKit replaces planned AWS/API hosting. The migration is not implemented yet. This technical inventory is for release review, not a published legal privacy policy.

Training records will live in the native app's local store and synchronize through the owner's private iCloud database. No app-specific email/password account, bearer token or PostgreSQL credential is planned in the native runtime. Apple account/device access controls and native file protections apply; do not assume CloudKit privacy means every dataset has end-to-end encryption or that large storage capacity replaces a recovery plan.

Drafts, timer state, OS notification identifiers/permissions and reminder preferences remain device-local. Notifications may reveal workout information on the lock screen. Exports are user-selected files containing personal training data; protect and retain them deliberately. iCloud sync can propagate deletions, so an independently restorable export is required.

Migration files must exclude passwords, session hashes and tokens while preserving training/correction audit and clearly documenting excluded recovery tables. On account switch, quarantine the old local store instead of uploading it into a new private database. Local removal/disconnect and delete-everywhere need separate tested semantics; neither the old API deletion endpoint nor uninstalling an app proves CloudKit data is deleted. Native privacy and recovery tests remain pending.

## Existing legacy implementation during migration


This is a technical inventory for release review, not a published legal privacy policy. Target: one private owner; no public signup.

The server stores owner email, a salted scrypt password hash, hashed session tokens with expiration, and exercise/program/workout history. Raw passwords are processed for login/setup and are not intentionally logged or stored. Export excludes credential hashes and sessions. Account deletion removes live training data and disables the owner; retained backups expire separately.

The iPhone stores the bearer token in iOS Keychain and cached workouts, drafts and queued operations in SQLite. SQLite has no additional application-level encryption. Protect the device with a passcode. Keychain entries can survive uninstall; deleting the app is not a server logout. Sign-out revokes the current session and clears synchronized device data and owned notifications; pending writes block sign-out.

Local notifications are scheduled on the device; no remote push service is implemented. Review notification previews on the lock screen. Export invokes the native share sheet: the owner chooses recipients/storage and is responsible for those exported copies.

Prepared API request logs include method, route pattern, status, request ID and duration; omit bodies, credentials, query strings and resource IDs. Hosting providers can retain operational/network metadata under their own policies. No advertising or analytics SDK was added by this release preparation. Review the final native dependency inventory and signed build before release.

Proposed backups use a private encrypted S3 destination with a reviewed retention period. Bucket, lifecycle, monitoring and upload identity are not configured. Retention, provider access, device acceptance and actual deletion/export behavior must be verified before final release. A public App Store listing would require separate privacy disclosures and policy review.
