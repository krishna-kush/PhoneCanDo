package com.phonecando.runner.api

import android.content.Context
import com.phonecando.runner.AutomationHosts
import com.phonecando.runner.appaccess.AppAccessRules
import com.phonecando.runner.appaccess.AppAccesses
import com.phonecando.runner.appaccess.AppIcons
import com.phonecando.runner.bridge.BridgePrompts
import expo.modules.kotlin.modules.ModuleDefinitionBuilder

// Which apps agents may reach (appaccess/), for the app's question and
// Settings → Phone control, and each app's icon for both. Only the app
// calls these; "always" and Allow all on come right after the user's
// biometric, as the store signs them.
// Defined in full builds only (the one with an automation host): lite and
// play have no phone control, and JS reads the functions' absence as "not
// in this build".
internal fun ModuleDefinitionBuilder.appAccessFunctions(context: () -> Context) {
  AutomationHosts.install()
  if (AutomationHosts.current == null) return

  // { allowAll, apps: [{ package, label, state: "always" | "blocked" }] }, by label.
  Function("appAccessList") {
    val access = AppAccesses.get(context())
    mapOf(
      "allowAll" to access.allowAll,
      "apps" to access.entries().map { mapOf("package" to it.pkg, "label" to it.label, "state" to it.state) },
    )
  }

  // The answer to one app prompt: "always" | "once" | "no". False when
  // "always" could not be signed (no biometric just now; the prompt keeps
  // waiting), the prompt is gone or the answer is unknown.
  Function("resolveAppAccess") { requestId: String, answer: String ->
    BridgePrompts.resolveApp(AppAccesses.get(context()), requestId, answer)
  }

  // From Settings: "always" (right after the biometric), "blocked" (always
  // applies), or "none" (off both lists: asked again). False when refused:
  // "always" with no biometric just now, or under Allow all a "none" or
  // "always" that lifts a block (it re-signs Allow all) with none.
  Function("setAppAccess") { pkg: String, state: String ->
    if (!AppAccessRules.isPackageName(pkg)) return@Function false
    val access = AppAccesses.get(context())
    when (state) {
      "always" -> access.setAlways(pkg)
      "blocked" -> {
        access.block(pkg)
        true
      }
      "none" -> access.forget(pkg)
      else -> false
    }
  }

  // On right after the biometric; off needs nothing. Returns the switch as kept.
  Function("setAllowAllApps") { on: Boolean ->
    AppAccesses.get(context()).setAllowAll(on)
  }

  // The app's launcher icon drawn sizePx square (16 to 512), as the file://
  // URI of a PNG in the cache; null when Android hides the app, it has no
  // icon or the package is not a package name. Off the JS thread: the first
  // draw of each takes a moment.
  AsyncFunction("appIcon") { pkg: String, sizePx: Int ->
    AppIcons(context()).uri(pkg, sizePx)
  }
}
