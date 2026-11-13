package com.phonecando.runner.share

import android.app.Activity
import android.app.Application
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper

/**
 * Android's share sheet that also tells us whether an app was picked, and
 * which: the chooser's IntentSender callback (EXTRA_CHOSEN_COMPONENT) lands
 * in a receiver registered for this one share. When the sheet closes with no
 * pick, our activity comes back without that callback, and the share ends as
 * not sent. The picked app's label goes back to JS and stays on the phone.
 * One share at a time: a new one ends the one before as not sent.
 */
object ShareChooser {
  /** How the share ended. */
  fun interface Done {
    fun onDone(chosen: Boolean, app: String?)
  }

  private const val ACTION = "com.phonecando.runner.SHARE_CHOSEN"

  // The pick's broadcast can trail our activity's resume a little (a target
  // that only shows a dialog); a resume this long after without one is a close.
  private const val RESUME_GRACE_MS = 400L

  private val main = Handler(Looper.getMainLooper())
  private var pending: Pending? = null

  private class Pending(
    val app: Application,
    val screen: Activity,
    val done: Done,
  ) {
    lateinit var receiver: BroadcastReceiver
    lateinit var callbacks: Application.ActivityLifecycleCallbacks
  }

  /** Opens the sheet for [text] from [screen]; [done] runs once, on the main thread. */
  fun open(screen: Activity, text: String, title: String, done: Done) {
    main.post { start(screen, text, title, done) }
  }

  private fun start(screen: Activity, text: String, title: String, done: Done) {
    pending?.let { finish(it, chosen = false, app = null) }
    val app = screen.application
    val share = Pending(app, screen, done)

    share.receiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        finish(share, chosen = true, app = label(context, chosenComponent(intent)))
      }
    }
    share.callbacks = object : Application.ActivityLifecycleCallbacks {
      override fun onActivityResumed(activity: Activity) {
        if (activity === share.screen) main.postDelayed({ finish(share, chosen = false, app = null) }, RESUME_GRACE_MS)
      }

      override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit
      override fun onActivityStarted(activity: Activity) = Unit
      override fun onActivityPaused(activity: Activity) = Unit
      override fun onActivityStopped(activity: Activity) = Unit
      override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
      override fun onActivityDestroyed(activity: Activity) = Unit
    }

    val filter = IntentFilter(ACTION)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      app.registerReceiver(share.receiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      app.registerReceiver(share.receiver, filter)
    }
    pending = share

    // Mutable so the system can add EXTRA_CHOSEN_COMPONENT; explicit (our
    // package), which Android 14 asks of a mutable PendingIntent.
    val callback = PendingIntent.getBroadcast(
      app, 0, Intent(ACTION).setPackage(app.packageName),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
    )
    val send = Intent(Intent.ACTION_SEND)
      .setType("text/plain")
      .putExtra(Intent.EXTRA_TEXT, text)
      .putExtra(Intent.EXTRA_TITLE, title)
    try {
      screen.startActivity(Intent.createChooser(send, title, callback.intentSender))
      // Registered after the sheet is asked for, so our own resume before it shows is not a close.
      app.registerActivityLifecycleCallbacks(share.callbacks)
    } catch (_: Exception) {
      finish(share, chosen = false, app = null)
    }
  }

  private fun finish(share: Pending, chosen: Boolean, app: String?) {
    if (pending !== share) return
    pending = null
    runCatching { share.app.unregisterReceiver(share.receiver) }
    runCatching { share.app.unregisterActivityLifecycleCallbacks(share.callbacks) }
    share.done.onDone(chosen, app)
  }

  private fun chosenComponent(intent: Intent): ComponentName? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      intent.getParcelableExtra(Intent.EXTRA_CHOSEN_COMPONENT, ComponentName::class.java)
    } else {
      @Suppress("DEPRECATION")
      intent.getParcelableExtra(Intent.EXTRA_CHOSEN_COMPONENT)
    }

  // The app's name as the launcher shows it ("WhatsApp"); null when Android
  // will not tell us (the runner's <queries> covers apps that take shared text).
  private fun label(context: Context, component: ComponentName?): String? {
    component ?: return null
    val pm = context.packageManager
    return try {
      pm.getApplicationLabel(pm.getApplicationInfo(component.packageName, 0)).toString().ifBlank { null }
    } catch (_: PackageManager.NameNotFoundException) {
      null
    }
  }
}
