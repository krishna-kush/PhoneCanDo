package com.phonecando.lre.oci.auth

/**
 * The Bearer challenge a registry sends with a 401: where to get an
 * anonymous token ([realm]) and what to ask for ([service], [scope]).
 */
internal data class BearerChallenge(val realm: String, val service: String?, val scope: String?) {
    companion object {
        private val BEARER = Regex("(?i)(?:^|[\\s,])bearer\\s+")

        /** Parses a `WWW-Authenticate` value; null unless it offers Bearer with a realm. */
        fun parse(header: String?): BearerChallenge? {
            if (header == null) return null
            val start = BEARER.find(header)?.range?.last?.plus(1) ?: return null
            val params = params(header, start)
            val realm = params["realm"]?.takeIf { it.isNotEmpty() } ?: return null
            return BearerChallenge(realm, params["service"], params["scope"])
        }

        /** `key=value` / `key="quoted"` pairs from [start] until the next scheme. */
        private fun params(header: String, start: Int): Map<String, String> {
            val params = HashMap<String, String>()
            val n = header.length
            var i = start
            while (i < n) {
                while (i < n && (header[i] == ' ' || header[i] == '\t' || header[i] == ',')) i++
                val keyStart = i
                while (i < n && (header[i].isLetterOrDigit() || header[i] == '_' || header[i] == '-')) i++
                if (i == keyStart) break
                val key = header.substring(keyStart, i).lowercase()
                var j = i
                while (j < n && header[j] == ' ') j++
                if (j >= n || header[j] != '=') break // the next challenge's scheme
                i = j + 1
                while (i < n && header[i] == ' ') i++
                val value = StringBuilder()
                if (i < n && header[i] == '"') {
                    i++
                    while (i < n && header[i] != '"') {
                        if (header[i] == '\\' && i + 1 < n) i++
                        value.append(header[i])
                        i++
                    }
                    i++
                } else {
                    while (i < n && header[i] != ',') value.append(header[i++])
                }
                if (key !in params) params[key] = value.toString().trim()
            }
            return params
        }
    }
}
