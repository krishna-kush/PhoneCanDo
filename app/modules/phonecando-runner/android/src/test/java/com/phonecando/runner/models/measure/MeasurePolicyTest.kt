package com.phonecando.runner.models.measure

import com.phonecando.lme.api.serve.MeasuredMemory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MeasurePolicyTest {
  private val m = MeasuredMemory("cpu=asimddp;server=9", 32_768, true, 1, 2, 3, 4)

  @Test fun aMeasurementHoldsForThePhoneAndBuildItWasTakenOn() {
    assertEquals(m, MeasurePolicy.usable(m, "cpu=asimddp;server=9"))
    assertNull(MeasurePolicy.usable(m, "cpu=asimddp,i8mm;server=9"))
    assertNull(MeasurePolicy.usable(m, "cpu=asimddp;server=10"))
    assertNull(MeasurePolicy.usable(null, "x"))
  }

  @Test fun aStartMeasuresAgainAtAnotherContextOrNoteSize() {
    assertTrue(MeasurePolicy.fresh(m, 32_768, true))
    assertFalse(MeasurePolicy.fresh(m, 65_536, true))
    assertFalse(MeasurePolicy.fresh(m, 32_768, false))
    assertFalse(MeasurePolicy.fresh(null, 32_768, true))
  }
}
