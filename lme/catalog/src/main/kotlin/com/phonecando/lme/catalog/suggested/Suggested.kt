package com.phonecando.lme.catalog.suggested

import com.phonecando.lme.api.model.KvCacheShape
import com.phonecando.lme.catalog.RepoFile
import com.phonecando.lme.catalog.known.KnownModel

/**
 * A model we suggest, pinned to one commit and file, with what its GGUF
 * header says about its context and KV cache, so the RAM verdict needs no
 * download, and the original model it converts, whose dates we checked.
 * The browser stays open to any model; these only come first.
 */
data class SuggestedModel(
    val title: String,
    val note: String,
    val repo: String,
    val origin: KnownModel,
    val revision: String,
    val file: RepoFile,
    val contextLength: Long,
    val kvCache: KvCacheShape,
    val phoneRam: PhoneRam,
)

/**
 * The smallest phones a model runs on, by marketed RAM in GB: at all
 * ([runsFromGb]) and with no RAM warning ([runsWellFromGb]). What our
 * website says; the app checks the phone it is on itself (lme host's RAM
 * gate), and `SuggestedRamTest` keeps these in step with that gate.
 */
data class PhoneRam(val runsFromGb: Int, val runsWellFromGb: Int)

/**
 * Our suggestions, best first, from `suggested.json` beside this class
 * (the website reads the same file): repository, commit, size and sha256
 * as huggingface.co listed them, context and KV cache from each file's
 * header (`lme/gguf`).
 */
object Suggested {
    private val list = SuggestedJson.read()

    val MODELS: List<SuggestedModel> = list.models

    /** The RAM gate's floor for any model: offered from [PhoneRam.runsFromGb], no warning from [PhoneRam.runsWellFromGb]. */
    val ANY_MODEL: PhoneRam = list.anyModel
}
