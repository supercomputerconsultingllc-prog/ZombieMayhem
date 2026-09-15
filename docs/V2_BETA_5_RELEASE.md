# Zombie Mayhem V2 Beta 5: native release candidate preparation

This is an engineering beta, not an App Store-certified release. V1.2 and its preservation branch remain unchanged. The only supported iOS entry point is `apps/zombie-squad-run-ios-webwrap`. The separate old Swift scaffold and the old lane-game release assets are not V2 deliverables.

## Implemented

- Packages `docs/v2` and its local art/audio into the app, with no remote game loader, login, ads or payment bridge.
- Capacitor 8, Node 24 build workflow, Xcode/iOS SDK 26 gate, iOS 15.4 minimum deployment target.
- Two-generation checksummed native save journal, last-good local profile backup, corruption recovery, bounded checkpoint validation and paused Continue Run flow. Saves are not encrypted or anti-cheat protected.
- Checkpoints every ten seconds of foreground simulation and on pause/background transitions. Sudden termination can lose changes since the latest successfully persisted checkpoint. An app update can invalidate an in-progress beta run, but profile migration is separate.
- Completed-run marker prevents the current checkpoint awarding progression twice. Failed profile writes do not clear the recovery checkpoint. Future-version profile data is not overwritten by an older build.
- Optional native haptics, swapped mobile controls, adjustable menu text size, existing reduced motion/contrast/flash controls.
- Each recruit contributes 1.5% firing cadence above the first survivor, capped at 45%. The visible group still shares a forgiving squad collision area; this is not individual soldier physics.
- Wrecks and barrels block squad movement and shots; fire persists with one-second contact-damage intervals; water slows movement. Existing eight projectile styles, rotating squad firing positions, four modes, four biomes and sixteen evolutions remain.
- New app-icon source, native launch screen, bundled privacy/help pages, privacy manifest, hashed asset inventory and compiled-app inventory verification.
- CI separates web simulation, packaged offline browser checks and macOS simulator compilation/launch. Codemagic signing workflow targets TestFlight only and does not auto-release to the App Store.

## Build and test

From repository root:

```sh
npm ci
npm run validate
npm run test:unit
npm run test:soak
npx playwright install --with-deps chromium firefox webkit
CROSS_BROWSER=1 npm run test:browser
cd apps/zombie-squad-run-ios-webwrap
npm ci
npm audit --audit-level=high
npm run prepare:ios
node tools/verify-v2.js --release
```

Release verification requires committed source. A dirty local build is allowed for development and is explicitly marked in `web/build-manifest.json`. Native build output is generated, not checked in; the previous web package is retained in a local backup folder on rebuild. V1 source is never copied into the iOS app. Native build numbers must increase above the latest App Store Connect build, including when switching CI providers.

Run packaged browser checks from the root with `npx playwright test --config=playwright.native.config.mjs`. These exercise the packaged JavaScript, not actual iOS filesystem/haptic hardware. The native CI launch screenshot is evidence for review, not proof of full gameplay or performance.

## Remaining release gates

| Gate | Required evidence before production |
| --- | --- |
| Apple identity/signing | Active Apple Developer membership, confirmation that `com.zombiesquadrun.game` is registered to the intended team, distribution certificate/profile and App Store Connect app record. Configure the `zombie-mayhem-apple` integration securely in Codemagic; never paste private keys into chat or commit them. |
| Signed device build | Successful signed archive, asset-hash verification, Apple processing and an installable TestFlight build. GitHub simulator output is not an installable device IPA. |
| Device stability | Test oldest supported physical iPhone, current standard/Pro iPhones and iPad; record OS/build, renderer quality and crash reports. Cover airplane-mode cold start, incoming call, lock/unlock, Control Center, app switch, interruption during a draft, force termination, low storage, update installation and backup recovery. |
| Performance | Record 10/30/60-minute real-device sessions with Instruments: frame-time percentiles, memory growth, CPU/GPU, thermal state and battery drain. Aim for 60 FPS at normal quality and stable 30 FPS on low; treat these as targets until measured. Headless simulation soak is not battery/performance certification. |
| Gameplay/product quality | Human playtests of all four modes, every weapon/evolution, boss telegraphs, progression pacing and difficulty. Validate the new squad cadence and collision behavior; revise balance from play evidence. |
| Art/audio rights and polish | Review all generated assets and original synthesized audio for quality and provenance. New icon prompt is recorded below; obtain publisher approval and retain generator/license records. No claim of exclusive copyright or professional audio certification is made. |
| Accessibility | Physical-device VoiceOver menu navigation, 140% text, large touch targets, left/right-handed play, reduced-motion and high-contrast testing. Real-time Canvas combat is not currently a screen-reader-playable experience. Do not claim full accessibility certification. |
| Store listing | Approve title, price, territories, age-rating answers, privacy labels, support/privacy URLs, screenshot set and app-review contact. Recapture screenshots from the actual signed build; old lane-game screenshots must not be uploaded. |
| TestFlight acceptance | Invite real testers through authorized account, triage feedback, resolve crashes and critical blockers, then obtain release approval. Public App Store submission stays manual. |

## Draft store copy

Name: Zombie Mayhem. Subtitle: Command. Survive. Extract.

Lead a growing survivor squad through a zombie outbreak. Move freely, dodge telegraphed boss attacks and build your loadout through tactical upgrade choices. Fight across four environments in Campaign, Horde, Extraction and Boss Rush. Eight weapons evolve into sixteen specialist builds, supported by squad formations and recruitable specialists.

Play offline with no required account or ads. Pause at any time and recover an interrupted run. Tune sound, visual effects, menu text size and mobile control placement to suit your device.

Review notes: No login is required. Tap Start V2.0 Run to begin the optional tutorial; Skip training bypasses it. Movement and firing are explained on screen. All modes are available from the title screen. No in-app purchase products, ads, chat or user-generated content are included. Progression and checkpoint files remain on device. In beta, the title displays the beta version for traceability; remove beta wording only when promoting a fully tested production release.

Age-rating questionnaire must accurately disclose frequent fantasy violence and horror themes and the optional blood-decal setting. Do not select a numeric rating without completing Apple's current questionnaire. The intended launch is paid upfront; final price and tax/contract settings require owner approval.

## App icon provenance

`apps/zombie-squad-run-ios-webwrap/native/app-icon-source.png` was generated using the built-in image-generation tool for this project. The build pipeline converts this opaque RGB source to the required 1024px icon resource on macOS.

Prompt: “Use case: stylized-concept. Asset type: final 1024 by 1024 iOS game app icon for Zombie Mayhem. Create an original polished painterly 3D-style close-up of one formidable green zombie head, weathered olive military helmet, expressive glowing pale amber eyes, strong readable angular silhouette, dark teal smoky atmosphere and warm orange rim lighting. Premium survival arcade art matching a grounded military survivor game. Icon must read instantly at small size. Opaque full-bleed square artwork edge to edge, no rounded corners, no borders, no typography, no letters, no logos, no watermark, no UI, no photoreal human identity. Non-graphic horror, no blood or exposed wounds. Center main head with adequate safe margins. Deliver exactly 1024x1024.” Actual generated source dimensions: 1254x1254.

## Official references

- [Apple upload requirements](https://developer.apple.com/news/upcoming-requirements/)
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- [TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)
- [Capacitor filesystem privacy requirements](https://capacitorjs.com/docs/apis/filesystem)
- [Codemagic signing setup](https://docs.codemagic.io/yaml-code-signing/signing-ios/)
- [Codemagic TestFlight publishing](https://docs.codemagic.io/yaml-publishing/app-store-connect/)
