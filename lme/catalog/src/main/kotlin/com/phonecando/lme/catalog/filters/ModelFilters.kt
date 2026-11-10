package com.phonecando.lme.catalog.filters

import com.phonecando.lme.catalog.parameters.ParameterCount

/** How a listing is ordered, highest first: the Hub's own sorts. */
enum class ModelSort(internal val hub: String) {
    /** Downloads in the last 30 days. */
    DOWNLOADS("downloads"),

    /** The Hub's trending score (recent likes and downloads). */
    TRENDING("trendingScore"),

    /** The repository's last commit. */
    UPDATED("lastModified"),

    LIKES("likes"),
}

/**
 * Parameter-count buckets, by the size we give a repository
 * ([com.phonecando.lme.catalog.parameters.ModelSizes]): each holds sizes
 * above [above] up to [upTo], so a "2B" model is up to 2B. A repository
 * whose size we do not know is in none. We match them ourselves
 * ([ListFill]): the Hub's `num_parameters` reads one GGUF file's header,
 * often a vision projector or a draft model, and so it both lets 27B
 * models into "up to 2B" and leaves small ones out.
 */
enum class ModelSize(private val above: Long, private val upTo: Long?) {
    UP_TO_2B(0, 2 * BILLION),
    FROM_2B_TO_5B(2 * BILLION, 5 * BILLION),
    FROM_5B_TO_10B(5 * BILLION, 10 * BILLION),
    OVER_10B(10 * BILLION, null),
    ;

    fun holds(size: ParameterCount?): Boolean =
        size != null && size.count > above && (upTo == null || size.count <= upTo)
}

private const val BILLION = 1_000_000_000L

/** The licences a listing can keep to: the Hub's `license:<id>` tags. */
enum class ModelLicense(internal val tag: String) {
    APACHE_2_0("apache-2.0"),
    MIT("mit"),
}

/**
 * What a listing of GGUF repositories shows, for a search and for the list
 * before any query alike. [chatOnly] keeps chat models: the Hub's
 * `conversational` tag, then [ChatModels] on each hit. [sort], [license]
 * and [chatOnly] go to the Hub; [size] is ours ([ModelSize]).
 */
data class ModelFilters(
    val sort: ModelSort = ModelSort.DOWNLOADS,
    val size: ModelSize? = null,
    val license: ModelLicense? = null,
    val chatOnly: Boolean = true,
)
