package com.phonecando.lme.store.layout

import com.phonecando.lme.api.model.ModelIds
import java.io.File

/**
 * The models dir on the phone (`files/models/` in the app):
 *
 *     models.json          the registry: ready models and downloads in flight
 *     <id>/<file>          a model's files, under the names llama.cpp expects
 *     <id>/<file>.part     a download or import not yet verified
 *     <id>/.memory.json    what its server measured of itself on this phone
 *     <id>/.chats/         its chats kept on storage (the host's, by name)
 *
 * Ids hold no dot (`ModelIds`), so no model dir can be `models.json`; a
 * model file's name never starts with a dot (`FileNames`), so ours never
 * meet one. Deleting a model's dir deletes all of it.
 */
class ModelLayout(val root: File) {
    val registry: File get() = File(root, REGISTRY)

    fun dir(id: String): File = File(root, ModelIds.check(id))

    fun file(id: String, name: String): File = File(dir(id), FileNames.check(name))

    fun part(id: String, name: String): File = File(dir(id), FileNames.check(name) + PART)

    fun measured(id: String): File = File(dir(id), MEASURED)

    fun chats(id: String): File = File(dir(id), CHATS)

    companion object {
        const val REGISTRY = "models.json"
        const val PART = ".part"
        const val MEASURED = ".memory.json"
        const val CHATS = ".chats"
    }
}
