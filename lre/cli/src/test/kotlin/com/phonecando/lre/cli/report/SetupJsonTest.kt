package com.phonecando.lre.cli.report

import com.phonecando.lre.api.OsInfo
import com.phonecando.lre.api.PackageFamily
import com.phonecando.lre.cli.base.SourceInfo
import com.phonecando.lre.image.SetupResult
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse

class SetupJsonTest {
    private val debian = OsInfo(
        id = "debian",
        versionId = "13",
        idLike = emptyList(),
        prettyName = "Debian GNU/Linux 13 (trixie)",
        family = PackageFamily.APT,
        shell = "/bin/bash",
    )

    @Test
    fun `a registry setup with missing tools`() {
        val json = SetupJson.render(
            SetupResult(debian, listOf("git", "rg"), "apt-get update && apt-get install -y git ripgrep", false),
            SourceInfo.Registry("docker.io/library/debian:stable", "sha256:ab", 1, 50_000_000, "registry-1.docker.io"),
            SetupTimings(download = 1200, setup = 3400),
        )
        assertEquals(
            """{"os":{"id":"debian","versionId":"13","idLike":[],"prettyName":"Debian GNU/Linux 13 (trixie)",""" +
                """"family":"apt","shell":"/bin/bash"},"missingTools":["git","rg"],""" +
                """"installCommand":"apt-get update && apt-get install -y git ripgrep","socketPathTight":false,""" +
                """"source":{"kind":"registry","ref":"docker.io/library/debian:stable","manifestDigest":"sha256:ab",""" +
                """"layers":1,"bytes":50000000,"sourceHost":"registry-1.docker.io"},""" +
                """"timingsMs":{"download":1200,"setup":3400}}""",
            json,
        )
        assertFalse('\n' in json, "one line, so a script can read it with jq")
    }

    @Test
    fun `no package manager gives null family and install command`() {
        val busybox = OsInfo("busybox", null, listOf("a b"), null, null, "/bin/sh")
        val json = Json.parseToJsonElement(
            SetupJson.render(
                SetupResult(busybox, listOf("bash", "git", "rg"), null, true),
                SourceInfo.Tarball("/w/rootfs \"x\".tar", 42),
                SetupTimings(0, 9),
            ),
        ).jsonObject
        val os = json.getValue("os").jsonObject
        assertEquals("null", os.getValue("family").toString())
        assertEquals("null", os.getValue("versionId").toString())
        assertEquals("""["a b"]""", os.getValue("idLike").toString())
        assertEquals("null", json.getValue("installCommand").toString())
        assertEquals("true", json.getValue("socketPathTight").toString())
        assertEquals(
            """{"kind":"tarball","path":"/w/rootfs \"x\".tar","bytes":42}""",
            json.getValue("source").toString(),
        )
    }

    @Test
    fun `an Android image has null os`() {
        val json = SetupJson.render(
            SetupResult(null, emptyList(), null, false),
            SourceInfo.Tarball("/t", 1),
            SetupTimings(0, 1),
        )
        assertEquals("null", Json.parseToJsonElement(json).jsonObject.getValue("os").toString())
    }

    @Test
    fun `refresh line`() {
        assertEquals("""{"imageDir":"/w/i","timingsMs":{"refresh":7}}""", RefreshJson.render("/w/i", 7))
    }
}
