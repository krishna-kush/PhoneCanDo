# The machine the local-model check installs a kind into (x86_64): Debian
# (apt) with the runtimes our plugins pin already in place, Node.js and uv
# with CPython 3.12. The plugins' install scripts fetch the phone's arm64
# builds; here their checks pass, so the kind's rendered install skips them
# and runs the rest (packages, steps, version check) as the phone does.
# The versions are the plugins' pins (agents/runtimes/node/install/glibc.sh
# NODE_VERSION, agents/runtimes/python/install/uv.sh UV_VERSION and
# PYTHON_VERSION): bump them together, by hand, not by Dependabot.
FROM node:22.23.4-trixie-slim@sha256:be1e2a3dc2c4fd68cdfadad2a696a280e0d2749098bee509230174d72fb768c6
COPY --from=astral/uv:0.13.7@sha256:96f40d3904aad8d0bd010539001d36c8e2188b981e1334471a90c4a1d93bb490 /uv /uvx /usr/local/bin/
ENV HOME=/root
WORKDIR /root
RUN uv python install 3.12 && uv cache clean
