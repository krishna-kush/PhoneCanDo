package com.phonecando.lre.image.record

import com.phonecando.lre.api.LreException
import com.phonecando.lre.api.OsInfo
import com.phonecando.lre.api.PackageFamily
import com.phonecando.lre.image.detect.Detection
import com.phonecando.lre.image.support.config
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class RecordCodecTest {
    @Test
    fun `linux record round-trips, odd characters included`() {
        val record = ImageRecord.Linux(
            Detection(
                os = OsInfo("opensuse-tumbleweed", "20251101", listOf("opensuse", "suse"), "openSUSE = Tumbleweed\\", PackageFamily.ZYPPER, "/bin/bash"),
                config = config("PATH=/usr/bin", "GREETING=a=b\\c", "MULTI=line1\nline2").copy(workingDir = "/app", user = "1000:1000", cmd = listOf("bash")),
                hasBash = true,
                hasSh = false,
                busyboxSh = "/bin/busybox",
            ),
        )
        assertEquals(record, RecordCodec.decode(RecordCodec.encode(record)))
    }

    @Test
    fun `no config and no family round-trip as null`() {
        val record = ImageRecord.Linux(
            Detection(OsInfo("linux", null, emptyList(), null, null, "/bin/sh"), null, false, true, null),
        )
        assertEquals(record, RecordCodec.decode(RecordCodec.encode(record)))
        assertEquals(ImageRecord.Android, RecordCodec.decode(RecordCodec.encode(ImageRecord.Android)))
    }

    @Test
    fun `garbage is a typed error`() {
        assertFailsWith<LreException.Corrupt> { RecordCodec.decode("kind=vm\n") }
        assertFailsWith<LreException.Corrupt> { RecordCodec.decode("no equals sign\n") }
        assertFailsWith<LreException.Corrupt> { RecordCodec.decode("kind=linux\nos.id=x\nos.shell=/bin/sh\nos.family=rpm\n") }
    }
}
