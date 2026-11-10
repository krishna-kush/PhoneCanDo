package com.phonecando.lme.host

import com.phonecando.lme.api.device.DeviceInfo
import com.phonecando.lme.api.model.ModelRecord

/**
 * What the host knows when it wants a model served.
 *
 * @property modelPath absolute path of [model]'s entry file
 * @property executable absolute path of the server binary (the APK's
 *   native-library dir, the only place Android lets us exec from)
 * @property port a free loopback port the host picked
 * @property apiKey a fresh random key per boot ([com.phonecando.lme.host.key.ApiKeys]);
 *   never logged, so [toString] leaves it out
 */
data class LaunchRequest(
    val model: ModelRecord,
    val modelPath: String,
    val executable: String,
    val device: DeviceInfo,
    val port: Int,
    val apiKey: String,
) {
    override fun toString(): String =
        "LaunchRequest(model=${model.id}, modelPath=$modelPath, executable=$executable, port=$port, apiKey=<hidden>)"
}
