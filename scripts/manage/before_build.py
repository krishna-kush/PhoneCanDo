"""What ./manage build and ./manage release run before an APK build: the
usage checks, proot, and the agent payloads the APK ships."""
import sys

from .args import die
from .env import release_env
from .paths import AGENT_KIT, ROOT, TCE
from .run import run, sh

# The agents step's own flags, each followed by kind ids (a,b); build and
# release pass every other argument on to their script.
AGENT_FLAGS = ("--rebuild", "--download")


def split_agent_flags(args):
    """(flags for agents_first, the rest) from build or release arguments."""
    flags, rest = [], []
    it = iter(args)
    for arg in it:
        if arg in AGENT_FLAGS:
            ids = next(it, None)
            if not ids or ids.startswith("--"):
                die(f"{arg} needs agent kind ids, e.g. {arg} opencode")
            flags += [arg, ids]
        else:
            rest.append(arg)
    return flags, rest


def limits_first():
    # The free-plan check (tce/scripts/check-limits.mjs) and the usage data
    # report (tce/scripts/data.mjs --report, aggregates only) run on every
    # build. Never blocks: a failure or a missing node only prints a note
    # before the build goes on.
    for name, script, args in (("limits check", "check-limits.mjs", []), ("data report", "data.mjs", ["--report"])):
        try:
            sh(["node", str(TCE / "scripts" / script), *args], env=release_env())
        except SystemExit:
            print(f"manage: {name} failed; continuing", file=sys.stderr)
        except OSError as e:
            print(f"manage: {name} skipped ({e}); continuing", file=sys.stderr)


def proot_first(args):
    # Full and lite carry the proot staged in the app. lre/proot/ensure.sh
    # checks it was built from this tree's lre/proot and, after asking,
    # builds and stages one when it is missing or out of date. A dry run only
    # reports; --without-linux ships none and --upload-only builds nothing.
    if "--without-linux" in args or "--upload-only" in args:
        return
    ensure = ["bash", str(ROOT / "lre" / "proot" / "ensure.sh")]
    if "--dry-run" in args:
        run([*ensure, "--check"], env=release_env())
        return
    sh(ensure, env=release_env())


def agents_first(args, channels, flags, release=False):
    # Which agent kinds the APK ships and where each native payload comes
    # from (agents/kit/native/ensure.mjs): the staged one when it is current
    # (built from this tree's pins, patches and build script), else GitHub's
    # build of these sources, else a build on this PC; it asks in a terminal.
    # A dry run only reports; --upload-only builds nothing.
    if "--upload-only" in args:
        return
    ensure = ["node", str(AGENT_KIT / "native" / "ensure.mjs"), *channels, *flags]
    if release:
        ensure.append("--release")
    if "--dry-run" in args:
        run([*ensure, "--check"], env=release_env())
        return
    sh(ensure, env=release_env())
