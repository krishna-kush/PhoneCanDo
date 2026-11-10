package com.phonecando.lme.api.model

/**
 * One file of a model as it sits in the model's dir: a plain file name (a
 * split model keeps its `-00001-of-00003` names, which llama.cpp looks for),
 * its size and its lower-case hex sha256.
 */
data class ModelFile(val name: String, val sizeBytes: Long, val sha256: String)
