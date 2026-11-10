package com.phonecando.lme.host.ram

/** A phone's marketed RAM size from the total it reports. Pure. */
object RamClass {
    private const val GIB = 1L shl 30

    /**
     * The smallest marketed size (in GB, read as GiB) the reported
     * [totalBytes] fits in; past the list, the total rounded up.
     */
    fun of(totalBytes: Long): Int {
        require(totalBytes > 0) { "total RAM is positive" }
        return RamRules.MARKETED_GB.firstOrNull { totalBytes <= it * GIB }
            ?: ((totalBytes + GIB - 1) / GIB).toInt()
    }
}
