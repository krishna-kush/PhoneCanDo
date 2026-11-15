"""Where things are in the repo, for ./manage and its parts."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "app"
WEB = ROOT / "web"
SCRIPTS = ROOT / "scripts"
TCE = ROOT / "tce"
# Agent kinds: agents/<native|image>/<id>/agent.json, the kit's CLI in
# agents/kit/cli/ and the native payloads' build, stamp and staging in
# agents/kit/native/.
AGENTS = ROOT / "agents"
AGENT_KIT = AGENTS / "kit"
# The baked Default env image: its build and its lock (lock/<action>.sh).
IMAGE = ROOT / "lre" / "images" / "default"
IMAGE_LOCK = IMAGE / "lock"
