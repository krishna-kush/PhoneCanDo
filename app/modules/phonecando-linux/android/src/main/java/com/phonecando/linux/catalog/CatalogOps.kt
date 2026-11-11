package com.phonecando.linux.catalog

import com.phonecando.linux.LinuxHost
import com.phonecando.linux.host.LinuxGate
import com.phonecando.lre.oci.catalog.CatalogImage
import com.phonecando.lre.oci.catalog.HubCatalog
import com.phonecando.lre.oci.catalog.ImagePage
import com.phonecando.lre.oci.catalog.TagPage

/** Docker Hub browsing for the "Own env" picker; refused where no Linux runs (play). Blocking. */
class CatalogOps(private val host: LinuxHost, private val hub: HubCatalog) {
  fun officialOs(): List<CatalogImage> {
    LinuxGate.requireLinux(host.android.status())
    return hub.officialOperatingSystems()
  }

  fun communityOs(): List<CatalogImage> {
    LinuxGate.requireLinux(host.android.status())
    return hub.communityOperatingSystems()
  }

  fun unofficialOs(page: Int): ImagePage {
    LinuxGate.requireLinux(host.android.status())
    return hub.unofficialOperatingSystems(page.coerceAtLeast(1))
  }

  fun tags(repo: String, page: Int, query: String?): TagPage {
    LinuxGate.requireLinux(host.android.status())
    return hub.tags(repo, page.coerceAtLeast(1), query)
  }
}
