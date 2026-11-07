package com.phonecando.lre.oci.catalog

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

class TagOrderTest {
    private fun tag(name: String) = CatalogTag(name, null, null, null)

    @Test
    fun `latest, stable, newest versions, then server order`() {
        val server = listOf(
            "edge", "3.20", "noble", "latest", "3.21.1", "20260805", "stable", "3", "3.21", "v2.0", "24.04", "26.04", "rolling",
        )
        assertEquals(
            listOf(
                "latest", "stable",
                "26.04", "24.04", "3", "3.21", "3.21.1", "3.20", "v2.0",
                "edge", "noble", "20260805", "rolling",
            ),
            TagOrder.sort(server.map(::tag)).map { it.name },
        )
    }
}
