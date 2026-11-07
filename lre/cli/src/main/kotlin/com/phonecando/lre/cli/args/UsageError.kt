package com.phonecando.lre.cli.args

/** A command line we cannot run; exit code 2. [message] says what is wrong. */
class UsageError(message: String) : Exception(message)
