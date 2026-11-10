package com.phonecando.lme.catalog.origin

import com.phonecando.lme.api.model.ModelDates
import com.phonecando.lme.catalog.ModelHit
import com.phonecando.lme.catalog.RepoRevision
import com.phonecando.lme.catalog.known.KnownModels
import java.time.LocalDate

/**
 * A Hugging Face model's dates from its original repository (`origin` on
 * [ModelHit] and [RepoRevision]): a model we know has its vendor's dates
 * ([KnownModels]); any other has the day its original repository was
 * created on the Hub. Pure: the caller looks that day up
 * ([com.phonecando.lme.catalog.HfCatalog.createdAt]) and may keep it, since
 * it never changes.
 */
object OriginDates {
    /** The repository whose creation day [repo]'s dates need from the Hub; null when they need no request. */
    fun lookupFor(repo: String, origin: String): String? =
        origin.takeIf { KnownModels.of(it) == null && !it.equals(repo, ignoreCase = true) }

    /**
     * The dates of [repo], whose original model is [origin]. [createdAt] is
     * [repo]'s own creation day; [lookup] gives another repository's, null
     * when it is not known.
     */
    fun of(repo: String, origin: String, createdAt: LocalDate?, lookup: (String) -> LocalDate?): ModelDates? {
        KnownModels.of(origin)?.let { return it.dates }
        val since = if (origin.equals(repo, ignoreCase = true)) createdAt else lookup(origin)
        return since?.let(ModelDates::OnHub)
    }

    fun of(hit: ModelHit, lookup: (String) -> LocalDate?): ModelDates? = of(hit.repo, hit.origin, hit.createdAt, lookup)

    fun of(revision: RepoRevision, lookup: (String) -> LocalDate?): ModelDates? =
        of(revision.repo, revision.origin, revision.createdAt, lookup)
}
