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

## bun-pty — MIT License

opencode's bundle inside `liboc-engine.so` carries [bun-pty](https://github.com/sursaone/bun-pty)
0.4.9 and its prebuilt `librust_pty_arm64.so` (built for glibc Linux). MIT
License. Copyright (c) 2025 Dilip Thapa. Its Rust library is built from crates
under the MIT and Apache-2.0 licenses, which bun-pty's `rust-pty/Cargo.lock`
lists.

## Bun — MIT License

The agent engine, `liboc-engine.so` (arm64, in every channel), is opencode
built with `bun build --compile`: one executable made of the official runtime
of [Bun](https://github.com/oven-sh/bun) 1.4.2 for linux-arm64-android and
opencode's bundled JavaScript. The pins are in
`agents/native/opencode/build/pins.env`. So the file carries Bun and all that
Bun links statically or embeds. Bun is MIT License; its `LICENSE.md` names no
copyright holder. Its JavaScript transpiler and module resolver are a port of
[esbuild](https://github.com/evanw/esbuild), MIT License, Copyright (c) 2020
Evan Wallace.

Bun lists what it links in `LICENSE.md` and `docs/project/license.mdx` at tag
`bun-v1.4.2`, and its Rust part links the crates its `Cargo.lock` pins for
`bun_runtime` on Android. Each part has its own entry, under its license:
JavaScriptCore and WebKit (with our written offer for their source), ICU, and
the MIT, Apache, BSD, zlib, MPL and public-domain groups. Bun's Android build
leaves out TinyCC (the C compiler behind `bun:ffi`'s `cc()`) and libuv
(Windows only), so the file has neither. The NDK's libc++, libc++abi and
libunwind and LLVM's compiler-rt, linked in statically, are Apache-2.0 WITH
LLVM-exception, whose exception asks no notice for code compiled into a binary;
so is the `__cxa_thread_atexit` fallback from libc++abi that Bun lists.

Bun also embeds its polyfills for `bun build --target=browser` (its
`src/node-fallbacks/`, versions in its `bun.lock`): assert 2.1.0,
browserify-zlib 0.2.0 with pako 1.0.11, crypto-browserify 3.12.1,
domain-browser 4.23.0, https-browserify 1.0.0, punycode 2.3.1, querystring-es3
1.0.0-0, react-refresh 0.17.0, readable-stream 4.7.0, stream-http 3.2.0 and
string_decoder 1.3.0 with the small packages they need, and code taken from
Node.js (path, url, net, events, util), buffer 5.0.5 (with base64-js and
ieee754) and process 0.11.10. Most are MIT License: Copyright Joyent, Inc. and
other Node contributors (the Node.js code, assert, util, events); Copyright
Node.js contributors (readable-stream, string_decoder, querystring-es3);
Copyright (c) 2014-2015 Devon Govett (browserify-zlib); Copyright (C) 2014-2017
by Vitaly Puzrin and Andrei Tuputcyn (pako); Copyright (c) 2013 Dominic Tarr
(crypto-browserify); Copyright (c) James Halliday (https-browserify); Copyright
Mathias Bynens (punycode); Copyright (c) Meta Platforms, Inc. and affiliates
(react-refresh); Copyright (c) 2015 John Hiesey (stream-http); Copyright (c)
Feross Aboukhadijeh, and other contributors (buffer); Copyright (c) 2014
Jameson Little (base64-js); Copyright (c) 2013 Roman Shtylman (process). Some
are not: domain-browser is Artistic License 2.0, Copyright © 2013+ Bevry Pty
Ltd, with its source at <https://github.com/bevry/domain-browser>; ieee754
(Copyright 2008 Fair Oaks Labs, Inc.) and part of sha.js are BSD-3-Clause;
inherits, minimalistic-assert, browserify-sign and parse-asn1 are ISC License;
pako also carries code under the zlib License. Each package keeps its full
notice in its npm package at those versions.

## mimalloc, simdutf, brotli, c-ares, libdeflate, ls-hpack, ls-qpack, lsquic, picohttpparser and llhttp — MIT License

Bun links these into `liboc-engine.so`, at the commits its
`scripts/build/deps/` pins: mimalloc (Bun's fork; Copyright (c) 2018-2025
Microsoft Corporation, Daan Leijen), simdutf 9.0.0 (in WebKit's WTF; Copyright
2021 The simdutf authors), brotli 1.1.0 (Copyright (c) 2009, 2010, 2013-2016 by
the Brotli Authors), c-ares (Copyright (c) 1998 Massachusetts Institute of
Technology; Copyright (c) 2007 - 2023 Daniel Stenberg with many contributors,
see AUTHORS file), libdeflate (Copyright 2016 Eric Biggers; Copyright 2024
Google LLC), ls-hpack (Copyright (c) 2018 - 2023 LiteSpeed Technologies Inc),
ls-qpack (Copyright (c) 2018 - 2022 LiteSpeed Technologies Inc), lsquic
(Copyright (c) 2017 - 2026 LiteSpeed Technologies Inc), picohttpparser
(Copyright (c) 2009-2014 Kazuho Oku, Tokuhiro Matsuno, Daisuke Murase, Shigeo
Mitsunari; MIT License or the Perl license, used under MIT) and llhttp 9.3.0
(Copyright Fedor Indutny, 2018). Bun's Rust part adds these crates under the
MIT License: bcrypt 0.19.0 (Copyright (c) 2020 Vincent Prouillet), blake2b_simd
1.0.4 (Copyright (c) 2018 Jack O'Connor), derive_more 2.1.1 (Copyright (c) 2016
Jelte Fennema), generic-array 0.14.7 (Copyright (c) 2015 Bartłomiej Kamiński),
new_debug_unreachable 1.0.6 (Copyright (c) 2015 Jonathan Reem), phf 0.13.1 and
phf_shared 0.13.1 (Copyright (c) 2014-2022 Steven Fackler, Yuki Okushi),
precomputed-hash 0.1.1 (Copyright (c) 2017 Emilio Cobos Álvarez), strum 0.26.3
(Copyright (c) 2019 Peter Glotfelty) and typed-arena 2.0.2 (Copyright (c) 2018
The typed-arena developers).

## JavaScriptCore and WebKit — LGPL-2.0-or-later

Bun links JavaScriptCore, WTF and bmalloc statically from its fork of WebKit,
[oven-sh/WebKit](https://github.com/oven-sh/WebKit) at commit
`2e2aa2290fac856d6f451ceacb58f7f5b44dd057` (`WEBKIT_VERSION` in Bun's
`scripts/build/deps/webkit.ts` at `bun-v1.4.2`, which Bun's build fetches as
the prebuilt `bun-webkit-linux-arm64-android`), and Bun's own source carries
WebCore files from WebKit. All of it is inside `liboc-engine.so`. The parts
that come from KDE's KJS are under the GNU Library General Public License,
version 2 or (at your option) any later version: Copyright (C) 1999-2001 Harri
Porten; Copyright (C) 2001 Peter Kelly; and the others each file names, Apple
Inc. among them. Most other files are BSD-2-Clause, as in WebKit's
`LICENSE-APPLE` (Copyright (C) 2005, 2006, 2007, 2008, 2009 Apple Inc. All
rights reserved.), or BSD-3-Clause, each with its own holders. WTF also
carries double-conversion (BSD-3-Clause, Copyright 2006-2011, the V8 project
authors), simdutf (in the MIT group above), fast_float (Apache License 2.0, MIT
License or Boost Software License 1.0) and dragonbox (Boost Software License
1.0, which asks no notice for object code). We take the LGPL parts under
LGPL-2.1, as "any later version" allows. The LGPL-2.0 and LGPL-2.1 texts are in
the app's About screen.

Written offer: for at least three years after we last ship a build of
`liboc-engine.so`, we will give anyone who asks, for a charge no more than our
cost of performing the distribution, the complete corresponding source code of
JavaScriptCore and WebKit as linked in `liboc-engine.so`, with what you need to
relink it: Bun's source at tag `bun-v1.4.2`, and our build script and patches
in `agents/native/opencode/build/` (with the opencode and opentui sources its
`pins.env` names). Write to hi@phonecando.app. This is the written offer of
section 6(c) of the LGPL-2.1, and it is our promise whatever upstream does.
Today upstream publishes the same source at
<https://github.com/oven-sh/WebKit/tree/2e2aa2290fac856d6f451ceacb58f7f5b44dd057>
and <https://github.com/oven-sh/bun/tree/bun-v1.4.2>; Bun's `LICENSE.md` there
says how to relink Bun with a changed WebKit.

## ICU — Unicode-3.0

`liboc-engine.so` includes ICU 78 (libicuuc, libicui18n and the ICU data, with
its word-break dictionaries and time-zone data), linked statically through
Bun's WebKit build. Unicode License V3, Copyright © 2016-2025 Unicode, Inc.
Code from ICU 1.8.1 to ICU 57.1 is under the ICU License, Copyright (c)
1995-2016 International Business Machines Corporation and others. ICU's
`LICENSE` also names what its libraries take from others: the Chinese/Japanese
dictionary (Copyright (C) 2006-2008, Google Inc., BSD-3-Clause; word lists from
Libtabe, Copyright (c) 1999 TaBE Project, Copyright (c) 1999 Pai-Hsiang Hsiao,
Copyright (c) 1999 Computer Systems and Communication Lab, Institute of
Information Science, Academia Sinica, BSD-3-Clause, and Copyright 1996 Chih-Hao
Tsai @ Beckman Institute, University of Illinois; and from IPADIC, Copyright
2000, 2001, 2002, 2003 Nara Institute of Science and Technology, under its own
terms); the Lao dictionary (Copyright (C) 2016 and later: Unicode, Inc. and
others; Copyright (c) 2015 International Business Machines Corporation and
others; Copyright (C) 2013 Brian Eugene Wilson, Robert Martin Campbell,
BSD-2-Clause); the Burmese dictionary (Copyright (c) 2014 International
Business Machines Corporation and others; Copyright (c) 2013, LeRoy Benjamin
Sharon, BSD-3-Clause); time-zone data from the public-domain Time Zone
Database; and double-conversion (Copyright 2006-2011, the V8 project authors,
BSD-3-Clause). The Unicode License V3, the ICU License and IPADIC's terms are in
the app's About screen.

## BoringSSL, highway, uSockets and uWebSockets — Apache License 2.0

Bun links these into `liboc-engine.so`: BoringSSL (Bun's fork,
oven-sh/boringssl; Copyright The BoringSSL Authors; much of it derived from
OpenSSL, Copyright The OpenSSL Project Authors; and the other holders each
file names), highway (Copyright The Highway Project Authors; Apache License 2.0 or
BSD-3-Clause, used under Apache) and uSockets and uWebSockets (Bun's forks,
authored by Alex Hultman). Its Rust part adds these crates, each under the MIT
License or the Apache License 2.0 (some with a third choice) and used here
under the Apache License 2.0: allocator-api2 0.2.21, arrayvec 0.7.6, base64
0.22.1, bitflags 2.11.1, blake2 0.10.6, block-buffer 0.10.4, blowfish 0.9.1,
bstr 1.12.1, bytemuck 1.25.0, cfg-if 1.0.4, cipher 0.4.4, cpufeatures 0.2.17,
crossbeam-utils 0.8.21, crypto-common 0.1.7, digest 0.10.7, dtoa 1.0.11,
encoding_rs 0.8.35 (its code; its WHATWG data is BSD-3-Clause), enum-map 2.7.3,
enumset 1.1.10, equivalent 1.0.2, errno 0.3.14, getrandom 0.4.2, hashbrown
0.15.5 and 0.16.1, inout 0.1.4, itoa 1.0.18, keccak 0.1.6, libc 0.2.186,
linux-raw-sys 0.4.15, log 0.4.29, mime 0.3.17, rust-argon2 3.0.0, rustc-hash
2.1.2, rustix 0.38.44, scopeguard 1.2.0, servo_arc 0.4.3, sha3 0.10.9,
siphasher 1.0.3, smallvec 1.15.1, stable_deref_trait 1.2.1, thiserror 2.0.18,
typenum 1.20.0 and zeroize 1.8.2, and the Rust standard library (Copyright (c)
The Rust Project Contributors). The Apache License 2.0 text is in the app's
About screen.

## lol-html, libwebp, libjpeg-turbo and zstd — BSD-3-Clause

Bun links these into `liboc-engine.so`: lol-html 2.7.2 (a Rust crate, Bun's
fork of cloudflare/lol-html; Copyright (C) 2019, Cloudflare, Inc.), libwebp
(Copyright (c) 2010, Google Inc.; its PATENTS file adds Google's patent grant),
libjpeg-turbo (TurboJPEG: Copyright (C) 2009-2026 D. R. Commander; Copyright
(C) 2015 Viktor Szathmáry) and zstd (Copyright (c) Meta Platforms, Inc. and
affiliates; BSD-3-Clause or GPL-2.0, used under BSD-3-Clause). This software is
based in part on the work of the Independent JPEG Group: libjpeg-turbo's
libjpeg code is under the IJG License, copyright (C) 1991-2020, Thomas G. Lane,
Guido Vollbeding, and its SIMD code under the zlib License. Also BSD-3-Clause:
lsquic's portions from Chromium proto-quic (Copyright 2015 The Chromium
Authors), the subtle 2.6.1 crate (Copyright (c) 2016-2017 Isis Agora Lovecruft,
Henry de Valence; Copyright (c) 2016-2024 Isis Agora Lovecruft) and
encoding_rs's WHATWG data (Copyright © WHATWG (Apple, Google, Mozilla,
Microsoft)).

## libarchive and libspng — BSD-2-Clause

Bun links these into `liboc-engine.so`: libarchive (the distribution as a whole
Copyright by Tim Kientzle; Copyright (c) 2003-2018 the authors each file names;
its compress filter also carries 3-clause BSD code, Copyright (c) 1985, 1986,
1992, 1993 The Regents of the University of California) and libspng (Copyright
(c) 2018-2023, Randy <randy408@protonmail.com>; parts derived from libpng,
under the PNG Reference Library License version 2). Bun's Rust part adds the arrayref 0.3.9 crate
(Copyright (c) 2015 David Roundy). ls-hpack and libarchive also carry xxHash
(see xxHash below).

## zlib-ng — zlib License

Bun links zlib-ng 2.3.3 into `liboc-engine.so`: (C) 1995-2024 Jean-loup Gailly
and Mark Adler. Also under the zlib License: libjpeg-turbo's SIMD code (see
above) and these crates of Bun's Rust part: const_format 0.2.36 (Copyright (c)
2020 Matias Rodriguez), konst 0.2.20 and konst_macro_rules 0.2.19 (Copyright
(c) 2021 Matias Rodriguez) and foldhash 0.2.0 (Copyright (c) 2024 Orson
Peters). The zlib License text is in the app's About screen.

## cssparser, selectors and dtoa-short — MPL-2.0

Bun's Rust part links the cssparser 0.36.0 and selectors 0.33.0 crates from the
Servo project and dtoa-short 0.3.5 into `liboc-engine.so`, Mozilla Public
License 2.0. Bun's CSS parser (`src/css/` in its source) is derived from
Lightning CSS and Servo, both MPL-2.0 too. Their source is on crates.io at
those versions, Bun's at <https://github.com/oven-sh/bun/tree/bun-v1.4.2/src/css>,
and our written offer for JavaScriptCore and WebKit above covers them as well.
The MPL-2.0 text is in the app's About screen and at
<https://mozilla.org/MPL/2.0/>.

## SQLite and HdrHistogram_c — public domain

Bun links these into `liboc-engine.so`: SQLite 3.53.2 (`bun:sqlite` and
`node:sqlite`) and HdrHistogram_c (released to the public domain under CC0 1.0
by Gil Tene, Michael Barker, Matt Warren and Philip Orwig; also offered under
BSD-2-Clause). So are libarchive's `archive_parse_date.c` and these crates of
Bun's Rust part: byteorder 1.5.0 and memchr 2.8.0 (Unlicense, or MIT) and
constant_time_eq 0.4.2 (CC0 1.0, or MIT-0 or Apache-2.0). We use them on the
public-domain terms.

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

## AndroidX, Material Components, Kotlin and kotlinx — Apache License 2.0

The app, the PCE and the Linux runtime engine (`lre/`) use AndroidX, the Kotlin
standard library, kotlinx.coroutines and kotlinx.serialization
(`kotlinx-serialization-json` 1.8.1, which `lre/oci` brings into every
channel), Apache License 2.0. The app's bottom sheets use Material Components
for Android (`com.google.android.material`, through react-native-true-sheet),
Apache License 2.0. Copyright (C) The Android Open Source Project
(AndroidX, Material Components for Android); Copyright 2010-2024 JetBrains
s.r.o. and Kotlin Programming Language contributors (Kotlin); Copyright
2000-2020 JetBrains s.r.o. and Kotlin Programming Language contributors
(kotlinx.coroutines); Copyright 2017-2024 JetBrains s.r.o.
(kotlinx.serialization). The full license text is in the
app's About screen and at <https://www.apache.org/licenses/LICENSE-2.0>.

## XZ for Java — 0BSD

The Linux runtime engine (`lre/tar`) unpacks the Default Linux image's xz
stream with [XZ for Java](https://github.com/tukaani-project/xz-java) 1.10
(`org.tukaani:xz`), in every channel. BSD Zero Clause License (0BSD).
Copyright (C) The XZ for Java authors and contributors.

## llama.cpp, ggml, cpp-httplib and nlohmann/json — MIT License

Local models run on llama-server (`libllama-server.so`), built by
`lme/llamacpp/` from [ggml-org/llama.cpp](https://github.com/ggml-org/llama.cpp)
0.9.0 with our patches (`lme/llamacpp/patches/`: a chat template that
allows one system message takes requests with more), in every channel. MIT
License. Copyright (c) 2023-2026 The ggml authors
(llama.cpp and ggml); Copyright (c) 2017 yhirose (cpp-httplib); Copyright (c)
2013-2025 Niels Lohmann (nlohmann/json). The NDK's libc++, linked in
statically, is Apache-2.0 WITH LLVM-exception, whose exception asks no notice
for code compiled into a binary. Our build scripts and patches are under
the PhoneCanDo licence ([`LICENSE`](LICENSE)); see `lme/llamacpp/NOTICE.md`.

## KleidiAI — Apache License 2.0

`libllama-server.so` includes Arm's [KleidiAI](https://github.com/ARM-software/kleidiai)
1.32.0 CPU kernels. Apache License 2.0. Copyright 2024-2026 Arm Limited and/or
its affiliates.

## xxHash — BSD-2-Clause

`libllama-server.so` includes xxHash, vendored in llama.cpp. BSD 2-Clause
License. Copyright (c) 2012-2021 Yann Collet. `liboc-engine.so` has older
copies inside ls-hpack and libarchive: Copyright (C) 2012-2014, Yann Collet.
The full text is in the app's About screen.

## stb_image, miniaudio, SHA-1, SHA-256 and subprocess.h — public domain

`libllama-server.so` includes these, vendored in llama.cpp. Each is dedicated
to the public domain (subprocess.h through the Unlicense; stb_image and
miniaudio are also offered under MIT and MIT-0), and we use them on the
public-domain terms.

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
General Public License, version 2.1 or later. We build it with three patches of
ours (`lre/proot/patches/`): a missing include; `--status-fd` with
`--setsid`, so a command returns when it ends while what it started in the
background keeps running; and attaching with `PTRACE_SEIZE` instead of
`PTRACE_TRACEME`, so a job stopped by Ctrl-Z stays stopped until it is
continued.

talloc (LGPL-3.0-or-later, below) is linked statically into `libproot.so`,
and LGPL-3.0 code cannot be combined with code under GPL-2.0 only. So we ship
`libproot.so` under the GNU General Public License, version 3 or (at your
option) any later version, as PRoot's "or any later version" allows.
`libproot-loader.so` has no talloc and stays GPL-2.0-or-later, and so do our
build scripts in `lre/proot/`.

Corresponding source: the GitHub release of every app version that ships
PRoot (tag `v<app version>` at <https://github.com/krishna-kush/PhoneCanDo/releases>)
carries `phonecando-proot-<PRoot version>-source.tar.gz` among its assets: the
PRoot tree at the pinned commit, the talloc release tarball, and our build
scripts, pins, talloc build config and patches, with the rebuild steps in its
`SOURCES.txt`. Our build scripts, pins, talloc build config and patches in
`lre/proot/` are GPL-2.0-or-later too
([`lre/proot/LICENSE`](lre/proot/LICENSE)), like PRoot itself. The GPL-2.0,
GPL-3.0 and LGPL-2.1 texts are in the app's About screen.

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
