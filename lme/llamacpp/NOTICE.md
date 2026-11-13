# llama.cpp payload: notices

## Our scripts

The files in this folder (`pins.env`, `build.sh`, `build-host.sh`,
`verify.sh`, `stage.sh`, our patches in `patches/` and this notice) are
under the MIT License below. It does not cover the rest of the PhoneCanDo
repository, which keeps its own licence (`../../LICENSE`). llama.cpp and
KleidiAI are downloaded at build time, never stored here.

```
MIT License

Copyright (c) 2026 Krishna Kushwaha

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
```

## What `libllama-server.so` contains

Built by `build.sh` from the versions in `pins.env`, with our patches
(`patches/`: a chat template that allows one system message takes
requests with more, and `/slots` gives the whole prompt of each request), everything linked in statically. Each licence text
ships in the source archive named.

| Component | Version | Licence | Where in the source |
|---|---|---|---|
| llama.cpp and ggml (The ggml authors) | 0.9.0 | MIT | `LICENSE` |
| KleidiAI (Arm Limited) | 1.32.0 | Apache-2.0 | kleidiai `LICENSES/Apache-2.0.txt` |
| cpp-httplib (yhirose) | vendored in llama.cpp | MIT | `vendor/cpp-httplib/LICENSE` |
| nlohmann/json (Niels Lohmann) | vendored in llama.cpp | MIT | `licenses/LICENSE-jsonhpp` |
| stb_image (Sean Barrett) | vendored in llama.cpp | public domain or MIT | `vendor/stb/stb_image.h` |
| miniaudio (David Reid) | vendored in llama.cpp | public domain or MIT-0 | `vendor/miniaudio/miniaudio.h` |
| xxHash (Yann Collet) | vendored in llama.cpp | BSD-2-Clause | `vendor/hash/xxhash/LICENSE` |
| SHA-1, SHA-256 (Steve Reid, Igor Pavlov) | vendored in llama.cpp | public domain | `vendor/hash/` |
| subprocess.h (Neil Henning) | vendored in llama.cpp | Unlicense | `vendor/sheredom/subprocess.h` |
| libc++, libc++abi (LLVM, from the NDK) | NDK r28c | Apache-2.0 WITH LLVM-exception | the NDK |

An app release that ships the binary lists these in
`THIRD_PARTY_NOTICES.md` and `app/src/ui/common/licenses.ts` together.
