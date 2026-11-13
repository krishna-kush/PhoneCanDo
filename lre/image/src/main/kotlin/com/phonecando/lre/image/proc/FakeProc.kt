package com.phonecando.lre.image.proc

/**
 * Static stand-ins for the /proc files Android's sepolicy won't let an app
 * read, bound over them in the guest so top, ps, free, uptime and friends
 * work. Our own numbers: one quiet hour on an idle phone. stat and uptime
 * agree with each other (uptime's idle field is the sum of every CPU's idle
 * ticks) and list the host's real CPU ids, so they match the /proc/cpuinfo
 * the guest reads beside them. sys/kernel/hostname says the image's
 * hostname, as uname does (the phone's says `localhost`). Pure.
 */
internal object FakeProc {
    /** The kernel release the guest sees in `uname -r` and /proc/version. */
    const val KERNEL_RELEASE = "6.1.0-phonecando"

    /** The kernel version the guest sees in `uname -v` and /proc/version. */
    const val KERNEL_VERSION = "#1 SMP PREEMPT Thu Jan 1 00:00:00 UTC 2026"

    /** File names under run/proc/, each bound at /proc/<name>. */
    val NAMES = listOf("loadavg", "stat", "uptime", "version", "vmstat", "sys/kernel/hostname")

    private const val USER_HZ = 100
    private const val UPTIME_SECONDS = 3600

    /**
     * Per-CPU tick rows (user nice system idle iowait irq softirq steal
     * guest guest_nice), each summing to [UPTIME_SECONDS] x [USER_HZ];
     * CPUs past the fourth reuse them in turn.
     */
    private val CPU_ROWS = listOf(
        longArrayOf(21530, 112, 9870, 326540, 1210, 0, 738, 0, 0, 0),
        longArrayOf(18420, 95, 8710, 331180, 980, 0, 615, 0, 0, 0),
        longArrayOf(12040, 40, 6230, 340610, 640, 0, 440, 0, 0, 0),
        longArrayOf(9310, 22, 5120, 344870, 410, 0, 268, 0, 0, 0),
    )
    private const val IDLE = 3

    /** Every fake file by name, for the CPUs [cpuIds] (cpu0 alone when empty) and [hostname]. */
    fun files(cpuIds: List<Int>, hostname: String): Map<String, String> = mapOf(
        "loadavg" to "0.08 0.05 0.01 1/128 512\n",
        "stat" to stat(cpuIds),
        "uptime" to uptime(cpuIds),
        "version" to VERSION,
        "vmstat" to VMSTAT,
        "sys/kernel/hostname" to "$hostname\n",
    )

    fun stat(cpuIds: List<Int>): String {
        val rows = rows(cpuIds)
        val total = LongArray(10) { col -> rows.sumOf { it.second[col] } }
        return buildString {
            append("cpu  ").append(total.joinToString(" ")).append('\n')
            rows.forEach { (id, row) -> append("cpu$id ").append(row.joinToString(" ")).append('\n') }
            append(STAT_TAIL)
        }
    }

    fun uptime(cpuIds: List<Int>): String {
        val idleTicks = rows(cpuIds).sumOf { it.second[IDLE] }
        val hundredths = (idleTicks % USER_HZ).toString().padStart(2, '0')
        return "$UPTIME_SECONDS.00 ${idleTicks / USER_HZ}.$hundredths\n"
    }

    private fun rows(cpuIds: List<Int>): List<Pair<Int, LongArray>> =
        cpuIds.ifEmpty { listOf(0) }.mapIndexed { i, id -> id to CPU_ROWS[i % CPU_ROWS.size] }

    private const val VERSION = "Linux version $KERNEL_RELEASE (phonecando@phonecando) " +
        "(clang version 18.0.0, LLD 18.0.0) $KERNEL_VERSION\n"

    /** softirq: the total, then HI TIMER NET_TX NET_RX BLOCK IRQ_POLL TASKLET SCHED HRTIMER RCU. */
    private const val STAT_TAIL = "intr 412093\n" +
        "ctxt 873412\n" +
        "btime 1767225600\n" +
        "processes 1342\n" +
        "procs_running 1\n" +
        "procs_blocked 0\n" +
        "softirq 201544 0 41022 12 38411 9120 0 310 70233 0 42436\n"

    private val VMSTAT = listOf(
        "nr_free_pages" to 412870,
        "nr_zone_inactive_anon" to 98213,
        "nr_zone_active_anon" to 154022,
        "nr_zone_inactive_file" to 201877,
        "nr_zone_active_file" to 176540,
        "nr_zone_unevictable" to 2310,
        "nr_zone_write_pending" to 12,
        "nr_mlock" to 2310,
        "nr_inactive_anon" to 98213,
        "nr_active_anon" to 154022,
        "nr_inactive_file" to 201877,
        "nr_active_file" to 176540,
        "nr_unevictable" to 2310,
        "nr_slab_reclaimable" to 30122,
        "nr_slab_unreclaimable" to 41870,
        "nr_anon_pages" to 240115,
        "nr_mapped" to 120334,
        "nr_file_pages" to 401298,
        "nr_dirty" to 12,
        "nr_writeback" to 0,
        "nr_shmem" to 9876,
        "nr_kernel_stack" to 28416,
        "nr_page_table_pages" to 15022,
        "nr_swapcached" to 0,
        "pgpgin" to 2104332,
        "pgpgout" to 512998,
        "pswpin" to 0,
        "pswpout" to 0,
        "pgalloc_normal" to 9120443,
        "pgfree" to 9533310,
        "pgactivate" to 210334,
        "pgdeactivate" to 0,
        "pgfault" to 6120998,
        "pgmajfault" to 4410,
        "pgrefill" to 0,
        "pgsteal_kswapd" to 0,
        "pgsteal_direct" to 0,
        "pgscan_kswapd" to 0,
        "pgscan_direct" to 0,
        "oom_kill" to 0,
    ).joinToString("") { (key, value) -> "$key $value\n" }
}
