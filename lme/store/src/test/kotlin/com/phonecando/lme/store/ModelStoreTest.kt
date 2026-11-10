package com.phonecando.lme.store

import com.phonecando.lme.api.CancelSignal
import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.ProgressSink
import com.phonecando.lme.api.model.BaseModelRef
import com.phonecando.lme.api.model.ModelDates
import com.phonecando.lme.api.model.ModelSource
import com.phonecando.lme.api.testkit.FakePort
import com.phonecando.lme.api.testkit.reply
import com.phonecando.lme.store.download.DownloadRequest
import com.phonecando.lme.store.download.RemoteFile
import com.phonecando.lme.store.io.FreeSpace
import com.phonecando.lme.store.layout.ModelLayout
import com.phonecando.lme.store.registry.RegistryCodec
import com.phonecando.lme.store.support.Served
import com.phonecando.lme.store.support.TestModels
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.io.TempDir
import java.io.ByteArrayInputStream
import java.io.File
import java.security.MessageDigest
import java.time.LocalDate
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ModelStoreTest {
    @TempDir
    lateinit var root: File

    private val fake = FakePort()
    private var free = Long.MAX_VALUE
    private val store by lazy { ModelStore(ModelLayout(root), fake, FreeSpace { free }, clock = { 42 }) }
    private val sha = "0123456789012345678901234567890123456789"
    private val hub = "https://huggingface.co/acme/m-GGUF/resolve/$sha"

    private fun serve(name: String, bytes: ByteArray): RemoteFile {
        val served = Served(bytes)
        fake.on("$hub/$name", served::answer)
        return RemoteFile(name, "$hub/$name", bytes.size.toLong(), served.sha256)
    }

    @Test
    fun `a download becomes a model with its header's shape`() {
        val bytes = TestModels.gguf("Tiny Llama")
        val request = DownloadRequest("acme/m-GGUF", sha, listOf(serve("Tiny-Q4_K_M.gguf", bytes)))

        val pending = store.startDownload(request)
        assertEquals("tiny-q4-k-m", pending.id)
        assertEquals("Tiny-Q4_K_M", pending.name)
        assertEquals(listOf(pending), store.downloads())

        val record = store.download(pending.id)
        assertEquals("Tiny Llama", record.name)
        assertEquals(ModelSource.HuggingFace("acme/m-GGUF", sha), record.source)
        assertEquals("llama", record.shape.architecture)
        assertEquals("Q4_K_M", record.shape.quant)
        assertEquals(42, record.addedAtMillis)
        assertEquals(listOf(record), store.models())
        assertTrue(store.downloads().isEmpty())
        assertContentEquals(bytes, store.entryFile(record).readBytes())
        assertEquals(File(root, "tiny-q4-k-m/Tiny-Q4_K_M.gguf"), store.entryFile(record))
    }

    @Test
    fun `the token goes to Hugging Face only, never to its CDN or anywhere else`() {
        val bytes = TestModels.gguf()
        val served = Served(bytes)
        fake.on("$hub/a.gguf", { reply(302, headers = mapOf("Location" to "https://cdn.example/a?sig=1")) })
        fake.on("https://cdn.example/a?sig=1", served::answer)
        val pending = store.startDownload(DownloadRequest("acme/m-GGUF", sha, listOf(RemoteFile("a.gguf", "$hub/a.gguf", bytes.size.toLong(), served.sha256))))
        store.download(pending.id, token = "hf_secret")
        assertEquals("Bearer hf_secret", fake.requests[0].header("authorization"))
        assertNull(fake.requests[1].header("authorization"))

        val other = "https://mirror.example/b.gguf"
        fake.on(other, served::answer)
        val second = store.startDownload(DownloadRequest("acme/other", sha, listOf(RemoteFile("b.gguf", other, bytes.size.toLong(), served.sha256))))
        store.download(second.id, token = "hf_secret")
        assertNull(fake.requests.last().header("authorization"))
    }

    @Test
    fun `the catalog's dates stay with the download and the model it becomes`() {
        val dates = ModelDates.OnHub(LocalDate.of(2024, 9, 18))
        val request = DownloadRequest("acme/m-GGUF", sha, listOf(serve("m.gguf", TestModels.gguf())), dates)
        val pending = store.startDownload(request)
        val reopened = ModelStore(ModelLayout(root), fake, FreeSpace { free }, clock = { 42 })
        assertEquals(dates, reopened.downloads().single().dates)

        val record = reopened.download(pending.id)
        assertEquals(dates, record.dates)
        assertEquals(dates, store.models().single().dates)
    }

    @Test
    fun `starting the same download twice gives the same one, and a finished one exists`() {
        val request = DownloadRequest("acme/m-GGUF", sha, listOf(serve("m.gguf", TestModels.gguf())))
        val first = store.startDownload(request)
        assertEquals(first, store.startDownload(request))
        store.download(first.id)
        val e = assertThrows<LmeException.Exists> { store.startDownload(request) }
        assertEquals(first.id, e.id)
        // Another commit of the same file is another model.
        assertEquals("m-2", store.startDownload(request.copy(revision = "f".repeat(40))).id)
    }

    @Test
    fun `a request without a usable size or digest is a bug`() {
        val file = serve("m.gguf", TestModels.gguf())
        assertThrows<IllegalArgumentException> { store.startDownload(DownloadRequest("acme/m-GGUF", sha, emptyList())) }
        assertThrows<IllegalArgumentException> { store.startDownload(DownloadRequest("acme/m-GGUF", sha, listOf(file.copy(sha256 = file.sha256.uppercase())))) }
        assertThrows<IllegalArgumentException> { store.startDownload(DownloadRequest("acme/m-GGUF", sha, listOf(file.copy(sizeBytes = -1)))) }
        assertThrows<LmeException.InvalidName> { store.startDownload(DownloadRequest("acme/m-GGUF", sha, listOf(file.copy(name = "../m.gguf")))) }
        assertTrue(store.downloads().isEmpty())
    }

    @Test
    fun `no space, no download`() {
        val request = DownloadRequest("acme/m-GGUF", sha, listOf(serve("m.gguf", TestModels.gguf())))
        free = ModelStore.SPACE_MARGIN
        assertThrows<LmeException.NoSpace> { store.startDownload(request) }
        assertTrue(store.downloads().isEmpty())

        free = Long.MAX_VALUE
        val pending = store.startDownload(request)
        free = 10
        assertThrows<LmeException.NoSpace> { store.download(pending.id) }
    }

    @Test
    fun `an interrupted download resumes and shows its bytes on disk`() {
        val bytes = TestModels.gguf(padding = 20_000)
        val served = Served(bytes)
        val url = "$hub/m.gguf"
        fake.on(url, { Served(bytes, breakAfter = 7000).answer(it) }, served::answer)
        val pending = store.startDownload(DownloadRequest("acme/m-GGUF", sha, listOf(RemoteFile("m.gguf", url, bytes.size.toLong(), served.sha256))))

        assertThrows<LmeException.Network> { store.download(pending.id) }
        assertEquals(7000, store.bytesOnDisk(pending))
        store.download(pending.id)
        assertEquals("bytes=7000-", fake.requests.last().header("range"))
    }

    @Test
    fun `a split model downloads every part and loads from the first`() {
        val one = TestModels.gguf(splitCount = 2)
        val two = ByteArray(4000) { 1 }
        val files = listOf(serve("big-00001-of-00002.gguf", one), serve("big-00002-of-00002.gguf", two))
        val pending = store.startDownload(DownloadRequest("acme/m-GGUF", sha, files))
        assertEquals("big", pending.id)
        val record = store.download(pending.id)
        assertEquals(listOf("big-00001-of-00002.gguf", "big-00002-of-00002.gguf"), record.files.map { it.name })
        assertEquals(one.size + two.size.toLong(), record.sizeBytes)
        assertNull(record.shape.parameterCount)
        assertContentEquals(two, File(root, "big/big-00002-of-00002.gguf").readBytes())
    }

    @Test
    fun `parts already in place are not fetched again`() {
        val one = TestModels.gguf(splitCount = 2)
        val files = listOf(serve("big-00001-of-00002.gguf", one), serve("big-00002-of-00002.gguf", ByteArray(10)))
        val pending = store.startDownload(DownloadRequest("acme/m-GGUF", sha, files))
        File(root, "big").mkdirs()
        File(root, "big/big-00001-of-00002.gguf").writeBytes(one)
        store.download(pending.id)
        assertEquals(listOf("$hub/big-00002-of-00002.gguf"), fake.requests.map { it.url })
    }

    @Test
    fun `a download that is no model is removed with its files`() {
        val notAModel = ByteArray(1000) { 9 }
        val pending = store.startDownload(DownloadRequest("acme/m-GGUF", sha, listOf(serve("x.gguf", notAModel))))
        assertThrows<LmeException.InvalidGguf> { store.download(pending.id) }
        assertTrue(store.downloads().isEmpty())
        assertFalse(File(root, pending.id).exists())

        val wrongSplit = store.startDownload(DownloadRequest("acme/m-GGUF", sha, listOf(serve("y.gguf", TestModels.gguf(splitCount = 3)))))
        val e = assertThrows<LmeException.InvalidGguf> { store.download(wrongSplit.id) }
        assertEquals("one part of a model split into 3 files", e.reason)
    }

    @Test
    fun `a download deleted while it ran is not registered`() {
        val request = DownloadRequest("acme/m-GGUF", sha, listOf(serve("m.gguf", TestModels.gguf())))
        val pending = store.startDownload(request)
        var once = false
        val sink = ProgressSink {
            if (!once) {
                once = true
                File(root, "models.json").writeText("{\"version\":${RegistryCodec.VERSION}}")
            }
        }
        assertThrows<LmeException.NotFound> { store.download(pending.id, sink = sink) }
        assertTrue(store.models().isEmpty())
        assertThrows<LmeException.NotFound> { store.download("nope") }
    }

    @Test
    fun `an import is copied, checked and registered`() {
        val bytes = TestModels.gguf("Phone Model")
        val record = store.import(ByteArrayInputStream(bytes), "Phone-Q4_K_M.gguf", sizeHint = bytes.size.toLong())
        assertEquals("phone-q4-k-m", record.id)
        assertEquals("Phone Model", record.name)
        assertEquals(ModelSource.Imported("Phone-Q4_K_M.gguf"), record.source)
        assertEquals("phone-q4-k-m.gguf", record.entry.name)
        assertEquals(MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }, record.entry.sha256)
        assertContentEquals(bytes, store.entryFile(record).readBytes())
        assertEquals(listOf("phone-q4-k-m.gguf"), File(root, record.id).list()!!.toList())
        assertNull(record.dates)
        assertNull(record.shape.baseModel)

        assertEquals("phone-q4-k-m-2", store.import(ByteArrayInputStream(bytes), "Phone-Q4_K_M.gguf").id)
    }

    @Test
    fun `an import keeps the base model its header names`() {
        val bytes = TestModels.gguf(baseRepoUrl = "https://huggingface.co/Qwen/Qwen3.5-4B")
        store.import(ByteArrayInputStream(bytes), "q.gguf")
        assertEquals(BaseModelRef(null, null, "https://huggingface.co/Qwen/Qwen3.5-4B"), store.models().single().shape.baseModel)
    }

    @Test
    fun `a failed import leaves nothing behind`() {
        val bytes = TestModels.gguf()
        fun leftovers() = root.list()!!.filter { it != "models.json" }

        assertEquals("no GGUF magic", assertThrows<LmeException.InvalidGguf> { store.import(ByteArrayInputStream("PK\u0003\u0004zip".toByteArray()), "a.gguf") }.reason)
        assertThrows<LmeException.InvalidGguf> { store.import(ByteArrayInputStream(ByteArray(0)), "a.gguf") }
        assertEquals(
            "one part of a model split into 2 files",
            assertThrows<LmeException.InvalidGguf> { store.import(ByteArrayInputStream(TestModels.gguf(splitCount = 2)), "a.gguf") }.reason,
        )
        assertThrows<LmeException.SizeMismatch> { store.import(ByteArrayInputStream(bytes), "a.gguf", sizeHint = bytes.size + 1L) }
        assertThrows<LmeException.Cancelled> { store.import(ByteArrayInputStream(bytes), "a.gguf", cancel = CancelSignal { true }) }
        free = 0
        assertThrows<LmeException.NoSpace> { store.import(ByteArrayInputStream(bytes), "a.gguf", sizeHint = bytes.size.toLong()) }

        assertEquals(emptyList(), leftovers())
        assertTrue(store.models().isEmpty())
    }

    @Test
    fun `a chosen context is saved in place, up to the trained one, and null goes back to automatic`() {
        val first = store.import(ByteArrayInputStream(TestModels.gguf(contextLength = 65_536)), "a.gguf")
        val second = store.import(ByteArrayInputStream(TestModels.gguf()), "b.gguf")
        assertNull(first.context)

        assertEquals(32_768, store.setContext(first.id, 32_768).context)
        assertEquals(listOf(first.id to 32_768L, second.id to null), store.models().map { it.id to it.context })
        assertEquals(65_536, store.setContext(first.id, 65_536).context)
        assertThrows<IllegalArgumentException> { store.setContext(first.id, 65_537) }
        assertThrows<IllegalArgumentException> { store.setContext(first.id, 0) }
        assertNull(store.setContext(first.id, null).context)
        // A header without a trained context bounds nothing.
        assertEquals(100_000, store.setContext(second.id, 100_000).context)
        assertThrows<LmeException.NotFound> { store.setContext("never-was", 4_096) }
        assertEquals(listOf(null, 100_000L), store.models().map { it.context })
    }

    @Test
    fun `delete removes the record and the files`() {
        val record = store.import(ByteArrayInputStream(TestModels.gguf()), "m.gguf")
        val pending = store.startDownload(DownloadRequest("acme/m-GGUF", sha, listOf(serve("p.gguf", TestModels.gguf()))))
        File(root, "p/p.gguf.part").apply { parentFile.mkdirs() }.writeBytes(ByteArray(5))

        store.delete(record.id)
        store.delete(pending.id)
        store.delete("never-was")

        assertTrue(store.models().isEmpty())
        assertTrue(store.downloads().isEmpty())
        assertEquals(listOf("models.json"), root.list()!!.toList())
        assertThrows<LmeException.InvalidName> { store.delete("../etc") }
    }

    @Test
    fun `sweep removes only what nobody owns`() {
        val record = store.import(ByteArrayInputStream(TestModels.gguf()), "m.gguf")
        val pending = store.startDownload(DownloadRequest("acme/m-GGUF", sha, listOf(serve("p.gguf", TestModels.gguf()))))
        File(root, "orphan").mkdirs()
        File(root, "orphan/x.gguf.part").writeBytes(ByteArray(3))
        File(root, "Not.An.Id").mkdirs()

        store.sweep()
        assertEquals(setOf("models.json", record.id, "Not.An.Id"), root.list()!!.toSet())
        store.download(pending.id)
    }
}
