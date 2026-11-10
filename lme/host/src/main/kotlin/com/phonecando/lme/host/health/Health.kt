package com.phonecando.lme.host.health

/** What one `/health` probe of a model server saw. */
sealed interface Health {
    /** Nothing listens yet: the process is still starting. */
    data object Starting : Health

    /** 503: the model is loading. */
    data object Loading : Health

    data object Ready : Health

    /** Any other answer; the server is up but broken. */
    data class Failed(val status: Int) : Health

    companion object {
        /** llama-server answers 200 `{"status":"ok"}` when ready and 503 while it loads. */
        fun of(status: Int): Health = when (status) {
            200 -> Ready
            503 -> Loading
            else -> Failed(status)
        }
    }
}
