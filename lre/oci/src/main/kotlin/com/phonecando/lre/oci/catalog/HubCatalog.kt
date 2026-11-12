package com.phonecando.lre.oci.catalog

import com.phonecando.lre.api.LreException
import com.phonecando.lre.api.lreNet
import com.phonecando.lre.oci.decodeOrCorrupt
import com.phonecando.lre.oci.ref.ImageRef
import com.phonecando.network.CancelSignal
import com.phonecando.network.http.HttpPort
import com.phonecando.network.http.errorFor
import com.phonecando.network.http.fetch
import com.phonecando.network.http.readCapped
import java.net.URLEncoder
import java.util.concurrent.Callable
import java.util.concurrent.Executors

/**
 * Docker Hub's catalog for the "Own env" picker: the official operating
 * systems, a short list of community ones, every other unofficial one and
 * the arm64 tags of any Hub repository (official or not, e.g. `kalilinux/kali-rolling`). Anonymous,
 * blocking; call from a background thread.
 */
class HubCatalog(private val port: HttpPort) {
    /**
     * Docker Hub's official images in the "Operating systems" category that
     * have an arm64 build, most relevant first.
     *
     * We ask [SEARCH_URL] first: the search API behind hub.docker.com's own
     * category pages (undocumented, but it is the only endpoint that filters
     * by category, official badge and architecture on the server, and it
     * returns logos and pull counts; checked 2026-11-07: 14 images). If it
     * fails or comes back empty (its shape changed), we fall back to the
     * documented repository listing [REPOSITORIES_URL] filtered by category.
     * That listing is capped at 100 rows for anonymous callers, so the
     * fallback is the top 100 official images by pulls (the common
     * distributions are in it; rarer ones like AlmaLinux may be missing),
     * with no logos and no architecture filter (tags filter arm64 later).
     */
    fun officialOperatingSystems(cancel: CancelSignal = CancelSignal.NEVER): List<CatalogImage> {
        var searchError: LreException? = null
        try {
            val images = OfficialOs.fromSearch(get<SearchPage>(SEARCH_URL, "Docker Hub search", cancel))
            if (images.isNotEmpty()) return images
        } catch (e: LreException.Cancelled) {
            throw e
        } catch (e: LreException) {
            searchError = e
        }
        return try {
            OfficialOs.fromRepositories(get<RepositoryPage>(REPOSITORIES_URL, "Docker Hub official images", cancel))
        } catch (e: LreException.Cancelled) {
            throw e
        } catch (e: LreException) {
            throw searchError ?: e
        }
    }

    /**
     * The community operating systems ([CommunityOs.CURATED], in its order)
     * with Docker Hub's description, pull count and logo.
     *
     * One search per repository by its name ([SEARCH_NAME_URL]), a few at a
     * time: the exact hit carries the logo, which the documented repository
     * API lacks. A row whose search fails keeps the list's own words (the
     * tag list will say if the repository is really gone); when every search
     * fails we throw the first error. A repository Hub now lists archived or
     * without arm64 is left out.
     */
    fun communityOperatingSystems(cancel: CancelSignal = CancelSignal.NEVER): List<CatalogImage> {
        val pool = Executors.newFixedThreadPool(COMMUNITY_LOOKUPS)
        val results = try {
            CommunityOs.CURATED
                .map { entry -> pool.submit(Callable { runCatching { lookup(entry, cancel) } }) }
                .map { it.get() }
        } finally {
            pool.shutdownNow()
        }
        results.firstNotNullOfOrNull { it.exceptionOrNull() as? LreException.Cancelled }?.let { throw it }
        results.firstNotNullOfOrNull { it.exceptionOrNull()?.takeIf { e -> e !is LreException } }?.let { throw it }
        if (results.all { it.isFailure }) throw results.first().exceptionOrNull()!!
        return CommunityOs.CURATED.zip(results).mapNotNull { (entry, result) ->
            result.getOrElse { CommunityOs.fallback(entry) }
        }
    }

    /**
     * One page (1-based [page]) of every other unofficial operating system:
     * Hub's "Operating systems" category with an arm64 build and no official
     * badge, most pulled first, without [CommunityOs.CURATED] (the picker
     * shows those first). Many are apps or desktops built on an OS. Hub
     * answers anonymous callers only up to the [ANONYMOUS_ROWS]th row, so the
     * pages end there.
     */
    fun unofficialOperatingSystems(page: Int = 1, cancel: CancelSignal = CancelSignal.NEVER): ImagePage {
        require(page >= 1) { "pages start at 1" }
        val from = (page - 1) * OS_PAGE_SIZE
        val doc = get<SearchPage>("$UNOFFICIAL_URL&from=$from", "Docker Hub search", cancel)
        val end = from + doc.results.size
        val more = doc.results.size == OS_PAGE_SIZE && end < doc.total && end < ANONYMOUS_ROWS
        return ImagePage(UnofficialOs.fromSearch(doc), next = if (more) page + 1 else null)
    }

    private fun lookup(entry: CommunityOs.Entry, cancel: CancelSignal): CatalogImage? {
        val url = SEARCH_NAME_URL + URLEncoder.encode(entry.name, "UTF-8")
        return CommunityOs.pick(entry, get<SearchPage>(url, "Docker Hub search", cancel))
    }

    /**
     * One page (1-based [page]) of [repo]'s tags that have a linux/arm64
     * image, `latest` / `stable` / newest versions first. [repo] is a Docker
     * Hub name as typed (`alpine`, `library/alpine`, `kalilinux/kali-rolling`);
     * [query] keeps tags whose name contains it.
     *
     * Uses the documented tag listing ([TAGS_URL]); its `images[]` lists
     * every platform of a tag with architecture and variant.
     *
     * @throws com.phonecando.lre.api.LreException.InvalidRef when [repo] is not a name.
     * @throws LreException.NotFound when [repo] is not a Docker Hub repository.
     */
    fun tags(
        repo: String,
        page: Int = 1,
        query: String? = null,
        cancel: CancelSignal = CancelSignal.NEVER,
    ): TagPage {
        require(page >= 1) { "pages start at 1" }
        val ref = ImageRef.parse(repo)
        val parts = ref.repository.split('/')
        if (!ref.isDockerHub || parts.size != 2) throw LreException.NotFound("Docker Hub repository $repo")
        val url = buildString {
            append(TAGS_URL.replace("{namespace}", parts[0]).replace("{repository}", parts[1]))
            append("?page=").append(page).append("&page_size=").append(TAG_PAGE_SIZE)
            query?.trim()?.takeIf { it.isNotEmpty() }?.let { append("&name=").append(URLEncoder.encode(it, "UTF-8")) }
        }
        val doc = get<TagListPage>(url, "repository ${ref.repository}", cancel)
        return TagPage(Arm64Tags.from(doc), next = if (doc.next.isNullOrEmpty()) null else page + 1)
    }

    private inline fun <reified T> get(url: String, what: String, cancel: CancelSignal): T {
        if (cancel.isCancelled()) throw LreException.Cancelled()
        val body = lreNet(what, BODY_LIMIT) {
            val response = port.fetch(url, mapOf("Accept" to "application/json"))
            if (response.status != 200) {
                response.close()
                throw errorFor(response, url, what)
            }
            response.readCapped(BODY_LIMIT, url, what)
        }
        return decodeOrCorrupt(body, what)
    }

    companion object {
        private const val HUB = "https://hub.docker.com"

        /** Official + "Operating systems" + arm64, one page (the category has under 20 images). */
        const val SEARCH_URL = "$HUB/api/search/v4?query=&type=image&badges=official" +
            "&categories=${OfficialOs.CATEGORY}&architectures=arm64&size=100"

        /** Rows per page of the unofficial listing (declared before the URL that uses it). */
        private const val OS_PAGE_SIZE = 100

        /** Not official + "Operating systems" + arm64, most pulled first; append `&from=`. */
        const val UNOFFICIAL_URL = "$HUB/api/search/v4?query=&type=image&badges=verified_publisher,open_source,none" +
            "&categories=${OfficialOs.CATEGORY}&architectures=arm64&sort=pull_count&order=desc&size=$OS_PAGE_SIZE"

        /** Rows Hub's search pages through for anonymous callers (checked 2026-11-11). */
        const val ANONYMOUS_ROWS = 1000

        /** One repository by name (append it, URL-encoded); its exact hit comes first. */
        const val SEARCH_NAME_URL = "$HUB/api/search/v4?type=image&size=5&query="

        /** Official images by pull count; anonymous callers get the first 100 only. */
        const val REPOSITORIES_URL = "$HUB/v2/namespaces/library/repositories?page_size=100&ordering=pull_count"

        const val TAGS_URL = "$HUB/v2/namespaces/{namespace}/repositories/{repository}/tags"

        private const val TAG_PAGE_SIZE = 100
        private const val COMMUNITY_LOOKUPS = 4
        private const val BODY_LIMIT = 16L * 1024 * 1024
    }
}
