package com.phonecando.models.picker

import android.app.Activity
import android.content.Intent
import android.net.Uri
import com.phonecando.models.errors.ModelError
import com.phonecando.models.errors.ModelErrorCode

/**
 * The system file picker (ACTION_OPEN_DOCUMENT), opened from our module so
 * no npm dependency is needed: any file type, since GGUF has no MIME type
 * of its own (the import checks the file itself). One pick at a time; a
 * second open answers the first with nothing. [onResult] is fed from the
 * module's OnActivityResult.
 */
class FilePicker {
  private var pending: ((Uri?) -> Unit)? = null

  fun open(activity: Activity?, done: (Uri?) -> Unit) {
    if (activity == null) throw ModelError(ModelErrorCode.PICKER_UNAVAILABLE, "the app is not in front")
    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT)
      .addCategory(Intent.CATEGORY_OPENABLE)
      .setType("*/*")
    val earlier = synchronized(this) { pending.also { pending = done } }
    earlier?.invoke(null)
    try {
      activity.startActivityForResult(intent, REQUEST_CODE)
    } catch (e: Exception) {
      synchronized(this) { if (pending === done) pending = null }
      throw ModelError(ModelErrorCode.PICKER_UNAVAILABLE, "no file picker on this phone (${e.javaClass.simpleName})")
    }
  }

  /** True when [requestCode] was ours; the pick (null: backed out) goes to whoever opened it. */
  fun onResult(requestCode: Int, resultCode: Int, data: Intent?): Boolean {
    if (requestCode != REQUEST_CODE) return false
    val done = synchronized(this) { pending.also { pending = null } } ?: return true
    done(if (resultCode == Activity.RESULT_OK) data?.data else null)
    return true
  }

  private companion object {
    // "MO" in ASCII: clear of the other modules' request codes.
    const val REQUEST_CODE = 0x4D4F
  }
}
