#!/usr/bin/env python3
"""Download the source packages resolve.py listed, verified.

Usage: python3 -I lre/images/default/gpl/fetch.py <resolved.json> <dir>
  <dir>/<source>/ gets each source package's files, so
  `dpkg-source -x <dir>/<source>/<source>_<version>.dsc` unpacks it.

The .dsc files come first: a source package is exactly the files its .dsc
names, so other files snapshot.debian.org lists for the same upload (such
as tag2upload's <source>_<version>.git.tar.xz, a git history) are skipped.
Each file must match the sha1 and size snapshot.debian.org listed (URLs
tried in order: deb.debian.org's pool, then snapshot's content store), and
every file a .dsc names must match its Checksums-Sha256. A verified file
already in <dir> is kept, so a rerun only fetches what is missing; any other
file there is removed (<dir> is fetch's own).
Exits 1 if anything is missing or does not verify.
"""
import hashlib
import json
import os
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

UA = {"User-Agent": "phonecando-image-sources/1 (+https://github.com)"}


def digest(path, algo):
    h = hashlib.new(algo)
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def ok(path, entry):
    return path.is_file() and path.stat().st_size == entry["size"] and digest(path, "sha1") == entry["sha1"]


def fetch(job):
    path, entry = job
    if ok(path, entry):
        return None
    part = path.with_name(path.name + ".part")
    for url in entry["urls"]:
        for attempt in range(3):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r, \
                        open(part, "wb") as out:
                    for block in iter(lambda: r.read(1 << 20), b""):
                        out.write(block)
                os.replace(part, path)
                if ok(path, entry):
                    return None
                break  # wrong bytes from this URL: try the next one
            except OSError:
                time.sleep(3 * (attempt + 1))
    part.unlink(missing_ok=True)
    return f"{path.parent.name}/{entry['name']}: no URL gave sha1 {entry['sha1']}"


def dsc_sha256(text):
    """Pure: Checksums-Sha256 of a .dsc -> {name: sha256}."""
    block = re.search(r"^Checksums-Sha256:\n((?:[ \t].*\n?)+)", text, re.M)
    out = {}
    for line in (block.group(1).splitlines() if block else []):
        parts = line.split()
        if len(parts) == 3:
            out[parts[2]] = parts[0]
    return out


def main(argv):
    if len(argv) != 3:
        sys.exit(__doc__.strip().split("\n\n")[1])
    resolved = json.loads(Path(argv[1]).read_text())
    root = Path(argv[2])
    listed, errors = {}, []
    for src in resolved["sources"]:
        d = root / src["source"]
        d.mkdir(parents=True, exist_ok=True)
        if not any(e["name"].endswith(".dsc") for e in src["files"]):
            errors.append(f"{src['source']} {src['version']}: no .dsc listed")
        for entry in src["files"]:
            path = d / entry["name"]
            if path in listed and listed[path]["sha1"] != entry["sha1"]:
                sys.exit(f"fetch: {path} listed twice with different contents")
            listed[path] = entry

    dscs = [(p, e) for p, e in listed.items() if p.name.endswith(".dsc")]
    with ThreadPoolExecutor(max_workers=4) as pool:
        errors += [e for e in pool.map(fetch, dscs) if e]
        named = {}  # path -> the sha256 its .dsc names (None for the .dsc)
        for dsc, _ in dscs:
            named[dsc] = None
            if dsc.is_file():
                text = dsc.read_text(encoding="utf-8", errors="replace")
                named.update((dsc.parent / name, sha) for name, sha in dsc_sha256(text).items())
        jobs = [(p, e) for p, e in listed.items() if p in named]
        # <dir> is ours: anything else there (skipped, or from an earlier
        # resolve) would otherwise end up in the bundle.
        for d in sorted(p for p in root.iterdir() if p.is_dir()):
            for f in sorted(d.iterdir()):
                if f.is_file() and f not in named:
                    f.unlink()
        errors += [e for e in pool.map(fetch, jobs) if e]

    for path, sha in sorted(named.items()):
        if sha is not None and (not path.is_file() or digest(path, "sha256") != sha):
            errors.append(f"{path.parent.name}/{path.name}: missing or not the sha256 its .dsc names")
    total = sum(p.stat().st_size for p, _ in jobs if p.is_file())
    skipped = [e for p, e in listed.items() if p not in named]
    print(f"fetched {len(jobs)} files for {len(resolved['sources'])} source packages, {total / 2**20:.1f} MiB; "
          f"skipped {len(skipped)} that no .dsc names, {sum(e['size'] for e in skipped) / 2**20:.1f} MiB")
    for e in errors:
        print(f"fetch FAIL: {e}", file=sys.stderr)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
