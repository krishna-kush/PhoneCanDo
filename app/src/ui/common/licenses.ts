// The Licenses dialog's text: an entry for every component the full, lite and
// play APKs ship, under the same names and licenses as THIRD_PARTY_NOTICES.md
// (.github/ci/js/check-licenses.mjs fails CI when they drift). Each heading
// is "<components> — <license>"; each distinct license's full text appears
// once, the long GNU and Apache texts from ./license-texts/.
import { APACHE_2 } from './license-texts/apache2';
import { GPL_2 } from './license-texts/gpl2';
import { GPL_3 } from './license-texts/gpl3';
import { LGPL_2_1 } from './license-texts/lgpl21';
import { LGPL_3 } from './license-texts/lgpl3';

export const LICENSES = `PhoneCanDo is source-available. Copyright (c) 2026 Krishna Kushwaha.
The official app is the only distributed build. See the LICENSE file in the
repository.

Source code: the full and lite apps include GPL and LGPL components (PRoot,
talloc and the Default Linux image). We publish their complete corresponding
source at https://github.com/krishna-kush/PhoneCanDo/releases: PRoot and
talloc with every app release that ships them, the Debian source packages with
each linux-image release. Their entries below say exactly where.

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
AndroidX, Kotlin and kotlinx — Apache License 2.0
==============================================================================

AndroidX, the Kotlin standard library, kotlinx.coroutines and
kotlinx.serialization (kotlinx-serialization-json 1.8.1).

Copyright (C) The Android Open Source Project (AndroidX)
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

Source: the GitHub release of every app version that ships PRoot (tag
v<app version>) carries phonecando-proot-<PRoot version>-source.tar.gz: PRoot
at the pinned commit, the talloc tarball, and our build scripts, pins and
patches (MIT License, lre/proot/LICENSE), with the rebuild steps in
SOURCES.txt.

The GPL-2.0 text follows, then the LGPL-2.1 text.

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
