"""Paths, the release env and running commands, shared by ./manage and its parts."""
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "app"
WEB = ROOT / "web"
SCRIPTS = ROOT / "scripts"
TCE = ROOT / "tce"
CHANNELS = ("lite", "full", "play")
# Agent kinds: agents/<native|image>/<id>/agent.json, the kit's CLI in
# agents/kit/cli/ and the native payloads' build, stamp and staging in
# agents/kit/native/.
AGENTS = ROOT / "agents"
AGENT_KIT = AGENTS / "kit"
# The baked Default env image: its build and its lock (lock/<action>.sh).
IMAGE = ROOT / "lre" / "images" / "default"
IMAGE_LOCK = IMAGE / "lock"


def sh(cmd, cwd=ROOT, env=None):
    print("$ " + " ".join(cmd), flush=True)
    r = subprocess.run(cmd, cwd=str(cwd), env=env or os.environ.copy())
    if r.returncode != 0:
        sys.exit(r.returncode)


def capture(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, check=False).stdout


def die(msg):
    print(f"manage: {msg}", file=sys.stderr)
    sys.exit(2)


def local_env_file():
    # The repo-root .env (gitignored) holds the release signing settings and
    # TCE_READ_TOKEN. The old ~/.config path is used only while .env is absent.
    local = ROOT / ".env"
    legacy = Path.home() / ".config/phonecando/release.env"
    return local if local.exists() or not legacy.exists() else legacy


def release_env():
    env = os.environ.copy()
    env.setdefault("ANDROID_HOME", "/opt/android-sdk")
    env.setdefault("PHONECANDO_RELEASE_ENV", str(local_env_file()))
    if "GITHUB_REPO" not in env:
        m = re.search(r"const REPO = '([^']+)'", (APP / "src/engine/updates.ts").read_text())
        if m:
            env["GITHUB_REPO"] = m.group(1)
    return env


def build_tools():
    sdk = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT") or "/opt/android-sdk"
    bt = Path(sdk) / "build-tools"
    versions = sorted(
        (p for p in bt.iterdir() if re.fullmatch(r"\d+(\.\d+)+", p.name)),
        key=lambda p: [int(x) for x in p.name.split(".")],
    )
    if not versions:
        die(f"no build-tools under {bt}")
    return versions[-1]


def channel_arg(args):
    if not args or args[0] not in CHANNELS:
        die(f"channel must be one of {', '.join(CHANNELS)}")
    return args[0]
