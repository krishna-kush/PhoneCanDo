package com.phonecando.agents.kit.manifest

// The package families an image's OS can have: lre-api's PackageFamily ids,
// name for name, since the family lre detects in an image is what an install
// is rendered for (PackageFamiliesTest reads lre's source to keep it so). A
// kind keys install.packages by them, with ANY as the fallback; a runtime
// keys its install scripts the same way.
object PackageFamilies {
  val ALL = listOf("apt", "apk", "dnf", "yum", "microdnf", "pacman", "zypper", "xbps")

  /** The key for every family the others do not name. */
  const val ANY = "*"
}
