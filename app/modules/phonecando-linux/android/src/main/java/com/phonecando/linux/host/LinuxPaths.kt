package com.phonecando.linux.host

import com.phonecando.lre.api.ImageLayout
import java.io.File

/**
 * Where everything lives under the app's filesDir. Images at
 * `images/<id>/` (the layout the runner reads, lre ImageLayout), registry
 * env bases at `envs/<id>/` (base.json + blobs/), records and the env
 * downloads to resume in `state/`.
 * Deleted trees go through a `.trash` dir next to them. Pure.
 */
class LinuxPaths(val filesDir: File) {
  val images: File get() = File(filesDir, "images")
  val envs: File get() = File(filesDir, "envs")
  val state: File get() = File(filesDir, "state")

  /** The env downloads to run again when the app starts (network's ResumeList). */
  val envResumeList: File get() = File(state, "env-downloads-to-resume.txt")

  fun image(id: String): ImageLayout = ImageLayout(File(images, id))

  fun env(id: String): File = File(envs, id)

  fun envBlobs(id: String): File = File(env(id), "blobs")

  fun envBase(id: String): File = File(env(id), "base.json")

  /** An env dir as a layout, only so lre's ImageDelete can trash it (into [envsTrash]). */
  fun envAsLayout(id: String): ImageLayout = ImageLayout(env(id))

  /** Where ImageDelete moves a deleted image (its trashFor: a sibling `.trash`). */
  val imagesTrash: File get() = File(images, ".trash")

  val envsTrash: File get() = File(envs, ".trash")
}
