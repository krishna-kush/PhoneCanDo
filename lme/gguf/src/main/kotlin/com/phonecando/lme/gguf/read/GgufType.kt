package com.phonecando.lme.gguf.read

/** GGUF metadata value types by their on-disk id; [size] is the fixed width in bytes, 0 for string and array. */
enum class GgufType(val id: Int, val size: Int) {
    UINT8(0, 1),
    INT8(1, 1),
    UINT16(2, 2),
    INT16(3, 2),
    UINT32(4, 4),
    INT32(5, 4),
    FLOAT32(6, 4),
    BOOL(7, 1),
    STRING(8, 0),
    ARRAY(9, 0),
    UINT64(10, 8),
    INT64(11, 8),
    FLOAT64(12, 8),
    ;

    val isInteger: Boolean get() = this in INTEGERS

    companion object {
        private val BY_ID = entries.associateBy { it.id }
        private val INTEGERS = setOf(UINT8, INT8, UINT16, INT16, UINT32, INT32, UINT64, INT64)

        fun of(id: Long): GgufType? = if (id in 0..Int.MAX_VALUE) BY_ID[id.toInt()] else null
    }
}
