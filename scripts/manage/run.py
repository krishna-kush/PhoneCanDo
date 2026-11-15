"""Running commands: the one place ./manage starts a process."""
import os
import subprocess
import sys

from .paths import ROOT

# Set to a function(cmd, cwd), it is called instead and nothing runs: the
# wiring check (.github/ci/js/check-wiring.mjs) records each command this way.
RECORD = None


def sh(cmd, cwd=ROOT, env=None):
    if RECORD:
        return RECORD(cmd, cwd)
    print("$ " + " ".join(cmd), flush=True)
    r = subprocess.run(cmd, cwd=str(cwd), env=env or os.environ.copy())
    if r.returncode != 0:
        sys.exit(r.returncode)


def run(cmd, cwd=ROOT, env=None):
    # Like sh, for reports: their exit status never stops the build.
    if RECORD:
        return RECORD(cmd, cwd)
    subprocess.run(cmd, cwd=str(cwd), env=env or os.environ.copy(), check=False)


def capture(cmd):
    if RECORD:
        return ""
    return subprocess.run(cmd, capture_output=True, text=True, check=False).stdout
