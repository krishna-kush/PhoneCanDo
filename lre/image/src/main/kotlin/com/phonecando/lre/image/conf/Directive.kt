package com.phonecando.lre.image.conf

import com.phonecando.lre.api.LreException

/**
 * One launch.conf line (format: lre/launcher/src/conf.h). [line] checks
 * the value against the launcher's rules and throws
 * [LreException.UnsafeEntry] instead of writing a line it would reject or
 * misread.
 */
internal sealed class Directive {
    abstract fun line(): String

    /** One proot argv entry; the first is the absolute path of proot. */
    data class Arg(val value: String) : Directive() {
        override fun line() = "arg ${verbatim(value)}"
    }

    data class SetEnv(val key: String, val value: String) : Directive() {
        override fun line(): String {
            if (!NAME.matches(key)) throw LreException.UnsafeEntry(key, "not a variable name")
            return "set $key=${verbatim(value)}"
        }
    }

    /** A name ending in `*` removes every variable with that prefix. */
    data class Unset(val name: String) : Directive() {
        override fun line(): String {
            if (!UNSET_NAME.matches(name)) throw LreException.UnsafeEntry(name, "not a variable name or prefix")
            return "unset $name"
        }
    }

    /** Invoked as [name], run [guest] instead; both single tokens. */
    data class MapCommand(val name: String, val guest: String) : Directive() {
        override fun line() = "map ${token(name)} ${token(guest)}"
    }

    data class Same(val path: String) : Directive() {
        override fun line() = "same ${absolute(path)}"
    }

    data class Home(val path: String) : Directive() {
        override fun line() = "home ${absolute(path)}"
    }

    companion object {
        private val NAME = Regex("[A-Za-z_][A-Za-z0-9_]*")
        private val UNSET_NAME = Regex("[A-Za-z_][A-Za-z0-9_]*\\*?")

        /** A value the launcher keeps verbatim: anything but a line break or NUL. */
        fun verbatim(value: String): String {
            if (value.any { it == '\n' || it == '\r' || it == '\u0000' }) {
                throw LreException.UnsafeEntry(value, "a line break or NUL cannot go into launch.conf")
            }
            return value
        }

        fun absolute(path: String): String {
            if (!path.startsWith("/")) throw LreException.UnsafeEntry(path, "not an absolute path")
            return verbatim(path)
        }

        private fun token(value: String): String {
            if (value.isEmpty() || value.any { it.isWhitespace() }) {
                throw LreException.UnsafeEntry(value, "not a single token")
            }
            return verbatim(value)
        }
    }
}
