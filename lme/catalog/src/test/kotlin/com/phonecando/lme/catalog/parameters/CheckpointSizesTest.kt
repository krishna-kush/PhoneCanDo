package com.phonecando.lme.catalog.parameters

import com.phonecando.lme.catalog.filters.ModelSize
import kotlinx.serialization.json.Json
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class CheckpointSizesTest {
    private fun of(json: String) = CheckpointSizes.of(Json.parseToJsonElement(json))

    @Test
    fun `a float checkpoint counts, a few integer buffers aside`() {
        assertEquals(2_274_069_824L, of("""{"parameters":{"F32":2592,"BF16":2274067232},"total":2274069824}"""))
        assertEquals(179_999_981_459L, of("""{"parameters":{"BF16":179999981424,"I64":35},"total":179999981459}"""))
        // FP8 is one parameter per element (GLM-5.3-Flash).
        assertEquals(321_323_031_390L, of("""{"parameters":{"BF16":6926096640,"F8_E4M3":314396639232,"F32":295518},"total":321323031390}"""))
    }

    @Test
    fun `integer storage is a lower bound, taken only past 10B`() {
        // DeepSeek-V4-Flash: most of it in I8; past every edge whatever the packing.
        assertEquals(290_944_616_402L, of("""{"parameters":{"BF16":1415259264,"I64":2327040,"F32":36168018,"F8_E4M3":6023020544,"I8":283467841536},"total":290944616402}"""))
        // A 14B model packed eight to an I32 would read 1.85B: not a size we can bucket.
        assertNull(of("""{"parameters":{"I32":1750000000,"F16":100000000},"total":1850000000}"""))
        assertNull(of("""{"parameters":{"U8":50},"total":50}"""))
        assertNull(of("""{"parameters":{"I8":10000000000},"total":10000000000}"""))
        assertEquals(10_000_000_001L, of("""{"parameters":{"I8":10000000001},"total":10000000001}"""))
        // The bound sits on the last bucket's edge.
        assertTrue(ModelSize.OVER_10B.holds(ParameterCount(CheckpointSizes.LOWER_BOUND_FROM + 1)))
        assertFalse(ModelSize.OVER_10B.holds(ParameterCount(CheckpointSizes.LOWER_BOUND_FROM)))
    }

    @Test
    fun `an odd field is no count`() {
        assertNull(CheckpointSizes.of(null))
        assertNull(of("""[]"""))
        assertNull(of("""{"total":5}"""))
        assertNull(of("""{"parameters":{"BF16":5},"total":0}"""))
        assertNull(of("""{"parameters":{"BF16":"5"},"total":5}"""))
        assertNull(of("""{"parameters":{"BF16":-5},"total":5}"""))
        assertNull(of("""{"parameters":{},"total":5}"""))
        assertNull(of("""{"parameters":{"BF16":5},"total":"5"}"""))
        assertNull(of("""{"parameters":{"BF16":5},"total":1e300}"""))
    }
}
