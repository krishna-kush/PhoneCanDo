# Third-party notices

PhoneCanDo bundles or uses these components. Their licenses require the notices
to travel with the build. PhoneCanDo is an independent project and is not
affiliated with or endorsed by any of the projects below.

PhoneCanDo itself is Copyright (c) 2026 Krishna Kushwaha. See [`LICENSE`](LICENSE).

Each heading names the components and their license. The full, lite and play
APKs ship the same components, except PRoot, talloc and the Default Linux image,
which only full and lite ship. The app's About screen
(`app/src/ui/common/licenses.ts`) carries an entry for every component the APKs
ship, under the same names and licenses, with the full text of each license;
`.github/ci/js/check-licenses.mjs` keeps the two lists in sync.

## opencode — MIT License

The on-device opencode engine is built from [anomalyco/opencode](https://github.com/anomalyco/opencode),
MIT License. Copyright (c) 2025 opencode. The bundled web UI and payload keep
their upstream copyright notices.

## opentui — MIT License

The TUI renderer is built from [anomalyco/opentui](https://github.com/anomalyco/opentui),
MIT License. Copyright (c) 2025 opentui.

## xterm.js — MIT License

The terminal renderer is [xterm.js](https://github.com/xtermjs/xterm.js), MIT
License. Copyright (c) 2014 The xterm.js authors; Copyright (c) 2012-2013
Christopher Jeffrey. The notice is kept in `app/assets/xterm/xterm.css` and in
the generated `app/assets/xterm/terminal.bundle.html`.

## Geist Mono — SIL Open Font License 1.1

The app bundles Geist Mono from the [Geist project](https://github.com/vercel/geist-font),
SIL Open Font License 1.1. The full text is in
`app/assets/fonts/GeistMono-OFL.txt` and must ship with the font.

## NanoHTTPD — BSD-3-Clause

The loopback bridge uses NanoHTTPD 2.3.1, BSD-3-Clause. Copyright (c) 2012-2013
Paul S. Hawke; 2001,2005-2013 Jarno Elonen; 2010 Konstantinos Togias. See
`app/modules/phonecando-runner/android/build.gradle`.

## React Native, Expo, Tamagui and Zustand — MIT License

The app is built with React Native (MIT License, Copyright (c) Meta Platforms,
Inc. and affiliates), Expo (MIT License, Copyright (c) 2015-present 650
Industries, Inc.), Tamagui (MIT License, Copyright (c) 2020 Nate Wienert and
contributors) and Zustand (MIT License, Copyright (c) 2019 Paul Henschel). Their
notices are retained in the bundled JavaScript and in the app's About screen.

## AndroidX, Kotlin and kotlinx — Apache License 2.0

The app, the PCE and the Linux runtime engine (`lre/`) use AndroidX, the Kotlin
standard library, kotlinx.coroutines and kotlinx.serialization
(`kotlinx-serialization-json` 1.8.1, which `lre/oci` brings into every
channel), Apache License 2.0. Copyright (C) The Android Open Source Project
(AndroidX); Copyright 2010-2024 JetBrains s.r.o. and Kotlin Programming Language
contributors (Kotlin); Copyright 2000-2020 JetBrains s.r.o. and Kotlin
Programming Language contributors (kotlinx.coroutines); Copyright 2017-2024
JetBrains s.r.o. (kotlinx.serialization). The full license text is in the
app's About screen and at <https://www.apache.org/licenses/LICENSE-2.0>.

## XZ for Java — 0BSD

The Linux runtime engine (`lre/tar`) unpacks the Default Linux image's xz
stream with [XZ for Java](https://github.com/tukaani-project/xz-java) 1.10
(`org.tukaani:xz`), in every channel. BSD Zero Clause License (0BSD).
Copyright (C) The XZ for Java authors and contributors.

## PRoot — GPL-2.0-or-later

The full and lite apps run Linux images under [PRoot](https://github.com/termux/proot),
Termux's fork, v5.1.107.102 at the commit pinned in `lre/proot/pins.env`. It
ships as `libproot.so` and `libproot-loader.so` (arm64) in the full and lite
APKs only; the play APK has no Linux. GNU General Public License, version 2 or
(at your option) any later version. Copyright (C) 2015 STMicroelectronics.
PRoot was written at STMicroelectronics by Cédric Vincent and the others its
`COPYING` file names; Termux's fork adds work by its contributors. One header,
`src/extension/sysvipc/sysvipc_sys.h`, carries definitions from the GNU C
Library: Copyright (C) 1995-2020 Free Software Foundation, Inc., GNU Lesser
General Public License, version 2.1 or later. We build it with two patches of
ours (`lre/proot/patches/`): a missing include, and `--status-fd` with
`--setsid`, so a command returns when it ends while what it started in the
background keeps running.

Corresponding source: the GitHub release of every app version that ships
PRoot (tag `v<app version>` at <https://github.com/krishna-kush/PhoneCanDo/releases>)
carries `phonecando-proot-<PRoot version>-source.tar.gz` among its assets: the
PRoot tree at the pinned commit, the talloc release tarball, and our build
scripts, pins, talloc build config and patches, with the rebuild steps in its
`SOURCES.txt`. Our build scripts in `lre/proot/` are MIT License
([`lre/proot/LICENSE`](lre/proot/LICENSE)); PRoot itself stays
GPL-2.0-or-later. The GPL-2.0 and LGPL-2.1 texts are in the app's About screen.

## talloc — LGPL-3.0-or-later

[talloc](https://talloc.samba.org) 2.5.0, Samba's hierarchical memory
allocator, is linked statically into `libproot.so` (full and lite only). GNU
Lesser General Public License, version 3 or (at your option) any later version.
Copyright (C) Andrew Tridgell 2004-2005; Copyright (C) Stefan Metzmacher 2006
(`talloc.c`, `talloc.h`). The libreplace header it compiles with
(`lib/replace/replace.h`, same license): Copyright (C) Andrew Tridgell 2005;
Copyright (C) Jelmer Vernooij 2006-2008; Copyright (C) Jeremy Allison 2007.
`lre/proot/talloc/memset_explicit.c` is ours and, as part of the talloc build,
under talloc's license.

Relinking: the same `phonecando-proot-<PRoot version>-source.tar.gz` holds the
talloc tarball and the scripts that build `libtalloc.a` and link it into
`libproot.so`, so you can rebuild `libproot.so` with a modified talloc. The
LGPL-3.0 text and the GPL-3.0 text it incorporates are in the app's About
screen.

## Default Linux image (Debian-based) — per-package licenses

The full and lite APKs carry the Default Linux image (`assets/default-image/`):
an arm64 root filesystem built from Docker's official `debian:trixie` image with
packages from snapshot.debian.org; the recipe is in `lre/images/default/`. It is
Debian-based, not Debian, and PhoneCanDo is not affiliated with or endorsed by
the Debian project. Each Debian package keeps its own license (GPL, LGPL, MIT,
BSD, Apache and others); its copyright and license file is inside the image at
`/usr/share/doc/<package>/copyright`. Debian is a registered trademark owned by
Software in the Public Interest, Inc.

Corresponding source: each image is published once as the GitHub prerelease
`linux-image-<version>` at <https://github.com/krishna-kush/PhoneCanDo/releases>
(the version is in `/etc/phonecando-image` inside the image). Its
`phonecando-linux-default-<version>-sources-NN.tar` assets hold the exact
Debian source packages (`.dsc`, upstream and Debian tarballs) of every
installed package, and of what was built into them statically, at the
installed versions; `-sources-index.tsv` lists every file with its sha256 and
`-packages.tsv` maps each installed package to its source.

## Shizuku (PCE-only) — MIT License

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
