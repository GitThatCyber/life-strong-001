# Dependency assessment October 16 2026

Read-only npm audits were retrieved for both packages during Phase 5. Backend: zero reported findings. Frontend: 28 affected package entries (18 high, 10 moderate, no critical). These are registry audit results, not a guarantee of exploitability or safety. No forced fixes, dependency overrides, SDK changes or lockfile upgrades were applied.

The frontend report exposes four underlying advisory records; many other package entries inherit a finding through their dependencies. Confirmed installed paths:

| Dependency path | Advisory and assessment |
| --- | --- |
| expo-router 57.0.28 → query-string 7.1.3 → decode-uri-component 0.2.2 | [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr), malformed percent-encoded input can cause expensive decoding. Navigation may be part of the runtime path; review untrusted link inputs before release. |
| expo 57.0.30 → @expo/cli 57.0.31 → node-forge 1.4.0, directly and through @expo/code-signing-certificates | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), signature-verification issue. Assess development/signing workflows and their inputs; a tooling path does not establish that a finding is harmless. |
| expo 57.0.30 → @expo/config-plugins 57.0.10 → xcode 3.0.1 → uuid 7.0.3 | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq), buffer bounds issue for specific UUID functions/options. The app's operation IDs use native expo-crypto, but the transitive tooling advisory still needs disposition. |
| expo 57.0.30 → @expo/metro 56.0.2 → metro-file-map 0.84.5 → micromatch 4.0.8 → braces 3.0.3 | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), deeply nested brace patterns can exhaust the stack. Review build/development inputs and exposure. |

The path-specific exposure notes above are inferences from the dependency graph, not a complete call-site exploitability analysis. npm's suggested full fixes include moving Expo to 44.0.6, React Native to 0.72.17, or Expo Router to SDK 58. These are incompatible with the preserved SDK 57 baseline and have not been accepted as fixes. Do not run npm audit fix --force as a routine setup step.

## Disposition

Continue trusted local single-user testing with the current tested SDK baseline. Public release remains blocked pending a maintained compatible upgrade/remediation plan or an explicit, reviewed risk disposition for every applicable finding. Recheck upstream supported releases, assess runtime and tooling inputs, test the full supported dependency set together, regenerate lockfiles through npm/Expo, and rerun all automated and physical-device gates. Backend's clean audit does not remove missing authentication/HTTPS/authorization requirements.

Reproduce from project root:

```bash
npm --prefix backend audit
npm --prefix frontend audit
npm --prefix frontend ls braces node-forge decode-uri-component uuid --all
```

Audit results change over time; npm audit exits nonzero while reported findings remain. A nonzero audit result must not be silently treated as a passing security gate. Phase 5 local acceptance can record this known disposition while public release stays blocked.
