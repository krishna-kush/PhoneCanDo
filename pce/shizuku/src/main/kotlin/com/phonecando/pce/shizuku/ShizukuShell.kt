package com.phonecando.pce.shizuku

import android.content.pm.PackageManager
import android.os.ParcelFileDescriptor
import com.phonecando.pce.api.PceError
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import moe.shizuku.server.IRemoteProcess
import moe.shizuku.server.IShizukuService
import rikka.shizuku.Shizuku
import rikka.shizuku.ShizukuBinderWrapper

/**
 * Privileged shell runner backed by a granted Shizuku service.
 *
 * The host owns the Shizuku installation, permission request and provider
 * declaration. This adapter never prompts: no binder or no permission returns
 * [ErrorCode.BACKEND_UNAVAILABLE].
 *
 * shortcut: uses the Shizuku 13 AIDL `newProcess`, which Shizuku marks for
 * removal; move to a UserService before Shizuku API 14.
 */
class ShizukuShell(
    private val timeoutMs: Long = 5_000,
) : ShellRunner {
    override suspend fun run(command: String): PceResult<ShellOutput> =
        withContext(Dispatchers.IO) {
            availability()?.let { return@withContext it }
            try {
                val binder = Shizuku.getBinder()
                    ?: return@withContext unavailable("Shizuku binder is unavailable")
                val service = IShizukuService.Stub.asInterface(ShizukuBinderWrapper(binder))
                val process = service.newProcess(arrayOf("sh", "-c", command), null, null)
                    ?: return@withContext unavailable("Shizuku did not create a shell process")
                try {
                    execute(process)
                } finally {
                    destroy(process)
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                PceResult.Err(
                    PceError(
                        ErrorCode.INTERNAL,
                        failure.message ?: "Shizuku shell failed",
                    ),
                )
            }
        }

    private fun availability(): PceResult.Err? = try {
        when {
            !Shizuku.pingBinder() -> unavailable("Shizuku is not installed or not running")
            Shizuku.isPreV11() -> unavailable("Shizuku 11 or newer is required")
            Shizuku.checkSelfPermission() != PackageManager.PERMISSION_GRANTED ->
                unavailable("Shizuku permission is not granted")
            else -> null
        }
    } catch (failure: Exception) {
        unavailable(failure.message ?: "Shizuku is unavailable")
    }

    private suspend fun execute(process: IRemoteProcess): PceResult<ShellOutput> {
        // shortcut: commands are expected to produce small output; a process that
        // fills a pipe before exiting needs a streaming UserService.
        val finished = process.waitForTimeout(timeoutMs, "MILLISECONDS")
        if (!finished) {
            return PceResult.Err(
                PceError(ErrorCode.TIMEOUT, "Shizuku command timed out after ${timeoutMs}ms"),
            )
        }
        return coroutineScope {
            val stderr = async(Dispatchers.IO) { read(process.getErrorStream()) }
            val stdout = read(process.getInputStream())
            val exitCode = process.exitValue()
            PceResult.Ok(ShellOutput(exitCode, stdout, stderr.await()))
        }
    }

    private fun read(descriptor: ParcelFileDescriptor): String =
        ParcelFileDescriptor.AutoCloseInputStream(descriptor).bufferedReader().use { it.readText() }

    private fun destroy(process: IRemoteProcess) {
        try {
            process.destroy()
        } catch (_: Exception) {
            // The process may already be gone; nothing to recover.
        }
    }

    private fun unavailable(message: String): PceResult.Err =
        PceResult.Err(PceError(ErrorCode.BACKEND_UNAVAILABLE, message))
}
