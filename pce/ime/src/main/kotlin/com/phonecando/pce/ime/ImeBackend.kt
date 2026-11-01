package com.phonecando.pce.ime

import android.inputmethodservice.InputMethodService
import android.view.KeyEvent
import android.view.inputmethod.InputConnection
import com.phonecando.pce.api.Backend
import com.phonecando.pce.api.BackendAction
import com.phonecando.pce.api.Capability
import com.phonecando.pce.api.PceError
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.KeyCode
import com.phonecando.pce.api.ObserveOptions
import com.phonecando.pce.api.RawSnapshot
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Host owns the input method service; the PCE only needs a live handle. */
fun interface ImeServiceProvider {
    fun get(): InputMethodService?
}

/**
 * Text and key backend over the active [InputMethodService].
 *
 * The IME has no node identity: [BackendAction.SetText.backendNodeId] is
 * ignored, so the host must ensure the intended field is focused. Observation
 * belongs to another backend, for example the accessibility backend.
 */
class ImeBackend(
    private val serviceProvider: ImeServiceProvider,
    override val id: String = "android-ime",
) : Backend {
    override val capabilities: Set<Capability> = setOf(
        Capability.SET_TEXT,
        Capability.KEY,
    )

    override suspend fun observe(options: ObserveOptions): PceResult<RawSnapshot> =
        error(ErrorCode.UNSUPPORTED_ACTION, "The IME backend cannot observe; use an observing backend")

    override suspend fun execute(action: BackendAction): PceResult<Unit> =
        withContext(Dispatchers.Main) {
            try {
                when (action) {
                    is BackendAction.SetText, is BackendAction.Key -> {
                        val service = serviceProvider.get()
                            ?: return@withContext error(
                                ErrorCode.BACKEND_UNAVAILABLE,
                                "Input method service is not connected",
                            )
                        val connection = service.currentInputConnection
                            ?: return@withContext error(
                                ErrorCode.BACKEND_UNAVAILABLE,
                                "No focused input connection",
                            )
                        when (action) {
                            is BackendAction.SetText -> setText(connection, action)
                            is BackendAction.Key -> key(connection, action.key)
                            else -> error(ErrorCode.UNSUPPORTED_ACTION, "Unsupported IME action")
                        }
                    }
                    else -> error(
                        ErrorCode.UNSUPPORTED_ACTION,
                        "${action::class.simpleName} is not supported by the IME backend",
                    )
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                error(ErrorCode.INTERNAL, failure.message ?: "IME action failed")
            }
        }

    private fun setText(
        connection: InputConnection,
        action: BackendAction.SetText,
    ): PceResult<Unit> {
        if (action.clear) {
            if (!connection.performContextMenuAction(android.R.id.selectAll)) {
                return error(ErrorCode.UNSUPPORTED_ACTION, "Input connection rejected select-all")
            }
            // shortcut: clear is select-all + Delete; upgrade if a field rejects select-all.
            connection.sendKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_DEL))
            connection.sendKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_DEL))
        }
        return if (connection.commitText(action.text, 1)) {
            ok()
        } else {
            error(ErrorCode.UNSUPPORTED_ACTION, "Input connection rejected text")
        }
    }

    private fun key(connection: InputConnection, key: KeyCode): PceResult<Unit> {
        val keyCode = when (key) {
            KeyCode.ENTER -> KeyEvent.KEYCODE_ENTER
            // shortcut: Backspace uses KEYCODE_DEL; upgrade to deleteSurroundingText if a field ignores it.
            KeyCode.DELETE -> KeyEvent.KEYCODE_DEL
            else -> return error(
                ErrorCode.UNSUPPORTED_ACTION,
                "Key $key is not supported by the IME backend",
            )
        }
        val down = connection.sendKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, keyCode))
        val up = connection.sendKeyEvent(KeyEvent(KeyEvent.ACTION_UP, keyCode))
        return if (down && up) {
            ok()
        } else {
            error(ErrorCode.UNSUPPORTED_ACTION, "Input connection rejected key $key")
        }
    }

    private fun ok(): PceResult<Unit> = PceResult.Ok(Unit)

    private fun <T> error(code: ErrorCode, message: String): PceResult<T> =
        PceResult.Err(PceError(code, message))
}
