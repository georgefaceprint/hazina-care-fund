---
description: Build an Android APK/AAB using Bubblewrap
---

1. Ensure the PWA is deployed and manifest is accessible at https://myhazina.org/manifest.webmanifest
2. Run `npm i -g @bubblewrap/cli`
3. Run `bubblewrap init --manifest=https://myhazina.org/manifest.webmanifest`
4. Follow prompts to generate a signing key (keystore)
5. Run `bubblewrap build` to generate the APK and AAB files
6. Copy the generated `assetlinks.json` content to the server under `.well-known/assetlinks.json`
