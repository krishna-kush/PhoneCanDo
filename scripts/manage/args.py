"""Reading ./manage's arguments, and stopping on a bad one."""
import sys

CHANNELS = ("lite", "full", "play")


def die(msg):
    print(f"manage: {msg}", file=sys.stderr)
    sys.exit(2)


def channel_arg(args):
    if not args or args[0] not in CHANNELS:
        die(f"channel must be one of {', '.join(CHANNELS)}")
    return args[0]
