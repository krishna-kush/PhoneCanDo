package com.phonecando.lre.oci.http

/**
 * [url] without user info, query or fragment: the only form of a URL we put
 * in an error. Signed CDN links and token requests carry secrets in the query.
 */
internal fun redactUrl(url: String): String {
    val bare = url.substringBefore('#').substringBefore('?')
    val schemeEnd = bare.indexOf("://")
    if (schemeEnd < 0) return bare
    val authorityStart = schemeEnd + 3
    val pathStart = bare.indexOf('/', authorityStart).let { if (it < 0) bare.length else it }
    val at = bare.lastIndexOf('@', pathStart - 1)
    return if (at >= authorityStart) bare.substring(0, authorityStart) + bare.substring(at + 1) else bare
}
