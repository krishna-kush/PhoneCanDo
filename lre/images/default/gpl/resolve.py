#!/usr/bin/env python3
"""Resolve the exact Debian source packages behind an image (GPL duty).

Usage: python3 -I lre/images/default/gpl/resolve.py <sources.tsv> <resolved.json>
  <sources.tsv>  pack.sh's "<source>\\t<version>" lines: every installed
                 package's source plus its Built-Using/Static-Built-Using
  <resolved.json> gets every file of every source package (.dsc, orig and
                 debian tarballs): name, sha1, size and the URLs to fetch it
                 from (deb.debian.org's pool first, snapshot.debian.org's
                 content store as the fallback that keeps every version ever
                 published)

Looks each (source, version) up in snapshot.debian.org's machine-readable
API (/mr/package/<source>/<version>/srcfiles?fileinfo=1), so versions that
left the archive still resolve. Prints the total size; exits 1 naming every
source it could not find.
"""
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

API = "https://snapshot.debian.org/mr/package/{}/{}/srcfiles?fileinfo=1"
ARCHIVES = ("debian", "debian-security")  # preferred archive_name, in order
UA = {"User-Agent": "phonecando-image-sources/1 (+https://github.com)"}


def get_json(url, tries=4):
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            err = e
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            err = e
        time.sleep(2 ** attempt * 3)
    raise RuntimeError(f"{url}: {err}")


def files_of(source, version, info):
    """Pure: the API answer -> [{name, sha1, size, urls}].

    snapshot stores files by content, so one sha1 lists every name it was
    ever published under (another source's identical orig tarball, or the
    same source's older upstream version). The name we keep is the one this
    version's .dsc uses: <source>_<upstream version>..., in its pool dir.
    """
    bare = version.split(":", 1)[-1]
    upstream = bare.rsplit("-", 1)[0] if "-" in bare else bare
    prefix = f"{source}_{upstream}"

    def rank(s):
        return (not s["name"].startswith(prefix), not s["path"].endswith("/" + source),
                ARCHIVES.index(s["archive_name"]) if s["archive_name"] in ARCHIVES else len(ARCHIVES))

    out = []
    for item in info.get("result", []):
        sha1 = item["hash"]
        seen = sorted(info["fileinfo"].get(sha1, []), key=rank)
        if not seen:
            raise ValueError(f"{source} {version}: no fileinfo for {sha1}")
        first = seen[0]
        urls = [f"https://deb.debian.org/{s['archive_name']}{s['path']}/{s['name']}"
                for s in seen if s["archive_name"] in ARCHIVES]
        urls.append(f"https://snapshot.debian.org/file/{sha1}")
        out.append({"name": first["name"], "sha1": sha1, "size": first["size"], "urls": list(dict.fromkeys(urls))})
    return sorted(out, key=lambda f: f["name"])


def resolve(pair):
    source, version = pair
    info = get_json(API.format(urllib.parse.quote(source, safe=""), urllib.parse.quote(version, safe="")))
    if not info:
        return source, version, None
    return source, version, files_of(source, version, info)


def main(argv):
    if len(argv) != 3:
        sys.exit(__doc__.strip().split("\n\n")[1])
    pairs = []
    for line in open(argv[1], encoding="utf-8"):
        if line.strip():
            source, version = line.rstrip("\n").split("\t")
            pairs.append((source, version))
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(resolve, sorted(set(pairs))))
    missing = [f"{s} {v}" for s, v, files in results if files is None]
    sources = [{"source": s, "version": v, "files": files} for s, v, files in results if files is not None]
    total = sum(f["size"] for src in sources for f in src["files"])
    with open(argv[2], "w", encoding="utf-8") as out:
        json.dump({"sources": sources, "total_bytes": total}, out, indent=1, sort_keys=True)
        out.write("\n")
    print(f"resolved {len(sources)} of {len(results)} source packages, "
          f"{sum(len(s['files']) for s in sources)} files, {total / 2**20:.1f} MiB")
    if missing:
        print("not found on snapshot.debian.org: " + ", ".join(missing), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
