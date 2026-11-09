package com.phonecando.agents.kit.render

/** A kind this build cannot run as its manifest says: a block its style needs, a hook or a placeholder is missing. */
class KindException(message: String) : IllegalArgumentException(message)
