package com.phonecando.lme.catalog.parameters

/**
 * The size we give a Hugging Face repository, for the list's size filter
 * and its rows. Pure: the caller looks the original's checkpoint up
 * ([com.phonecando.lme.catalog.HfCatalog.origin]) and may keep it.
 *
 * In this order, the first that says:
 * 1. the repository's own name ([NameSizes]);
 * 2. its original model's name (`origin.Origins`: the model it converts);
 * 3. the original's checkpoint on the Hub, when it is stored as floats,
 *    or is over 10B however it is stored ([CheckpointSizes]).
 *
 * Names come first: they match the text model a GGUF repository holds.
 * The original's checkpoint also counts its vision or audio towers, which
 * we never download (`mmproj` files), and Gemma's per-layer embeddings, so
 * it reads high at a bucket's edge (Qwen3.5-2B: 2.27B; gemma-4-E2B: 5.1B).
 * The Hub's own count for a GGUF repository (`gguf.total`) is one file's
 * header, often a vision projector or a draft model, so it is never used.
 */
object ModelSizes {
    /** [repo]'s size; [checkpoint] gives a looked-up original's parameter count, null when not known. */
    fun of(repo: String, origin: String, checkpoint: (String) -> Long?): ParameterCount? =
        NameSizes.of(repo) ?: NameSizes.of(origin) ?: checkpoint(origin)?.takeIf { it > 0 }?.let { ParameterCount(it) }

    /** The original whose checkpoint [repo]'s size needs from the Hub; null when a name gives it or [repo] is its own original. */
    fun lookupFor(repo: String, origin: String): String? =
        origin.takeIf { !it.equals(repo, ignoreCase = true) && NameSizes.of(repo) == null && NameSizes.of(it) == null }
}
