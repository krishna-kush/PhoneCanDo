package com.phonecando.runner.appaccess

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AppTargetsTest {
  private fun act(action: Any?) = JSONObject().put("snapshotId", 1).putOpt("action", action)

  @Test fun aLaunchNamesItsPackageAsAnObjectOrAsText() {
    val launch = JSONObject().put("type", "launch").put("packageName", " com.whatsapp ")
    assertEquals("com.whatsapp", AppTargets.launched(act(launch)))
    assertEquals("com.whatsapp", AppTargets.launched(act(launch.toString())))
  }

  @Test fun anythingElseNamesNone() {
    assertNull(AppTargets.launched(act(JSONObject().put("type", "tap"))))
    assertNull(AppTargets.launched(act(JSONObject().put("type", "launch"))))
    assertNull(AppTargets.launched(act("not json")))
    assertNull(AppTargets.launched(act(null)))
  }
}
