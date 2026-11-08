package com.phonecando.lre.image.family

import com.phonecando.lre.api.OsInfo
import com.phonecando.lre.api.PackageFamily
import kotlin.test.Test
import kotlin.test.assertEquals

class InstallLineTest {
    private fun os(id: String, idLike: List<String>, family: PackageFamily) =
        OsInfo(id, "9", idLike, null, family, "/bin/bash")

    private fun line(os: OsInfo, vararg pkgs: String) = InstallLine.of(Families.of(os.family!!), os, pkgs.toList())

    private val alma = os("almalinux", listOf("rhel", "centos", "fedora"), PackageFamily.MICRODNF)

    @Test
    fun `an Enterprise Linux rebuild gets EPEL first when ripgrep is wanted`() {
        assertEquals(
            "microdnf install -y epel-release && microdnf install -y git ripgrep",
            line(alma, "git", "ripgrep"),
        )
        val rocky = os("rocky", listOf("rhel", "centos", "fedora"), PackageFamily.DNF)
        assertEquals("dnf install -y epel-release && dnf install -y ripgrep", line(rocky, "ripgrep"))
        val centos = os("centos", listOf("rhel", "fedora"), PackageFamily.DNF)
        assertEquals("dnf install -y epel-release && dnf install -y ripgrep", line(centos, "ripgrep"))
    }

    @Test
    fun `a reinstall list that holds epel-release installs it in its own step`() {
        assertEquals(
            "microdnf install -y epel-release && microdnf install -y htop ripgrep",
            line(alma, "epel-release", "htop", "ripgrep"),
        )
    }

    @Test
    fun `nothing from EPEL keeps the plain line`() {
        assertEquals("microdnf install -y git", line(alma, "git"))
    }

    @Test
    fun `Fedora, RHEL and Debian keep their plain lines`() {
        val fedora = os("fedora", emptyList(), PackageFamily.DNF)
        assertEquals("dnf install -y git ripgrep", line(fedora, "git", "ripgrep"))
        val rhel = os("rhel", listOf("fedora"), PackageFamily.MICRODNF)
        assertEquals("microdnf install -y ripgrep", line(rhel, "ripgrep"))
        val debian = os("debian", emptyList(), PackageFamily.APT)
        assertEquals("apt-get update && apt-get install -y git ripgrep", line(debian, "git", "ripgrep"))
    }
}
