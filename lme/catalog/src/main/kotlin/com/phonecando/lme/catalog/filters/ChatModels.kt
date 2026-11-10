package com.phonecando.lme.catalog.filters

/**
 * Which hits a chat-only listing keeps, by the Hub's pipeline task: none
 * given, text generation, any-to-any, or a task that reads something and
 * writes text (`image-text-to-text`). The Hub's `conversational` tag alone
 * lets rerankers (`text-ranking`) and some embedding models through. Pure.
 */
internal object ChatModels {
    fun keeps(pipelineTag: String?): Boolean =
        pipelineTag == null || pipelineTag == "text-generation" || pipelineTag == "any-to-any" || pipelineTag.endsWith("-text-to-text")
}
