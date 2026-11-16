package com.phonecando.lme.host.chats

/**
 * Where a model's server may save chats ([dir], absolute, the server's
 * `--slot-save-path`) and the space free there now ([freeBytes]).
 */
data class ChatStorage(val dir: String, val freeBytes: Long) {
    init {
        require(dir.startsWith("/")) { "an absolute dir" }
    }
}
