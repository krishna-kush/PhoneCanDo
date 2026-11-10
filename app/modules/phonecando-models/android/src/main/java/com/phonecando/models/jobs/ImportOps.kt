package com.phonecando.models.jobs

import android.content.ContentResolver
import android.net.Uri
import android.provider.OpenableColumns
import com.phonecando.models.ModelsHost
import java.io.IOException
import java.util.concurrent.atomic.AtomicLong

/**
 * A model file the user picked (a `content://` URI from the system picker)
 * copied into the store as a job: the picker's name and size go to
 * ModelStore.import, which checks the GGUF magic first and the header
 * last; on any failure nothing of it stays. The copy is what llama.cpp
 * needs: a real path.
 */
class ImportOps(private val host: ModelsHost, private val resolver: ContentResolver) {
  private val counter = AtomicLong()

  fun start(uri: Uri): ModelJob {
    val (name, size) = describe(uri)
    val job = host.jobs.begin(JobTarget(JobTarget.Kind.IMPORT, "import-${counter.incrementAndGet()}"), name)
    host.run(job) { reporter ->
      val input = resolver.openInputStream(uri) ?: throw IOException("the picked file cannot be opened")
      input.use { host.store.import(it, name, size, reporter, job.cancel) }
    }
    return job
  }

  // The picker's display name and size; a provider that does not say gets a plain name and no size check.
  private fun describe(uri: Uri): Pair<String, Long?> {
    var name: String? = null
    var size: Long? = null
    try {
      resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { c ->
        if (c.moveToFirst()) {
          val n = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
          val s = c.getColumnIndex(OpenableColumns.SIZE)
          if (n >= 0 && !c.isNull(n)) name = c.getString(n)
          if (s >= 0 && !c.isNull(s)) size = c.getLong(s).takeIf { it > 0 }
        }
      }
    } catch (_: Exception) {
      // Unknown name and size: the copy still checks the file itself.
    }
    return (name?.takeIf { it.isNotBlank() } ?: "model.gguf") to size
  }
}
