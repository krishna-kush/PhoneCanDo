package com.phonecando.runner.cutoff

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// The look for runs a reboot or an update cut off (CutOffs.look), as soon
// as Android lets us read our files: BOOT_COMPLETED comes after the first
// unlock (our files live in credential-encrypted storage, so not
// LOCKED_BOOT_COMPLETED), MY_PACKAGE_REPLACED in the new build. It only
// posts notices: nothing starts until you tap Continue. Separate from
// ScheduleBootReceiver (the schedules' alarm) and PackageReplacedReceiver
// (the way back after a self-update).
class CutOffBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val trigger = when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED -> CutOffLook.Trigger.BOOT
      Intent.ACTION_MY_PACKAGE_REPLACED -> CutOffLook.Trigger.UPDATE
      else -> return
    }
    val pending = goAsync()
    CutOffs.get(context).look(trigger, pending::finish)
  }
}
