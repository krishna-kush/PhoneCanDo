package com.phonecando.runner.appaccess

import android.content.Context

// The process's one app-access list, shared by the bridge (the gate and
// /app-access) and the app (the question's answers, Settings). Made on
// first use, which reads and checks the saved answers. Lite and play never
// use it: they have no phone control.
object AppAccesses {
  @Volatile
  private var access: AppAccess? = null

  fun get(context: Context): AppAccess = access ?: synchronized(this) {
    access ?: run {
      val app = context.applicationContext
      val phone = PhoneApps(app)
      AppAccess(KeystoreAppAccessStore(app), phone::exempt, phone::label)
    }.also { access = it }
  }
}
