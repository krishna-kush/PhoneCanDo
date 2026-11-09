package com.phonecando.terminal.host

/**
 * What [PtyHost.spawn] starts.
 *
 * - [argv]: the program and its arguments; a bare `argv[0]` is looked up in
 *   the absolute PATH entries of [env].
 * - [env]: the program's entire environment as KEY=VALUE entries, passed on
 *   exactly. Nothing of ours is merged in.
 * - [cwd]: where it starts; "" keeps ours.
 * - [raw]: a raw tty, for a full-screen program that reads every key itself.
 *   False gives a shell the tty's cooked defaults (echo, line editing).
 * - [handOver]: the PTY becomes no session's controlling terminal, for a
 *   program that hands it on to a child of its own (our Linux launcher).
 */
data class PtySpawnSpec(
  val argv: List<String>,
  val env: List<String>,
  val cwd: String,
  val rows: Int,
  val cols: Int,
  val raw: Boolean,
  val handOver: Boolean,
)
