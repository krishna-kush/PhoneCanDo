package com.phonecando.linux.catalog

import com.phonecando.lre.oci.catalog.CatalogImage
import com.phonecando.lre.oci.catalog.CatalogTag
import com.phonecando.lre.oci.catalog.TagPage

// Docker Hub catalog rows as the JS types see them (CatalogImage,
// CatalogTag, TagPage in app/src/engine/linux/types.ts). Pure.

fun CatalogImage.toMap(): Map<String, Any?> = mapOf(
  "name" to name,
  "description" to description,
  "pullCount" to pullCount,
  "logoUrl" to logoUrl,
)

fun CatalogTag.toMap(): Map<String, Any?> = mapOf(
  "name" to name,
  "sizeArm64" to sizeArm64,
  "lastUpdated" to lastUpdated,
  "digest" to digest,
)

fun TagPage.toMap(): Map<String, Any?> = mapOf("tags" to tags.map { it.toMap() }, "next" to next)
