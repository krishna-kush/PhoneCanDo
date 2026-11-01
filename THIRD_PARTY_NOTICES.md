# Third-party notices

PhoneCanDo bundles or uses these components. Their licenses require the notices
to travel with the build. PhoneCanDo is an independent project and is not
affiliated with or endorsed by any of the projects below.

PhoneCanDo itself is Copyright (c) 2026 Krishna Kushwaha. See [`LICENSE`](LICENSE).

## opencode

The on-device opencode engine is built from [anomalyco/opencode](https://github.com/anomalyco/opencode),
MIT License. Copyright (c) 2025 opencode. The bundled web UI and payload keep
their upstream copyright notices.

## opentui

The TUI renderer is built from [anomalyco/opentui](https://github.com/anomalyco/opentui),
MIT License. Copyright (c) 2025 opentui.

## xterm.js

The terminal renderer is [xterm.js](https://github.com/xtermjs/xterm.js), MIT
License. Copyright (c) 2014 The xterm.js authors; Copyright (c) 2012-2013
Christopher Jeffrey. The notice is kept in `app/assets/xterm/xterm.css` and in
the generated `app/assets/xterm/terminal.bundle.html`.

## Geist Mono

The app bundles Geist Mono from the [Geist project](https://github.com/vercel/geist-font),
SIL Open Font License 1.1. The full text is in
`app/assets/fonts/GeistMono-OFL.txt` and must ship with the font.

## NanoHTTPD

The loopback bridge uses NanoHTTPD 2.3.1, BSD-3-Clause. Copyright (c) 2012-2013
Paul S. Hawke; 2001,2005-2013 Jarno Elonen; 2010 Konstantinos Togias. See
`app/modules/phonecando-runner/android/build.gradle`.

## React Native, Expo, Tamagui and Zustand

The app is built with React Native (MIT, Copyright (c) Meta Platforms, Inc. and
affiliates), Expo (MIT, Copyright (c) 2015-present 650 Industries, Inc.),
Tamagui (MIT, Copyright (c) 2020 Nate Wienert and contributors) and Zustand
(MIT, Copyright (c) 2019 Paul Henschel). Their notices are retained in the
bundled JavaScript and in the app's About screen.

## AndroidX, Kotlin and kotlinx

The app and the PCE use AndroidX, the Kotlin standard library,
kotlinx.coroutines and kotlinx.serialization, Apache License 2.0. Copyright (C)
The Android Open Source Project; Copyright 2000-2020 JetBrains s.r.o. and Kotlin
Programming Language contributors. A copy of the license is at
<https://www.apache.org/licenses/LICENSE-2.0>.

## Shizuku (PCE-only)

The optional `pce-shizuku` module uses [Shizuku API](https://github.com/RikkaApps/Shizuku-API),
MIT License, Copyright (c) 2021 RikkaW. It is not part of the v1 router and is
not bundled in the app.

## Website

The website is built with [Astro](https://astro.build), MIT License, and serves
Geist, Geist Mono and Instrument Serif via `@fontsource`, SIL Open Font License
1.1. The OFL text is in `app/assets/fonts/GeistMono-OFL.txt` and in the
`@fontsource` packages.

## npm dependencies

Other npm packages keep their licenses in `node_modules` and in the bundled
JavaScript. The app's About screen (`app/src/ui/common/licenses.ts`) carries the
notices for the components bundled in the APK.
