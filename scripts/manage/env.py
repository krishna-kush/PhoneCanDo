"""The environment release builds run in: signing settings, the repo name and
the Android SDK's build-tools."""
import os
import re
from pathlib import Path

from .args import die
from .paths import APP, ROOT


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
