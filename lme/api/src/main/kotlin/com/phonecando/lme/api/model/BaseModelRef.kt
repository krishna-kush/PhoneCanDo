package com.phonecando.lme.api.model

/**
 * The model a GGUF file was converted from, as its header names it
 * (`general.base_model.0.name`, `.organization`, `.repo_url`); any of the
 * three may be missing.
 */
data class BaseModelRef(val name: String?, val organization: String?, val repoUrl: String?)
