package com.phonecando.linux.images

import java.util.concurrent.ConcurrentHashMap

/**
 * One lock per image id. Preparing an image for a start and its create
 * and reset jobs all rewrite the same run/ files and shims/, and an engine
 * start and a terminal may prepare the same image at once, so they take
 * turns on one image while different images go in parallel. Pure.
 */
class ImageLocks {
  private val locks = ConcurrentHashMap<String, Any>()

  fun <T> with(imageId: String, block: () -> T): T = synchronized(locks.computeIfAbsent(imageId) { Any() }) { block() }
}
