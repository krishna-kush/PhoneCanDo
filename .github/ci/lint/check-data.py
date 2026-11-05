"""Data-file gate, Python half (JSON/JSONC is check-data.mjs): every tracked
YAML, TOML, XML and SVG file parses.

  YAML  PyYAML safe loader, plus duplicate mapping keys (PyYAML, like most
        loaders, silently keeps the last one; GitHub Actions rejects them,
        pnpm does not).
  TOML  tomllib (stdlib, Python 3.11+); duplicate keys are a parse error.
  XML   expat well-formedness: AndroidManifest.xml and res/ files otherwise
        only fail inside the multi-minute Gradle build; SVG icons in a browser.

  CI:    git ls-files -z -- '*.yml' '*.yaml' '*.toml' '*.xml' '*.svg' \\
           | python3 .github/ci/lint/check-data.py -0
  Local: python3 .github/ci/lint/check-data.py FILE...

YAML needs PyYAML (python3-yaml, or `uv run --with pyyaml`).
"""
import os
import sys
import xml.parsers.expat

import yaml

try:
    import tomllib
except ImportError:  # Python < 3.11
    tomllib = None

Loader = getattr(yaml, "CSafeLoader", yaml.SafeLoader)


class UniqueKeyLoader(Loader):
    def construct_mapping(self, node, deep=False):
        seen = {}
        for key_node, _ in node.value:
            if key_node.tag == "tag:yaml.org,2002:merge":
                continue
            key = self.construct_object(key_node, deep=True)
            try:
                hash(key)
            except TypeError:
                continue
            if key in seen:
                raise yaml.constructor.ConstructorError(
                    "while constructing a mapping", node.start_mark,
                    f"found duplicate key {key!r} (first at line {seen[key] + 1})",
                    key_node.start_mark,
                )
            seen[key] = key_node.start_mark.line
        return super().construct_mapping(node, deep=deep)


def annotate(level, path, line, msg):
    msg = " ".join(str(msg).split())
    if os.environ.get("GITHUB_ACTIONS") == "true":
        print(f"::{level} file={path},line={line}::{msg}")
    else:
        print(f"{level}: {path}:{line}: {msg}")


def check_yaml(path):
    try:
        with open(path, encoding="utf-8") as fh:
            list(yaml.load_all(fh, Loader=UniqueKeyLoader))
    except yaml.YAMLError as err:
        mark = getattr(err, "problem_mark", None)
        return (mark.line + 1 if mark else 0), err
    return None


def check_toml(path):
    try:
        with open(path, "rb") as fh:
            tomllib.load(fh)
    except tomllib.TOMLDecodeError as err:
        return getattr(err, "lineno", 0) or 0, err
    return None


def check_xml(path):
    parser = xml.parsers.expat.ParserCreate()
    try:
        with open(path, "rb") as fh:
            parser.ParseFile(fh)
    except xml.parsers.expat.ExpatError as err:
        return err.lineno, err
    return None


CHECKS = {".yml": check_yaml, ".yaml": check_yaml, ".toml": check_toml, ".xml": check_xml, ".svg": check_xml}


def main(argv):
    paths = [p for p in sys.stdin.read().split("\0") if p] if argv[:1] == ["-0"] else argv
    counts, bad = {}, 0
    for path in paths:
        ext = os.path.splitext(path)[1].lower()
        check = CHECKS.get(ext)
        if check is None:
            continue
        if check is check_toml and tomllib is None:
            annotate("warning", path, 0, "TOML not checked: needs Python 3.11+ (tomllib)")
            continue
        counts[ext] = counts.get(ext, 0) + 1
        problem = check(path)
        if problem:
            annotate("error", path, *problem)
            bad += 1
    kinds = ", ".join(f"{n} {ext[1:]}" for ext, n in sorted(counts.items())) or "none"
    line = f"**YAML/TOML/XML:** {kinds} parsed, {bad} problem(s) (PyYAML {yaml.__version__} {Loader.__name__})."
    print(line)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
