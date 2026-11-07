package com.phonecando.lre.cli.report

import com.phonecando.lre.api.LreException
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

class ErrorCodeTest {
    @Test
    fun `every LreException kind maps to its snake_case name`() {
        val cases = mapOf(
            LreException.NoArm64("x") to "no_arm64",
            LreException.InvalidRef("x", "y") to "invalid_ref",
            LreException.NotFound("x") to "not_found",
            LreException.NoSpace(2, 1) to "no_space",
            LreException.RateLimited("u") to "rate_limited",
            LreException.UnsupportedManifest("m") to "unsupported_manifest",
            LreException.UnsafeEntry("p", "r") to "unsafe_entry",
            LreException.NoShell() to "no_shell",
            LreException.Cancelled() to "cancelled",
            LreException.Network("u", 503) to "network",
        )
        cases.forEach { (e, code) -> assertEquals(code, ErrorCode.of(e)) }
    }

    @Test
    fun `the stderr line is code then message`() {
        assertEquals("no_arm64: archlinux has no linux/arm64 build", ErrorCode.line(LreException.NoArm64("archlinux")))
    }

    @Test
    fun `acronyms and digits split sensibly`() {
        assertEquals("http_error", ErrorCode.snake("HTTPError"))
        assertEquals("tar_xz_layer", ErrorCode.snake("TarXzLayer"))
        assertEquals("arm64_only", ErrorCode.snake("Arm64Only"))
        assertEquals("plain", ErrorCode.snake("Plain"))
    }
}
