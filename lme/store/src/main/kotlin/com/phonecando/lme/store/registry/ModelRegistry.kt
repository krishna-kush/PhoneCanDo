package com.phonecando.lme.store.registry

import com.phonecando.lme.store.io.AtomicFile
import java.io.File
import java.nio.file.Files
import java.nio.file.NoSuchFileException

/**
 * `models.json`, read and rewritten whole under one lock: one instance per
 * models dir in a process. Every write is atomic ([AtomicFile]).
 */
internal class ModelRegistry(private val file: File) {
    private val lock = Any()

    fun read(): Registry = synchronized(lock) { load() }

    /** Applies [change] to the current registry and writes the result; returns it. */
    fun update(change: (Registry) -> Registry): Registry = synchronized(lock) {
        val before = load()
        val after = change(before)
        if (after != before) AtomicFile.write(file, RegistryCodec.encode(after).toByteArray(Charsets.UTF_8))
        after
    }

    private fun load(): Registry {
        val bytes = try {
            Files.readAllBytes(file.toPath())
        } catch (_: NoSuchFileException) {
            return Registry.EMPTY
        }
        return RegistryCodec.decode(bytes.toString(Charsets.UTF_8))
    }
}
