package com.phonecando.runner.appaccess

import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import android.net.Uri
import android.os.Build
import java.io.File

// An app's launcher icon as a PNG file, for the Apps page's rows and the
// app question's slip: the icon its launcher activity shows (else the
// app's own), an adaptive one in this phone's mask shape, drawn once at
// the size asked into the app's cache and reused until the app is updated
// (AppIconRules). Null when Android hides the app from us or it has no
// icon of its own (never Android's stand-in robot).
internal class AppIcons(context: Context) {
  private val pm = context.packageManager
  private val dir = File(context.cacheDir, AppIconRules.DIR)

  fun uri(pkg: String, asked: Int): String? {
    val name = AppIconRules.fileName(pkg, asked) ?: return null
    val updated = updatedAt(pkg) ?: return null
    val file = File(dir, name)
    if (AppIconRules.fresh(file.length(), file.lastModified(), updated)) return Uri.fromFile(file).toString()
    val icon = drawable(pkg) ?: return null
    return if (draw(icon, AppIconRules.sizePx(asked), file)) Uri.fromFile(file).toString() else null
  }

  // When the app was last installed or updated; null when Android hides it.
  private fun updatedAt(pkg: String): Long? = try {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      pm.getPackageInfo(pkg, PackageManager.PackageInfoFlags.of(0)).lastUpdateTime
    } else {
      @Suppress("DEPRECATION")
      pm.getPackageInfo(pkg, 0).lastUpdateTime
    }
  } catch (_: Exception) {
    null
  }

  // An icon resource of 0 means none: loading it would give the stand-in.
  private fun drawable(pkg: String): Drawable? = try {
    val launcher = pm.getLaunchIntentForPackage(pkg)?.let { pm.resolveActivity(it, 0)?.activityInfo }
    if (launcher != null && launcher.iconResource != 0) {
      launcher.loadIcon(pm)
    } else {
      pm.getApplicationInfo(pkg, 0).takeIf { it.icon != 0 }?.loadIcon(pm)
    }
  } catch (_: Exception) {
    null
  }

  // Into a file of its own first, then renamed over the kept one, so a
  // reader never sees half a PNG and two draws at once never mix.
  private fun draw(icon: Drawable, size: Int, file: File): Boolean {
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    var part: File? = null
    return try {
      icon.setBounds(0, 0, size, size)
      icon.draw(Canvas(bitmap))
      dir.mkdirs()
      part = File.createTempFile(file.name, ".part", dir)
      part.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
      part.renameTo(file)
    } catch (_: Exception) {
      false
    } finally {
      bitmap.recycle()
      part?.takeIf { it.exists() }?.delete()
    }
  }
}
