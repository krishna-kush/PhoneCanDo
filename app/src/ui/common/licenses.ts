// The Licenses dialog's text: an entry for every component the full, lite and
// play APKs ship, under the same names and licenses as THIRD_PARTY_NOTICES.md
// (.github/ci/js/check-licenses.mjs fails CI when they drift). Each heading
// is "<components> — <license>"; each distinct license's full text appears
// once, the long ones (GNU, Apache, MPL, Unicode, ICU, IPADIC) from
// ./license-texts/.
import { APACHE_2 } from './license-texts/apache2';
import { GPL_2 } from './license-texts/gpl2';
import { GPL_3 } from './license-texts/gpl3';
import { ICU_57 } from './license-texts/icu57';
import { IPADIC } from './license-texts/ipadic';
import { LGPL_2_0 } from './license-texts/lgpl20';
import { LGPL_2_1 } from './license-texts/lgpl21';
import { LGPL_3 } from './license-texts/lgpl3';
import { MPL_2 } from './license-texts/mpl2';
import { UNICODE_3 } from './license-texts/unicode3';

export const LICENSES = `PhoneCanDo is source-available. Copyright (c) 2026 Krishna Kushwaha.
The official app is the only distributed build. See the LICENSE file in the
repository.

Source code: every app includes JavaScriptCore and WebKit (LGPL) inside the
agent engine, liboc-engine.so, and the full and lite apps also include GPL and
LGPL components (PRoot, talloc and the Default Linux image). We publish the
complete corresponding source of PRoot, talloc and the image at
https://github.com/krishna-kush/PhoneCanDo/releases: PRoot and talloc with
every app release that ships them, the Debian source packages with each
linux-image release. JavaScriptCore and WebKit are covered by our written
offer: for at least three years after we last ship liboc-engine.so, anyone can
ask hi@phonecando.app for their complete corresponding source and what is
needed to relink it, for no more than the cost of distribution. Their entries
below say exactly where.

==============================================================================
opencode — MIT License
==============================================================================

Copyright (c) 2025 opencode

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

==============================================================================
xterm.js — MIT License
==============================================================================

Copyright (c) 2014 The xterm.js authors. All rights reserved.
Copyright (c) 2012-2013, Christopher Jeffrey (MIT License)

The MIT License text is the same as the opencode section above.

==============================================================================
Geist Mono — SIL Open Font License 1.1
==============================================================================

Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font.git)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
https://openfontlicense.org


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.

==============================================================================
NanoHTTPD — BSD-3-Clause
==============================================================================

NanoHTTPD 2.3.1, the loopback bridge's HTTP server.

Copyright (c) 2012-2013 by Paul S. Hawke, 2001,2005-2013 by Jarno Elonen, 2010 by Konstantinos Togias
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

* Neither the name of the NanoHttpd organization nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

==============================================================================
opentui, React Native, Expo, Tamagui and Zustand — MIT License
==============================================================================

Copyright (c) 2025 opentui
Copyright (c) Meta Platforms, Inc. and affiliates (React Native)
Copyright (c) 2015-present 650 Industries, Inc. (Expo)
Copyright (c) 2020 Nate Wienert and contributors (Tamagui)
Copyright (c) 2019 Paul Henschel (Zustand)

The MIT License text is the same as the opencode section above.

==============================================================================
AndroidX, Material Components, Kotlin and kotlinx — Apache License 2.0
==============================================================================

AndroidX, Material Components for Android (the bottom sheets), the Kotlin
standard library, kotlinx.coroutines and kotlinx.serialization
(kotlinx-serialization-json 1.8.1).

Copyright (C) The Android Open Source Project (AndroidX)
Copyright (C) The Android Open Source Project (Material Components for Android)
Copyright 2010-2024 JetBrains s.r.o. and Kotlin Programming Language contributors (Kotlin)
Copyright 2000-2020 JetBrains s.r.o. and Kotlin Programming Language contributors (kotlinx.coroutines)
Copyright 2017-2024 JetBrains s.r.o. (kotlinx.serialization)

Licensed under the Apache License, Version 2.0. The license text follows.

------------------------------------------------------------------------------

${APACHE_2}
==============================================================================
XZ for Java — 0BSD
==============================================================================

XZ for Java 1.10 (org.tukaani:xz), which unpacks the Default Linux image.

Copyright (C) The XZ for Java authors and contributors

Permission to use, copy, modify, and/or distribute this
software for any purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL
WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL
THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR
CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT,
NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

==============================================================================
llama.cpp, ggml, cpp-httplib and nlohmann/json — MIT License
==============================================================================

llama-server (libllama-server.so) 0.9.0 with our patches, which runs
local models.

Copyright (c) 2023-2026 The ggml authors (llama.cpp and ggml)
Copyright (c) 2017 yhirose (cpp-httplib)
Copyright (c) 2013-2025 Niels Lohmann (nlohmann/json)

The MIT License text is the same as the opencode section above.

==============================================================================
KleidiAI — Apache License 2.0
==============================================================================

KleidiAI 1.32.0, CPU kernels inside libllama-server.so.

Copyright 2024-2026 Arm Limited and/or its affiliates

The Apache License 2.0 text is the same as the AndroidX section above.

==============================================================================
xxHash — BSD-2-Clause
==============================================================================

xxHash, inside libllama-server.so, and older copies inside liboc-engine.so
(in ls-hpack and libarchive: Copyright (C) 2012-2014, Yann Collet).

xxHash Library
Copyright (c) 2012-2021 Yann Collet
All rights reserved.

BSD 2-Clause License (https://www.opensource.org/licenses/bsd-license.php)

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice, this
  list of conditions and the following disclaimer in the documentation and/or
  other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

==============================================================================
stb_image, miniaudio, SHA-1, SHA-256 and subprocess.h — public domain
==============================================================================

Inside libllama-server.so. Each is dedicated to the public domain
(subprocess.h through the Unlicense), and we use them on those terms.

==============================================================================
bun-pty — MIT License
==============================================================================

bun-pty 0.4.9, which opencode's bundle inside liboc-engine.so carries with
its prebuilt librust_pty_arm64.so (built for glibc Linux). MIT License,
Copyright (c) 2025 Dilip Thapa. Its Rust library is built from crates under
the MIT and Apache-2.0 licenses, which bun-pty's rust-pty/Cargo.lock lists.
The MIT License text is the same as the opencode section above.

==============================================================================
Bun — MIT License
==============================================================================

Bun 1.4.2, the runtime inside the agent engine liboc-engine.so (every app):
opencode built with bun build --compile into one executable around Bun's
official runtime for linux-arm64-android (pins in
agents/native/opencode/build/pins.env).

Bun's LICENSE.md: "Bun itself is MIT-licensed." It names no copyright holder.
Bun's JavaScript transpiler and module resolver are a port of esbuild:
Copyright (c) 2020 Evan Wallace (MIT License).

The entries that follow cover what Bun links statically or embeds, as its
LICENSE.md and docs/project/license.mdx at tag bun-v1.4.2 list it, and the
crates its Rust part links on Android. Bun's Android build leaves out TinyCC
(the C compiler behind bun:ffi's cc()) and libuv (Windows only). The NDK's
libc++, libc++abi and libunwind and LLVM's compiler-rt, linked in statically,
are Apache-2.0 WITH LLVM-exception, whose exception asks no notice for code
compiled into a binary; so is the __cxa_thread_atexit fallback from libc++abi
that Bun lists.

Bun's polyfills for bun build --target=browser (src/node-fallbacks, versions
in its bun.lock): assert 2.1.0, browserify-zlib 0.2.0 with pako 1.0.11,
crypto-browserify 3.12.1, domain-browser 4.23.0, https-browserify 1.0.0,
punycode 2.3.1, querystring-es3 1.0.0-0, react-refresh 0.17.0, readable-stream
4.7.0, stream-http 3.2.0 and string_decoder 1.3.0 with the small packages they
need, and code taken from Node.js (path, url, net, events, util), buffer 5.0.5
(with base64-js and ieee754) and process 0.11.10. MIT License, except where
noted:

Copyright Joyent, Inc. and other Node contributors (the Node.js code, assert, util, events)
Copyright Node.js contributors (readable-stream, string_decoder, querystring-es3)
Copyright (c) 2014-2015 Devon Govett (browserify-zlib)
Copyright (C) 2014-2017 by Vitaly Puzrin and Andrei Tuputcyn (pako; it also carries zlib License code)
Copyright (c) 2013 Dominic Tarr (crypto-browserify)
Copyright (c) James Halliday (https-browserify)
Copyright Mathias Bynens (punycode)
Copyright (c) Meta Platforms, Inc. and affiliates (react-refresh)
Copyright (c) 2015 John Hiesey (stream-http)
Copyright (c) Feross Aboukhadijeh, and other contributors (buffer)
Copyright (c) 2014 Jameson Little (base64-js)
Copyright (c) 2013 Roman Shtylman (process)
Copyright 2008 Fair Oaks Labs, Inc. (ieee754: BSD-3-Clause, as is part of sha.js)
Copyright © 2013+ Bevry Pty Ltd (domain-browser: Artistic License 2.0; source at https://github.com/bevry/domain-browser)
inherits, minimalistic-assert, browserify-sign and parse-asn1: ISC License

Each package keeps its full notice in its npm package at those versions. The
MIT License text is the same as the opencode section above.

==============================================================================
mimalloc, simdutf, brotli, c-ares, libdeflate, ls-hpack, ls-qpack, lsquic, picohttpparser and llhttp — MIT License
==============================================================================

Inside liboc-engine.so, from Bun, at the commits its scripts/build/deps/ pins.

Copyright (c) 2018-2025 Microsoft Corporation, Daan Leijen (mimalloc, Bun's fork)
Copyright 2021 The simdutf authors (simdutf 9.0.0, in WebKit's WTF)
Copyright (c) 2009, 2010, 2013-2016 by the Brotli Authors (brotli 1.1.0)
Copyright (c) 1998 Massachusetts Institute of Technology (c-ares)
Copyright (c) 2007 - 2023 Daniel Stenberg with many contributors, see AUTHORS file (c-ares)
Copyright 2016 Eric Biggers (libdeflate)
Copyright 2024 Google LLC (libdeflate)
Copyright (c) 2018 - 2023 LiteSpeed Technologies Inc (ls-hpack)
Copyright (c) 2018 - 2022 LiteSpeed Technologies Inc (ls-qpack)
Copyright (c) 2017 - 2026 LiteSpeed Technologies Inc (lsquic)
Copyright (c) 2009-2014 Kazuho Oku, Tokuhiro Matsuno, Daisuke Murase, Shigeo Mitsunari (picohttpparser; MIT License or the Perl license, used under MIT)
Copyright Fedor Indutny, 2018 (llhttp 9.3.0)

Crates in Bun's Rust part:
Copyright (c) 2020 Vincent Prouillet (bcrypt 0.19.0)
Copyright (c) 2018 Jack O'Connor (blake2b_simd 1.0.4)
Copyright (c) 2016 Jelte Fennema (derive_more 2.1.1)
Copyright (c) 2015 Bartłomiej Kamiński (generic-array 0.14.7)
Copyright (c) 2015 Jonathan Reem (new_debug_unreachable 1.0.6)
Copyright (c) 2014-2022 Steven Fackler, Yuki Okushi (phf 0.13.1, phf_shared 0.13.1)
Copyright (c) 2017 Emilio Cobos Álvarez (precomputed-hash 0.1.1)
Copyright (c) 2019 Peter Glotfelty (strum 0.26.3)
Copyright (c) 2018 The typed-arena developers (typed-arena 2.0.2)

The MIT License text is the same as the opencode section above.

==============================================================================
JavaScriptCore and WebKit — LGPL-2.0-or-later
==============================================================================

JavaScriptCore, WTF and bmalloc from oven-sh/WebKit (Bun's fork of WebKit) at
commit 2e2aa2290fac856d6f451ceacb58f7f5b44dd057, linked statically into
liboc-engine.so, and the WebCore files in Bun's own source.

The parts from KDE's KJS:
Copyright (C) 1999-2001 Harri Porten
Copyright (C) 2001 Peter Kelly
and the others each file names, Apple Inc. among them.

These parts are free software; you can redistribute them and/or modify them
under the terms of the GNU Library General Public License as published by the
Free Software Foundation; either version 2 of the License, or (at your option)
any later version. We take them under the LGPL-2.1. They are distributed in
the hope that they will be useful, but WITHOUT ANY WARRANTY; without even the
implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See
the GNU Library General Public License for more details.

Most other files are BSD-3-Clause (the text is NanoHTTPD's above, with each
file's holders) or BSD-2-Clause, as in WebKit's LICENSE-APPLE:

Copyright (C) 2005, 2006, 2007, 2008, 2009 Apple Inc. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:
1.  Redistributions of source code must retain the above copyright
    notice, this list of conditions and the following disclaimer.
2.  Redistributions in binary form must reproduce the above copyright
    notice, this list of conditions and the following disclaimer in the
    documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY APPLE INC. AND ITS CONTRIBUTORS \`\`AS IS'' AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL APPLE INC. OR ITS CONTRIBUTORS BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

WTF also carries double-conversion (BSD-3-Clause, Copyright 2006-2011, the V8
project authors), simdutf (MIT, in the entry above), fast_float (Apache
License 2.0, MIT License or Boost Software License 1.0) and dragonbox (Boost
Software License 1.0, which asks no notice for object code).

Written offer: for at least three years after we last ship a build of
liboc-engine.so, we will give anyone who asks, for a charge no more than our
cost of performing the distribution, the complete corresponding source code of
JavaScriptCore and WebKit as linked in liboc-engine.so, with what you need to
relink it: Bun's source at tag bun-v1.4.2, and our build script and patches in
agents/native/opencode/build/ (with the opencode and opentui sources its
pins.env names). Write to hi@phonecando.app. This is the written offer of
section 6(c) of the LGPL-2.1, and it is our promise whatever upstream does.
Today upstream publishes the same source at
https://github.com/oven-sh/WebKit/tree/2e2aa2290fac856d6f451ceacb58f7f5b44dd057
and https://github.com/oven-sh/bun/tree/bun-v1.4.2; Bun's LICENSE.md there
says how to relink Bun with a changed WebKit.

The LGPL-2.0 text follows; the LGPL-2.1 text is with PRoot's entry below.

------------------------------------------------------------------------------

${LGPL_2_0}
==============================================================================
ICU — Unicode-3.0
==============================================================================

ICU 78 (libicuuc, libicui18n and the ICU data, with its word break
dictionaries and time zone data), linked statically into liboc-engine.so
through Bun's WebKit build.

${UNICODE_3}
------------------------------------------------------------------------------

ICU's LICENSE file also lists the third-party parts its libraries include.

${ICU_57}

Chinese/Japanese word break dictionary data (cjdict.txt):
Copyright (C) 2006-2008, Google Inc. (BSD-3-Clause)
Its word lists come from Libtabe:
Copyright (c) 1999 TaBE Project. (BSD-3-Clause)
Copyright (c) 1999 Pai-Hsiang Hsiao. (BSD-3-Clause)
Copyright (c) 1999 Computer Systems and Communication Lab, Institute of
Information Science, Academia Sinica. (BSD-3-Clause)
Copyright 1996 Chih-Hao Tsai @ Beckman Institute, University of Illinois
and from IPADIC, under these terms:

${IPADIC}

Lao word break dictionary data (laodict.txt):
Copyright (C) 2016 and later: Unicode, Inc. and others.
Copyright (c) 2015 International Business Machines Corporation and others.
Copyright (C) 2013 Brian Eugene Wilson, Robert Martin Campbell. (BSD-2-Clause)

Burmese word break dictionary data (burmesedict.txt):
Copyright (c) 2014 International Business Machines Corporation and others.
Copyright (c) 2013, LeRoy Benjamin Sharon (BSD-3-Clause)

Time zone data: derived from the Time Zone Database, which is in the public
domain.

Google double-conversion:
Copyright 2006-2011, the V8 project authors. (BSD-3-Clause)

The BSD-3-Clause text is NanoHTTPD's above and the BSD-2-Clause text is
xxHash's above, each with the holders named here.

==============================================================================
BoringSSL, highway, uSockets and uWebSockets — Apache License 2.0
==============================================================================

Inside liboc-engine.so, from Bun.

Copyright The BoringSSL Authors (BoringSSL, Bun's fork)
Copyright The OpenSSL Project Authors (BoringSSL's code derived from OpenSSL; other files name further holders)
Copyright The Highway Project Authors (highway; Apache License 2.0 or BSD-3-Clause, used under Apache)
Authored by Alex Hultman (uSockets and uWebSockets, Bun's forks)

Crates in Bun's Rust part, each under the MIT License or the Apache License
2.0 (some with a third choice) and used here under the Apache License 2.0:
allocator-api2 0.2.21, arrayvec 0.7.6, base64 0.22.1, bitflags 2.11.1, blake2
0.10.6, block-buffer 0.10.4, blowfish 0.9.1, bstr 1.12.1, bytemuck 1.25.0,
cfg-if 1.0.4, cipher 0.4.4, cpufeatures 0.2.17, crossbeam-utils 0.8.21,
crypto-common 0.1.7, digest 0.10.7, dtoa 1.0.11, encoding_rs 0.8.35 (its code;
its WHATWG data is BSD-3-Clause), enum-map 2.7.3, enumset 1.1.10, equivalent
1.0.2, errno 0.3.14, getrandom 0.4.2, hashbrown 0.15.5 and 0.16.1, inout
0.1.4, itoa 1.0.18, keccak 0.1.6, libc 0.2.186, linux-raw-sys 0.4.15, log
0.4.29, mime 0.3.17, rust-argon2 3.0.0, rustc-hash 2.1.2, rustix 0.38.44,
scopeguard 1.2.0, servo_arc 0.4.3, sha3 0.10.9, siphasher 1.0.3, smallvec
1.15.1, stable_deref_trait 1.2.1, thiserror 2.0.18, typenum 1.20.0 and zeroize
1.8.2; and the Rust standard library (Copyright (c) The Rust Project
Contributors).

The Apache License 2.0 text is the same as the AndroidX section above.

==============================================================================
lol-html, libwebp, libjpeg-turbo and zstd — BSD-3-Clause
==============================================================================

Inside liboc-engine.so, from Bun.

Copyright (C) 2019, Cloudflare, Inc. (lol-html 2.7.2, a Rust crate; Bun's fork)
Copyright (c) 2010, Google Inc. (libwebp; its PATENTS file adds Google's patent grant)
Copyright (C) 2009-2026 D. R. Commander. All Rights Reserved. (libjpeg-turbo)
Copyright (C) 2015 Viktor Szathmáry. All Rights Reserved. (libjpeg-turbo)
Copyright (c) Meta Platforms, Inc. and affiliates. All rights reserved. (zstd; BSD-3-Clause or GPL-2.0, used under BSD-3-Clause)
Copyright 2015 The Chromium Authors. All rights reserved. (lsquic's portions from Chromium proto-quic)
Copyright (c) 2016-2017 Isis Agora Lovecruft, Henry de Valence. All rights reserved. (subtle 2.6.1 crate)
Copyright (c) 2016-2024 Isis Agora Lovecruft. All rights reserved. (subtle 2.6.1 crate)
Copyright © WHATWG (Apple, Google, Mozilla, Microsoft). (encoding_rs's WHATWG data)

This software is based in part on the work of the Independent JPEG Group.
libjpeg-turbo's libjpeg code is under the IJG License, copyright (C)
1991-2020, Thomas G. Lane, Guido Vollbeding; its SIMD code is under the zlib
License.

The BSD-3-Clause text is the same as the NanoHTTPD section above, with each
holder's name in its third clause.

==============================================================================
libarchive and libspng — BSD-2-Clause
==============================================================================

Inside liboc-engine.so, from Bun.

libarchive: the distribution as a whole is Copyright by Tim Kientzle;
Copyright (c) 2003-2018 the authors each file names. Its compress filter also
carries 3-clause BSD code: Copyright (c) 1985, 1986, 1992, 1993 The Regents of
the University of California. All rights reserved.
Copyright (c) 2018-2023, Randy <randy408@protonmail.com> (libspng; parts
derived from libpng, under the PNG Reference Library License version 2)
Copyright (c) 2015 David Roundy (arrayref 0.3.9 crate, in Bun's Rust part)

ls-hpack and libarchive also carry xxHash (its entry is above).

The BSD-2-Clause text is the same as the xxHash section above; the
BSD-3-Clause text, NanoHTTPD's above.

==============================================================================
zlib-ng — zlib License
==============================================================================

zlib-ng 2.3.3, inside liboc-engine.so, from Bun. Also under the zlib License:
libjpeg-turbo's SIMD code, and these crates in Bun's Rust part:
Copyright (c) 2020 Matias Rodriguez. (const_format 0.2.36)
Copyright (c) 2021 Matias Rodriguez. (konst 0.2.20, konst_macro_rules 0.2.19)
Copyright (c) 2024 Orson Peters (foldhash 0.2.0)

(C) 1995-2024 Jean-loup Gailly and Mark Adler

This software is provided 'as-is', without any express or implied
warranty. In no event will the authors be held liable for any damages
arising from the use of this software.

Permission is granted to anyone to use this software for any purpose,
including commercial applications, and to alter it and redistribute it
freely, subject to the following restrictions:

1. The origin of this software must not be misrepresented; you must not
   claim that you wrote the original software. If you use this software
   in a product, an acknowledgment in the product documentation would be
   appreciated but is not required.

2. Altered source versions must be plainly marked as such, and must not be
   misrepresented as being the original software.

3. This notice may not be removed or altered from any source distribution.

==============================================================================
cssparser, selectors and dtoa-short — MPL-2.0
==============================================================================

cssparser 0.36.0 and selectors 0.33.0 (from the Servo project) and dtoa-short
0.3.5: crates in Bun's Rust part, inside liboc-engine.so. Bun's CSS parser
(src/css in its source) is derived from Lightning CSS and Servo, both under
the MPL-2.0 too.

Source: the crates on crates.io at those versions; Bun's CSS parser at
https://github.com/oven-sh/bun/tree/bun-v1.4.2/src/css. Our written offer in
the JavaScriptCore and WebKit entry above covers them as well.

The MPL-2.0 text follows.

------------------------------------------------------------------------------

${MPL_2}
==============================================================================
SQLite and HdrHistogram_c — public domain
==============================================================================

Inside liboc-engine.so, from Bun: SQLite 3.53.2 (bun:sqlite and node:sqlite)
and HdrHistogram_c (released to the public domain under CC0 1.0 by Gil Tene,
Michael Barker, Matt Warren and Philip Orwig; also offered under
BSD-2-Clause). So are libarchive's archive_parse_date.c and these crates in
Bun's Rust part: byteorder 1.5.0 and memchr 2.8.0 (Unlicense, or MIT) and
constant_time_eq 0.4.2 (CC0 1.0, or MIT-0 or Apache-2.0). We use them on the
public-domain terms.

==============================================================================
Default Linux image (Debian-based) — per-package licenses
==============================================================================

The full and lite apps carry the Default Linux image: an arm64 root filesystem
built from Docker's official debian:trixie image with packages from
snapshot.debian.org. It is Debian-based, not Debian, and PhoneCanDo is not
affiliated with or endorsed by the Debian project. Each Debian package keeps
its own license (GPL, LGPL, MIT, BSD, Apache and others); its copyright and
license file is inside the image at /usr/share/doc/<package>/copyright.

Source: each image is published once as the GitHub prerelease
linux-image-<version> (the version is in /etc/phonecando-image inside the
image). Its phonecando-linux-default-<version>-sources-NN.tar assets hold the
exact Debian source packages of every installed package, at the installed
versions.

Debian is a registered trademark owned by Software in the Public Interest, Inc.

==============================================================================
PRoot — GPL-2.0-or-later
==============================================================================

PRoot (termux/proot) v5.1.107.102, in the full and lite apps as libproot.so
and libproot-loader.so.

Copyright (C) 2015 STMicroelectronics. PRoot was written at STMicroelectronics
by Cédric Vincent and the others its COPYING file names; Termux's fork adds
work by its contributors.

One header (src/extension/sysvipc/sysvipc_sys.h) carries definitions from the
GNU C Library: Copyright (C) 1995-2020 Free Software Foundation, Inc., under
the GNU Lesser General Public License, version 2.1 or later.

This program is free software; you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation; either version 2 of the License, or (at your option) any later
version. This program is distributed in the hope that it will be useful, but
WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
details.

talloc (LGPL-3.0-or-later, below) is linked statically into libproot.so, and
LGPL-3.0 code cannot be combined with code under GPL-2.0 only. So we ship
libproot.so under the GNU General Public License, version 3 or (at your
option) any later version, as PRoot's "or any later version" allows.
libproot-loader.so has no talloc and stays GPL-2.0-or-later, and so do our
build scripts in lre/proot/.

Source: the GitHub release of every app version that ships PRoot (tag
v<app version>) carries phonecando-proot-<PRoot version>-source.tar.gz: PRoot
at the pinned commit, the talloc tarball, and our build scripts, pins and
patches (GPL-2.0-or-later, lre/proot/LICENSE), with the rebuild steps in
SOURCES.txt.

The GPL-2.0 text follows, then the LGPL-2.1 text; the GPL-3.0 text is with
talloc's entry below.

------------------------------------------------------------------------------

${GPL_2}
------------------------------------------------------------------------------

${LGPL_2_1}
==============================================================================
talloc — LGPL-3.0-or-later
==============================================================================

talloc 2.5.0, linked statically into libproot.so (full and lite apps only).

Copyright (C) Andrew Tridgell 2004-2005
Copyright (C) Stefan Metzmacher 2006
libreplace (lib/replace/replace.h, same license):
Copyright (C) Andrew Tridgell 2005
Copyright (C) Jelmer Vernooij 2006-2008
Copyright (C) Jeremy Allison 2007

This library is free software; you can redistribute it and/or modify it under
the terms of the GNU Lesser General Public License as published by the Free
Software Foundation; either version 3 of the License, or (at your option) any
later version. This library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License
for more details.

Relinking: phonecando-proot-<PRoot version>-source.tar.gz (see PRoot above)
holds the talloc tarball and the scripts that build it and link it into
libproot.so, so you can rebuild libproot.so with a modified talloc.

The LGPL-3.0 text follows, then the GPL-3.0 text it incorporates.

------------------------------------------------------------------------------

${LGPL_3}
------------------------------------------------------------------------------

${GPL_3}
==============================================================================

Other npm dependencies are licensed under their respective terms. The
repository's THIRD_PARTY_NOTICES.md lists the main bundled components.
`;
