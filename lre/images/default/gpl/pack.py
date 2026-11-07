#!/usr/bin/env python3
"""Pack fetched source packages into deterministic release assets.

Usage: python3 -I lre/images/default/gpl/pack.py <dir> <out-prefix> <mtime> [max-bytes]
  <dir>         fetch.py's dir (<source>/<files>)
  <out-prefix>  writes <out-prefix>-01.tar, -02.tar, ... (uncompressed: the
                files are compressed already) and <out-prefix>-index.tsv
                ("<part>\\t<source>/<file>\\t<size>\\t<sha256>")
  <mtime>       every entry's mtime (the image's SOURCE_DATE_EPOCH)
  [max-bytes]   per part, default 1900 MiB (GitHub's asset limit is 2 GiB)

A source package's files always share a part; parts fill in name order.
Entries: sorted, uid/gid 0 without names, 0644 files, 0755 dirs, POSIX
format. Prints one JSON line per asset: {"asset", "size", "sha256"}.
"""
import hashlib
import json
import sys
import tarfile
from pathlib import Path

DEFAULT_MAX = 1900 * 2**20
OVERHEAD = 3 * 512  # header, pax header, padding: a safe bound per entry


def plan(sources, max_bytes):
    """Pure: [(source, [(name, size)])] -> parts, each a list of sources."""
    parts, cur, used = [], [], 0
    for source, files in sources:
        need = OVERHEAD + sum(OVERHEAD + size for _, size in files)
        if need + 2 * 512 > max_bytes:
            raise ValueError(f"{source} alone is over {max_bytes} bytes")
        if cur and used + need + 2 * 512 > max_bytes:
            parts.append(cur)
            cur, used = [], 0
        cur.append((source, files))
        used += need
    if cur:
        parts.append(cur)
    return parts


def info(name, mtime, size=0, is_dir=False):
    ti = tarfile.TarInfo(name)
    ti.type = tarfile.DIRTYPE if is_dir else tarfile.REGTYPE
    ti.mode = 0o755 if is_dir else 0o644
    ti.size = size
    ti.mtime = mtime
    ti.uid = ti.gid = 0
    ti.uname = ti.gname = ""
    return ti


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def main(argv):
    if len(argv) not in (4, 5):
        sys.exit(__doc__.strip().split("\n\n")[1])
    root, prefix, mtime = Path(argv[1]), argv[2], int(argv[3])
    max_bytes = int(argv[4]) if len(argv) == 5 else DEFAULT_MAX
    sources = []
    for d in sorted(p for p in root.iterdir() if p.is_dir()):
        files = sorted((f.name, f.stat().st_size) for f in d.iterdir() if f.is_file() and not f.name.endswith(".part"))
        if files:
            sources.append((d.name, files))
    try:
        parts = plan(sources, max_bytes)
    except ValueError as e:
        sys.exit(f"pack: {e}")
    Path(prefix).parent.mkdir(parents=True, exist_ok=True)
    index = []
    for n, part in enumerate(parts, 1):
        out = Path(f"{prefix}-{n:02d}.tar")
        with tarfile.open(out, "w", format=tarfile.PAX_FORMAT) as tar:
            for source, files in part:
                tar.addfile(info(f"{source}/", mtime, is_dir=True))
                for name, size in files:
                    path = root / source / name
                    with open(path, "rb") as f:
                        tar.addfile(info(f"{source}/{name}", mtime, size), f)
                    index.append(f"{out.name}\t{source}/{name}\t{size}\t{sha256(path)}")
        print(json.dumps({"asset": out.name, "size": out.stat().st_size, "sha256": sha256(out)}))
    idx = Path(f"{prefix}-index.tsv")
    idx.write_text("".join(f"{line}\n" for line in index))
    print(json.dumps({"asset": idx.name, "size": idx.stat().st_size, "sha256": sha256(idx)}))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
