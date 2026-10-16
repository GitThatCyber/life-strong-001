# Private-owner data inventory

This is a technical inventory for release review, not a published legal privacy policy. Target: one private owner; no public signup.

The server stores owner email, a salted scrypt password hash, hashed session tokens with expiration, and exercise/program/workout history. Raw passwords are processed for login/setup and are not intentionally logged or stored. Export excludes credential hashes and sessions. Account deletion removes live training data and disables the owner; retained backups expire separately.

The iPhone stores the bearer token in iOS Keychain and cached workouts, drafts and queued operations in SQLite. SQLite has no additional application-level encryption. Protect the device with a passcode. Keychain entries can survive uninstall; deleting the app is not a server logout. Sign-out revokes the current session and clears synchronized device data and owned notifications; pending writes block sign-out.

Local notifications are scheduled on the device; no remote push service is implemented. Review notification previews on the lock screen. Export invokes the native share sheet: the owner chooses recipients/storage and is responsible for those exported copies.

Prepared API request logs include method, route pattern, status, request ID and duration; omit bodies, credentials, query strings and resource IDs. Hosting providers can retain operational/network metadata under their own policies. No advertising or analytics SDK was added by this release preparation. Review the final native dependency inventory and signed build before release.

Proposed backups use a private encrypted S3 destination with a reviewed retention period. Bucket, lifecycle, monitoring and upload identity are not configured. Retention, provider access, device acceptance and actual deletion/export behavior must be verified before final release. A public App Store listing would require separate privacy disclosures and policy review.
