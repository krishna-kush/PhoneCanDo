package com.phonecando.lme.api.model

/** Where a model's files came from. */
sealed interface ModelSource {
    /** Downloaded from a Hugging Face model repository at an exact commit. */
    data class HuggingFace(val repo: String, val revision: String) : ModelSource {
        companion object {
            /** The one origin a user's Hugging Face token is ever sent to. */
            const val ORIGIN = "https://huggingface.co"
        }
    }

    /** Copied in from a file on the phone; [fileName] is the name it had there. */
    data class Imported(val fileName: String) : ModelSource
}
