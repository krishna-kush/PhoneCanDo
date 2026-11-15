"""./manage's help: every command, grouped by what it works on."""

INTRO = "PhoneCanDo: one entry point for the repo's scripts.   ./manage <command> [args]"

GROUPS = (
    ("Release and APK builds", (
        ("release <ver> --notes \"...\"", "build full + lite, draft a GitHub release; --publish publishes it"),
        ("release <ver> --dry-run", "check env, edits, CI, Linux and agent payloads; no build"),
        ("release <ver> --upload-only", "re-upload the staged assets, no build (--publish too)"),
        ("release <ver> --allow-red-ci", "release despite red CI (noted in the release notes)"),
        ("release <ver> --without-linux", "full + lite with no proot or Default image"),
        ("build lite|full [--clean]", "release-signed local APK -> dist/<channel>/, no version bump"),
        ("prebuild [--clean]", "re-apply the config plugins to app/android"),
    ), (
        "build and release first show the agents the APK ships and where each",
        "payload comes from, and make each one current: the staged one when it",
        "matches this tree's pins, else GitHub's build of them, else a build here.",
        "--rebuild <id,...> builds on this PC; --download <id,...> takes GitHub's",
        "(agent sync takes them too).",
    )),
    ("Dev loop (phone on adb, Metro on :8081)", (
        ("android lite|full|play", "debug build + install on the phone"),
        ("check", "tsc + key/reconcile vectors"),
        ("xterm", "re-inline the terminal page bundle"),
        ("logos", "regenerate brand assets from theme/"),
    ), ()),
    ("Agent kinds (agents/)", (
        ("agent list | check", "list the kinds, or validate manifests, folders and payload locks"),
        ("agent status [full|lite|play]", "the agents an APK ships and where each payload comes from"),
        ("agent sync [full|lite|play]", "make those payloads current, as build does (for dev builds too)"),
        ("agent new <id> --native|--image", "scaffold agents/<type>/<id>/"),
        ("agent <id> build [workdir] [--stage] [--force]", "build a native payload on this PC"),
        ("agent <id> stage <build-out> [dest]", "copy a built payload into the app, stamped"),
        ("agent <id> lock", "record the version and the build sources it names (payload.lock)"),
        ("agent <id> test", "the kind's Kotlin tests, then the agents/ TS tests"),
    ), ()),
    ("Linux image (lre/)", (
        ("image fetch | stage", "the locked Default image -> dist/images/ -> app assets"),
        ("image build | stage --local", "an unlocked local image -> debug builds only"),
        ("image lock <run-id>", "lock what a green lre-image run published"),
    ), ()),
    ("Website (web/)", (
        ("web dev|build|preview", "the site's dev server, build or a preview of the build"),
    ), ()),
    ("Phone and APK files", (
        ("apk info <file.apk>", "package, version, channel, signer, accessibility"),
        ("device push <file.apk>", "copy to /sdcard/Download/phonecando/"),
        ("device log", "logcat for update / install / Play Protect"),
    ), ()),
    ("Usage data (read-only)", (
        ("stats [--d1]", "GitHub download counts; --d1 adds D1 usage (cf CLI)"),
        ("limits [--strict]", "usage vs the Cloudflare free plan (warns at 70%)"),
        ("data [--days N] [--testers] [--report]", "usage data from Cloudflare, interactive in a terminal"),
    ), ()),
)

FOOTER = (
    "Setup: GITHUB_REPO from app/src/engine/updates.ts, PHONECANDO_RELEASE_ENV from",
    "the repo-root .env (release signing, TCE_READ_TOKEN; .env.example lists the",
    "keys), ANDROID_HOME from /opt/android-sdk. build and release run the limits",
    "check and the data report first (never blocking), then proot and the agent",
    "payloads. manage never runs git itself; release-android.mjs runs read-only",
    "git (rev-parse, status) in its preflight.",
)

# Commands longer than this put their description on the next line.
WIDTH = 34


def render():
    lines = [INTRO]
    for title, commands, notes in GROUPS:
        lines += ["", title]
        for command, description in commands:
            if len(command) > WIDTH:
                lines += [f"  {command}", f"  {'':{WIDTH}}  {description}"]
            else:
                lines.append(f"  {command:{WIDTH}}  {description}")
        lines += [f"    {note}" for note in notes]
    lines += [""] + list(FOOTER)
    return "\n".join(lines)
