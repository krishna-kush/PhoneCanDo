# llama.cpp payload: notices

## Our scripts

The files in this folder (`pins.env`, `build.sh`, `build-host.sh`,
`verify.sh`, `stage.sh`, our patches in `patches/` and this notice) are part
of PhoneCanDo and under its licence, the PhoneCanDo Source-Available License
(`../../LICENSE`). Their versions in the commits before the one that moved
them to that licence were published under the MIT License, and those
versions stay under it. The MIT License does not cover any later change.
llama.cpp and KleidiAI keep their own licences (below) and are downloaded at
build time, never stored here.

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
