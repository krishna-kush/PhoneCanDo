package com.phonecando.lre.image.family

import com.phonecando.lre.api.PackageFamily
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class FamiliesTest {
    @Test
    fun `every family has one row`() {
        assertEquals(PackageFamily.entries.toSet(), Families.all.map { it.family }.toSet())
        assertEquals(PackageFamily.entries.size, Families.all.size)
    }

    @Test
    fun `install lines include the refresh step where a fresh image needs it`() {
        assertEquals(
            "apt-get update && apt-get install -y git ripgrep",
            Families.of(PackageFamily.APT).let { it.installLine(listOf("git", "rg").map(it::packageFor)) },
        )
        assertEquals("apk add <pkg>", Families.of(PackageFamily.APK).installHint)
        assertEquals("pacman -Sy && pacman -S --noconfirm <pkg>", Families.of(PackageFamily.PACMAN).installHint)
        assertEquals("microdnf install -y <pkg>", Families.of(PackageFamily.MICRODNF).installHint)
        assertEquals("zypper install -y <pkg>", Families.of(PackageFamily.ZYPPER).installHint)
        assertEquals("xbps-install -S && xbps-install -y <pkg>", Families.of(PackageFamily.XBPS).installHint)
        assertEquals("dnf install -y <pkg>", Families.of(PackageFamily.DNF).installHint)
        assertEquals("yum install -y <pkg>", Families.of(PackageFamily.YUM).installHint)
    }

    @Test
    fun `proot fixes for apt and pacman only`() {
        assertEquals(ProotFix.APT_SANDBOX_USER, Families.of(PackageFamily.APT).prootFix)
        assertEquals(ProotFix.PACMAN_SANDBOX, Families.of(PackageFamily.PACMAN).prootFix)
        Families.all.filter { it.family != PackageFamily.APT && it.family != PackageFamily.PACMAN }
            .forEach { assertNull(it.prootFix, it.family.id) }
    }

    @Test
    fun `manual package listings parse per format`() {
        assertEquals(listOf("git", "vim", "python3:arm64"), PackageLists.parse(ListFormat.LINES, "git\nvim\n\npython3:arm64\n"))
        assertEquals(listOf("git", "ripgrep"), PackageLists.parse(ListFormat.LINES, "git\\nripgrep\\n"))
        assertEquals(
            listOf("alpine-baselayout", "git", "nodejs@edge"),
            PackageLists.parse(ListFormat.APK_WORLD, "alpine-baselayout\ngit>=2.40\nnodejs@edge\n"),
        )
        assertEquals(
            listOf("git", "htop"),
            PackageLists.parse(
                ListFormat.ZYPPER_TABLE,
                "S  | Repository | Name | Version | Arch\n---+------------+------+---------+-----\n" +
                    "i+ | repo-oss   | git  | 2.51.0  | aarch64\ni+ | repo-oss   | htop | 3.4.1   | aarch64\n",
            ),
        )
        assertEquals(
            listOf("base-system", "git", "ripgrep"),
            PackageLists.parse(ListFormat.XBPS_PKGVER, "base-system-0.114_2\ngit-2.51.0_1\nripgrep-14.1.1_1\n"),
        )
    }

    @Test
    fun `names that would break a shell line are dropped, not quoted`() {
        assertEquals(
            listOf("ok"),
            PackageLists.parse(ListFormat.LINES, "ok\n\$(reboot)\nrm -rf\n;ls\n-oops\n`x`\n"),
        )
    }
}
