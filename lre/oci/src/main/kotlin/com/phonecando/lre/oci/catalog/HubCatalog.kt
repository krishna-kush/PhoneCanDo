package com.phonecando.lre.oci.catalog

import com.phonecando.lre.api.CancelSignal
import com.phonecando.lre.api.LreException
import com.phonecando.lre.oci.decodeOrCorrupt
import com.phonecando.lre.oci.http.HttpTransport
import com.phonecando.lre.oci.http.errorFor
import com.phonecando.lre.oci.http.fetch
import com.phonecando.lre.oci.http.readCapped
import com.phonecando.lre.oci.ref.ImageRef
import java.net.URLEncoder

/**
 * Docker Hub's catalog for the "Own env" picker: the official operating
 * systems and the arm64 tags of any Hub repository (official or not, e.g.
 * `kalilinux/kali-rolling`). Anonymous, blocking; call from a background
 * thread.
 */
class HubCatalog(private val transport: HttpTransport) {
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
        val response = transport.fetch(url, mapOf("Accept" to "application/json"))
        if (response.status != 200) {
            response.close()
            throw errorFor(response.status, url, what)
        }
        return decodeOrCorrupt(response.readCapped(BODY_LIMIT, url, what), what)
    }

    companion object {
        private const val HUB = "https://hub.docker.com"

        /** Official + "Operating systems" + arm64, one page (the category has under 20 images). */
        const val SEARCH_URL = "$HUB/api/search/v4?query=&type=image&badges=official" +
            "&categories=${OfficialOs.CATEGORY}&architectures=arm64&size=100"

        /** Official images by pull count; anonymous callers get the first 100 only. */
        const val REPOSITORIES_URL = "$HUB/v2/namespaces/library/repositories?page_size=100&ordering=pull_count"

        const val TAGS_URL = "$HUB/v2/namespaces/{namespace}/repositories/{repository}/tags"

        private const val TAG_PAGE_SIZE = 100
        private const val BODY_LIMIT = 16L * 1024 * 1024
    }
}
