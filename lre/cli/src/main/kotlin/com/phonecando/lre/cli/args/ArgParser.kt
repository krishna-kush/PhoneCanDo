package com.phonecando.lre.cli.args

/** Turns the words after `cli` into a [Command]. Pure; every bad line is a [UsageError]. */
object ArgParser {
    private val HELP = setOf("help", "--help", "-h")

    private const val IMAGE_DIR = "image-dir"
    private const val LIB_DIR = "lib-dir"
    private const val DATA_DIR = "data-dir"

    private val SETUP = OptionSpec(
        single = setOf("ref", "tarball", IMAGE_DIR, LIB_DIR, "blobs", "free-bytes"),
        multi = setOf(DATA_DIR),
    )
    private val REFRESH = OptionSpec(single = setOf(IMAGE_DIR, LIB_DIR), multi = setOf(DATA_DIR))
    private val RUN = OptionSpec(single = setOf(IMAGE_DIR, "cwd", "timeout"), takesRest = true)
    private val ENV = OptionSpec(single = setOf(IMAGE_DIR))

    fun parse(args: List<String>): Command {
        val name = args.firstOrNull() ?: throw UsageError("no command given")
        val rest = args.drop(1)
        if (name in HELP || rest.takeWhile { it != "--" }.any { it in HELP }) return Command.Help
        return when (name) {
            "setup" -> setup(Options.read(name, rest, SETUP))
            "refresh" -> Command.Refresh(host(Options.read(name, rest, REFRESH)))
            "run" -> run(Options.read(name, rest, RUN))
            "env" -> Command.Env(Options.read(name, rest, ENV).required(IMAGE_DIR))
            else -> throw UsageError("unknown command '$name'")
        }
    }

    private fun setup(options: ParsedOptions): Command.Setup {
        val ref = options.single["ref"]
        val tarball = options.single["tarball"]
        val source = when {
            ref != null && tarball != null -> throw UsageError("give --ref or --tarball, not both")
            ref != null -> BaseSource.Registry(ref)
            tarball != null -> BaseSource.Tarball(tarball)
            else -> throw UsageError("--ref or --tarball is required")
        }
        val freeBytes = options.single["free-bytes"]?.let { text ->
            text.toLongOrNull()?.takeIf { it >= 0 } ?: throw UsageError("--free-bytes must be a whole number of bytes")
        }
        return Command.Setup(source, host(options), options.single["blobs"], freeBytes)
    }

    private fun run(options: ParsedOptions): Command.Run {
        val words = options.rest ?: throw UsageError("run needs -- and the command")
        if (words.isEmpty() || words.all { it.isBlank() }) throw UsageError("run needs a command after --")
        val timeout = options.single["timeout"]?.let { text ->
            text.toLongOrNull()?.takeIf { it > 0 } ?: throw UsageError("--timeout must be a positive number of seconds")
        }
        return Command.Run(options.required(IMAGE_DIR), words.joinToString(" "), options.single["cwd"], timeout)
    }

    private fun host(options: ParsedOptions) =
        HostArgs(options.required(IMAGE_DIR), options.required(LIB_DIR), options.all(DATA_DIR))
}
