package com.phonecando.runner.notify

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ServiceTapTest {
  private val models = LaunchTarget(LaunchTarget.MODELS, null)
  private val install = LaunchTarget(LaunchTarget.ENV, "a1")

  @Test fun oneThingListedLandsOnItsPlace() {
    assertEquals(models, ServiceTap.of(emptyList(), listOf(models, models), listOf("a1")))
    assertEquals(install, ServiceTap.of(emptyList(), listOf(install), emptyList()))
    assertEquals(LaunchTarget("home", "a1"), ServiceTap.of(listOf("a1", "a1"), emptyList(), emptyList()))
  }

  @Test fun chatsOfOneAgentWinOverOtherPlaces() {
    assertEquals(LaunchTarget("home", "a1"), ServiceTap.of(listOf("a1"), listOf(models), emptyList()))
  }

  @Test fun manyPlacesOpenTheAppAsItWas() {
    assertNull(ServiceTap.of(listOf("a1", "a2"), emptyList(), emptyList()))
    assertNull(ServiceTap.of(emptyList(), listOf(models, install), listOf("a1")))
  }

  @Test fun onlyEnginesReadyLandOnTheOneRunning() {
    assertEquals(LaunchTarget("home", "a1"), ServiceTap.of(emptyList(), emptyList(), listOf("a1")))
    assertNull(ServiceTap.of(emptyList(), emptyList(), listOf("a1", "a2")))
  }
}
