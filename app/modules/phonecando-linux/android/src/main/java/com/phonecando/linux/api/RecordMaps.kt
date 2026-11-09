package com.phonecando.linux.api

import com.phonecando.linux.records.EnvRecord
import com.phonecando.linux.records.EnvSource
import com.phonecando.linux.records.ImageRecord
import com.phonecando.lre.api.OsInfo
import com.phonecando.lre.image.reset.ReinstallList
import com.phonecando.lre.image.tools.MissingTools

// Records as the JS types in app/src/engine/linux/types.ts see them (Env,
// Image, OsInfo, ReinstallList, MissingTools): the same field names, null
// for absent. Pure.

fun EnvRecord.toMap(): Map<String, Any?> = mapOf(
  "id" to id,
  "name" to name,
  "source" to source.toMap(),
  "state" to state.id,
  "os" to os?.toMap(),
  "sizeBytes" to sizeBytes,
  "createdAt" to createdAt,
  "error" to error,
  "errorCode" to errorCode,
)

fun EnvSource.toMap(): Map<String, Any?> = when (this) {
  is EnvSource.Default -> mapOf("kind" to "default", "version" to version)
  is EnvSource.Registry -> mapOf("kind" to "registry", "image" to image, "tag" to tag, "digest" to digest)
  EnvSource.Android -> mapOf("kind" to "android")
}

fun ImageRecord.toMap(): Map<String, Any?> = mapOf(
  "id" to id,
  "envId" to envId,
  "state" to state.id,
  "failedStep" to failedStep,
  "error" to error,
  "errorCode" to errorCode,
  "os" to os?.toMap(),
  "sizeBytes" to sizeBytes,
  "createdAt" to createdAt,
)

fun OsInfo.toMap(): Map<String, Any?> = mapOf(
  "id" to id,
  "versionId" to versionId,
  "idLike" to idLike,
  "prettyName" to prettyName,
  "family" to family?.id,
  "shell" to shell,
)

fun ReinstallList.toMap(): Map<String, Any?> = mapOf("installCommand" to installCommand, "packages" to packages)

fun MissingTools.toMap(): Map<String, Any?> = mapOf("missingTools" to commands, "installCommand" to installCommand)
