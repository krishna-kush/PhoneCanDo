#!/usr/bin/env python3
"""Check a built Default env image against its manifest and our rules.

Usage: python3 -I lre/images/default/verify.py <out-dir>
  <out-dir> is build.sh's: exactly one phonecando-linux-default-*.json
  manifest, the .tar.xz it names and its .sha256 (packages.tsv, when there,
  is counted against the manifest).

Checks: sha256 and sizes match the manifest; the tar is deterministic
(names in --sort=name order, every mtime SOURCE_DATE_EPOCH, uid/gid 0 with
no names, no xattr/ACL/SELinux/atime/ctime records, only files, dirs,
symlinks and hardlinks); /dev, /proc and /sys are empty dirs; no docker
leftovers, apt lists, caches or logs; no man/info pages or translations;
under /usr/share/doc only copyright files, and every installed package has
one; our baked files (marker matching the manifest, apt sandbox, locale,
hosts) and the Standard set's commands are there.
Markdown on stdout; exit 1 on any failed check.
"""
import hashlib
import json
import lzma
import sys
import tarfile
from pathlib import Path

ALLOWED_TYPES = {tarfile.REGTYPE, tarfile.AREGTYPE, tarfile.DIRTYPE, tarfile.SYMTYPE, tarfile.LNKTYPE}
BAD_PAX = ("SCHILY.xattr.", "LIBARCHIVE.xattr.", "SCHILY.acl.", "RHT.security.selinux", "atime", "ctime")
COMMANDS = ("bash", "sh", "git", "rg", "python3", "pip", "pip3", "curl", "nano", "less", "ps",
            "ssh", "zip", "unzip", "xz", "apt-get", "dpkg")
GONE = ("var/lib/apt/lists/", "var/log/apt/", "var/cache/ldconfig/aux-cache", "tmp/", "var/tmp/")
READ = ("etc/phonecando-image", "etc/apt/apt.conf.d/99phonecando-proot", "etc/default/locale",
        "etc/hosts", "etc/hostname", "etc/resolv.conf", "var/lib/dpkg/status")


def norm(name):
    """Tar name without ./ and trailing /: '' is the root."""
    name = name[2:] if name.startswith("./") else name
    return "" if name in (".", "./") else name.rstrip("/")


def key(name):
    return tuple(name.split("/")) if name else ()


class Counting:
    """File wrapper that counts and hashes the bytes read through it."""

    def __init__(self, f):
        self.f, self.n, self.h = f, 0, hashlib.sha256()

    def read(self, size=-1):
        b = self.f.read(size)
        self.n += len(b)
        self.h.update(b)
        return b


def scan(path):
    """One pass over the image: member records, wanted file contents, sizes."""
    members, texts, links = [], {}, {}
    with open(path, "rb") as raw:
        outer = Counting(raw)
        with lzma.open(outer) as xz:
            inner = Counting(xz)
            with tarfile.open(fileobj=inner, mode="r|") as t:
                for m in t:
                    name = norm(m.name)
                    members.append((name, m.type, m.mtime, m.uid, m.gid, m.uname, m.gname,
                                    m.devmajor, m.devminor, dict(m.pax_headers)))
                    if m.issym():
                        links[name] = m.linkname
                    if m.isfile() and name in READ:
                        texts[name] = t.extractfile(m).read().decode("utf-8", "replace")
            while inner.read(1 << 20):
                pass
    return members, texts, links, outer.n, outer.h.hexdigest(), inner.n


def status_packages(status):
    pkgs, cur = [], {}
    for line in (status + "\n\n").splitlines():
        if not line.strip():
            if cur.get("Status", "").endswith("installed") and "Package" in cur:
                pkgs.append(cur["Package"])
            cur = {}
        elif not line[0].isspace() and ":" in line:
            k, v = line.split(":", 1)
            cur[k] = v.strip()
    return sorted(set(pkgs))


def env_lines(text):
    return dict(l.split("=", 1) for l in text.splitlines() if "=" in l and not l.startswith("#"))


def checks(manifest, members, texts, links, sizes):
    """Yields (check, ok, detail); pure."""
    xz_bytes, xz_sha, tar_bytes, sha_file = sizes
    yield "sha256 = manifest = .sha256", xz_sha == manifest["sha256"] == sha_file, f"`{xz_sha[:16]}…`"
    yield "size = manifest", xz_bytes == manifest["size"], f"{xz_bytes} bytes"
    yield "tar size and entries = manifest", tar_bytes == manifest["tar_size"] and len(members) == manifest["entries"], \
        f"{tar_bytes} bytes, {len(members)} entries"

    names = [m[0] for m in members]
    order_bad = next((b for a, b in zip(names, names[1:]) if key(a) >= key(b)), None)
    yield "names in --sort=name order, no duplicates", order_bad is None, order_bad and f"at `{order_bad}`" or ""
    sde = manifest["source_date_epoch"]
    bad = [m[0] for m in members if m[2] != sde]
    yield f"every mtime = SOURCE_DATE_EPOCH ({sde})", not bad, bad and f"{len(bad)}, e.g. `{bad[0]}`" or ""
    bad = [m[0] for m in members if m[3] or m[4] or m[5] or m[6]]
    yield "uid/gid 0, no user/group names", not bad, bad and f"{len(bad)}, e.g. `{bad[0]}`" or ""
    bad = [m[0] for m in members if m[1] not in ALLOWED_TYPES or m[7] or m[8]]
    yield "only files, dirs, symlinks, hardlinks (no device nodes)", not bad, bad and f"`{bad[0]}`" or ""
    bad = [m[0] for m in members if any(k.startswith(BAD_PAX) for k in m[9])]
    yield "no xattr/ACL/SELinux/atime/ctime records", not bad, bad and f"`{bad[0]}`" or ""

    kinds = {m[0]: m[1] for m in members}
    for d in ("dev", "proc", "sys"):
        yield f"/{d} is an empty dir", kinds.get(d) == tarfile.DIRTYPE and not any(n.startswith(d + "/") for n in names), ""
    yield "no /.dockerenv", ".dockerenv" not in kinds, ""
    bad = [n for n in names if kinds[n] != tarfile.DIRTYPE and n.startswith(GONE)]
    bad += [n for n in names if n.startswith("var/log/") and n.endswith(".log")]
    bad += [n for n in names if n.startswith("var/cache/apt/") and n.endswith(".bin")]
    bad += [n for n in names if n.startswith(("var/lib/dpkg/", "var/cache/debconf/")) and n.endswith("-old")]
    yield "no apt lists, caches, logs, tmp files or -old backups", not bad, bad and f"`{bad[0]}`" or ""
    bad = [n for n in names if kinds[n] != tarfile.DIRTYPE
           and n.startswith(("usr/share/man/", "usr/share/info/", "usr/share/groff/", "usr/share/lintian/"))]
    bad += [n for n in names if n.startswith("usr/share/locale/") and kinds[n] != tarfile.DIRTYPE
            and n != "usr/share/locale/locale.alias"]
    yield "no man/info pages or translations", not bad, bad and f"{len(bad)}, e.g. `{bad[0]}`" or ""
    bad = [n for n in names if n.startswith("usr/share/doc/") and n.count("/") >= 4
           and kinds[n] != tarfile.DIRTYPE and not n.endswith("/copyright")]
    yield "under /usr/share/doc only copyright files", not bad, bad and f"{len(bad)}, e.g. `{bad[0]}`" or ""

    pkgs = status_packages(texts.get("var/lib/dpkg/status", ""))

    def has_copyright(pkg):
        d = f"usr/share/doc/{pkg}"
        if d in links:
            d = f"usr/share/doc/{links[d]}" if "/" not in links[d] else norm(links[d].lstrip("/"))
        return f"{d}/copyright" in kinds

    bad = [p for p in pkgs if not has_copyright(p)]
    yield f"every installed package ({len(pkgs)}) has its copyright file", pkgs and not bad, \
        bad and f"missing: {', '.join(bad[:5])}" or ""
    if "packages" in manifest:
        yield "installed packages = manifest", len(pkgs) == manifest["packages"], f"{len(pkgs)}"

    marker = env_lines(texts.get("etc/phonecando-image", ""))
    want = {"NAME": manifest["name"], "VERSION": manifest["version"], "DEBIAN_DIGEST": manifest["debian"]["digest"],
            "DEBIAN_SNAPSHOT": manifest["debian"]["snapshot"], "RECIPE_SHA256": manifest["recipe_sha256"]}
    yield "/etc/phonecando-image matches the manifest", all(marker.get(k) == v for k, v in want.items()), \
        f"`{marker.get('VERSION')}`"
    yield "apt sandbox user root (proot)", 'APT::Sandbox::User "root";' in texts.get(
        "etc/apt/apt.conf.d/99phonecando-proot", ""), ""
    yield "default locale C.UTF-8", "LANG=C.UTF-8" in texts.get("etc/default/locale", ""), ""
    yield "our hosts, hostname, resolv.conf", "localhost" in texts.get("etc/hosts", "") and \
        texts.get("etc/hostname", "").strip() and "nameserver" in texts.get("etc/resolv.conf", ""), ""
    missing = [c for c in COMMANDS if f"usr/bin/{c}" not in kinds]
    missing += [p for p in ("etc/ssl/certs/ca-certificates.crt", "usr/lib/python3.13/venv/__init__.py",
                            "usr/lib/python3.13/ensurepip/__init__.py") if p not in kinds]
    yield "Standard set present", not missing, missing and f"missing: {', '.join(missing)}" or \
        f"{len(COMMANDS)} commands, CA bundle, venv"


def main(argv):
    if len(argv) != 2:
        sys.exit(__doc__.strip().split("\n\n")[1])
    out = Path(argv[1])
    found = sorted(out.glob("phonecando-linux-default-*.json"))
    if len(found) != 1:
        sys.exit(f"verify: want exactly one manifest in {out}, found {len(found)}")
    manifest = json.loads(found[0].read_text())
    image = out / manifest["asset"]
    sha_file = (out / f"{manifest['asset']}.sha256").read_text().split()
    if sha_file[1:] != [manifest["asset"]]:
        sys.exit(f"verify: {manifest['asset']}.sha256 does not name {manifest['asset']}")
    members, texts, links, xz_bytes, xz_sha, tar_bytes = scan(image)
    results = list(checks(manifest, members, texts, links, (xz_bytes, xz_sha, tar_bytes, sha_file[0])))
    tsv = out / "packages.tsv"
    if tsv.exists():
        n = sum(1 for l in tsv.read_text().splitlines() if l.strip())
        results.append(("packages.tsv = manifest", n == manifest["packages"], f"{n} packages"))

    hard = sum(1 for m in members if m[1] == tarfile.LNKTYPE)
    print(f"### Default env image `{manifest['version']}` ({manifest['arch']})")
    print()
    print(f"- `{manifest['asset']}`: {xz_bytes / 2**20:.1f} MiB xz, {tar_bytes / 2**20:.1f} MiB tar "
          f"({xz_bytes / tar_bytes:.1%}), {len(members)} entries ({hard} hardlinks)")
    print(f"- Debian {manifest['debian']['version']} `{manifest['debian']['digest']}`, "
          f"snapshot `{manifest['debian']['snapshot']}`, xz {manifest['tools']['xz']}, tar {manifest['tools']['tar']}")
    print()
    print("| Check | | Detail |")
    print("|---|---|---|")
    failed = 0
    for what, ok, detail in results:
        failed += not ok
        print(f"| {what} | {'OK' if ok else '**FAIL**'} | {detail or ''} |")
    print()
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
