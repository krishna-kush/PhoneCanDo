package com.phonecando.runner.engine.acp

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// JVM checks for opening the chat an ACP driver works in, against a fake
// agent: a task that wants its own chat gets a new one, anything else the
// one we kept, else the newest listed, reopened as the agent can, a new one
// when that fails; the bridge goes in only over HTTP; options are set
// where offered.
class AcpChatsTest {
  private class FakeAgent(private val answers: Map<String, (JSONObject) -> JSONObject>) : AcpRpc {
    val calls = ArrayList<Pair<String, JSONObject>>()

    override fun request(method: String, params: JSONObject, timeoutMs: Long): JSONObject {
      calls += method to params
      return answers[method]?.invoke(params) ?: throw AcpException(method, AcpError(AcpWire.METHOD_NOT_FOUND, "no"))
    }

    fun methods() = calls.map { it.first }
  }

  private val bridge = AcpBridge("http://127.0.0.1:9", "tok")
  private fun setup(options: Map<String, String> = emptyMap(), meta: String? = null) = AcpSetup("/w", meta, options, bridge, "1")

  private fun reply(json: String): (JSONObject) -> JSONObject = { JSONObject(json) }

  private val fresh = reply("""{"sessionId":"new"}""")
  private val opened = reply("{}")

  @Test fun aTaskThatWantsItsOwnChatGetsANewOne() {
    val agent = FakeAgent(mapOf(AcpWire.SESSION_NEW to fresh, AcpWire.SESSION_LIST to reply("{}")))
    val chats = AcpChats(agent, AcpCaps(list = true, loadSession = true, mcpHttp = true), setup(meta = """{"k":"v"}"""))
    assertEquals("new", chats.open(newChat = true, stored = "kept").chatId)
    assertEquals(listOf(AcpWire.SESSION_NEW), agent.methods())
    val params = agent.calls.single().second
    assertEquals("/w", params.getString("cwd"))
    assertEquals("http://127.0.0.1:9/mcp", params.getJSONArray("mcpServers").getJSONObject(0).getString("url"))
    assertEquals("v", params.getJSONObject("_meta").getString("k"))
  }

  @Test fun theChatBeforeAChatOfItsOwnIsTheKeptOneElseTheNewestListed() {
    val agent = FakeAgent(mapOf(AcpWire.SESSION_LIST to reply("""{"sessions":[{"sessionId":"listed"}]}""")))
    val chats = AcpChats(agent, AcpCaps(list = true, loadSession = true), setup())
    // The kept one is what a terminal launch opens next: no need to ask.
    assertEquals("kept", chats.before("kept"))
    assertTrue(agent.calls.isEmpty())
    assertEquals("listed", chats.before(null))
    assertEquals(listOf(AcpWire.SESSION_LIST), agent.methods())
    // An agent that cannot list: none.
    assertEquals(null, AcpChats(FakeAgent(emptyMap()), AcpCaps(loadSession = true), setup()).before(null))
  }

  @Test fun otherwiseTheKeptChatIsLoadedFirst() {
    val agent = FakeAgent(
      mapOf(
        AcpWire.SESSION_LIST to reply("""{"sessions":[{"sessionId":"listed"}]}"""),
        AcpWire.SESSION_LOAD to opened,
        AcpWire.SESSION_NEW to fresh,
      ),
    )
    val chats = AcpChats(agent, AcpCaps(list = true, loadSession = true, resume = true), setup())
    assertEquals("kept", chats.open(newChat = false, stored = "kept").chatId)
    // No need to ask for the list.
    assertEquals(listOf(AcpWire.SESSION_LOAD), agent.methods())
  }

  @Test fun withNoneKeptTheNewestListedChatIsLoaded() {
    val agent = FakeAgent(
      mapOf(
        AcpWire.SESSION_LIST to reply("""{"sessions":[{"sessionId":"listed"}]}"""),
        AcpWire.SESSION_LOAD to opened,
        AcpWire.SESSION_NEW to fresh,
      ),
    )
    val chats = AcpChats(agent, AcpCaps(list = true, loadSession = true, resume = true), setup())
    assertEquals("listed", chats.open(newChat = false, stored = null).chatId)
    assertEquals(listOf(AcpWire.SESSION_LIST, AcpWire.SESSION_LOAD), agent.methods())
    assertEquals("listed", agent.calls.last().second.getString("sessionId"))
  }

  @Test fun withoutAListTheKeptChatIsResumed() {
    val agent = FakeAgent(mapOf(AcpWire.SESSION_RESUME to opened, AcpWire.SESSION_NEW to fresh))
    val chats = AcpChats(agent, AcpCaps(resume = true), setup())
    assertEquals("kept", chats.open(newChat = false, stored = "kept").chatId)
    assertEquals(listOf(AcpWire.SESSION_RESUME), agent.methods())
  }

  @Test fun aChatThatWillNotReopenGivesWayToTheNext() {
    val agent = FakeAgent(
      mapOf(
        AcpWire.SESSION_LIST to reply("""{"sessions":[{"sessionId":"listed"}]}"""),
        AcpWire.SESSION_LOAD to { p: JSONObject ->
          if (p.getString("sessionId") == "kept") throw AcpException(AcpWire.SESSION_LOAD, AcpError(-32603, "gone")) else JSONObject()
        },
        AcpWire.SESSION_NEW to fresh,
      ),
    )
    val chats = AcpChats(agent, AcpCaps(list = true, loadSession = true), setup())
    assertEquals("listed", chats.open(newChat = false, stored = "kept").chatId)
    // Nothing to reopen at all: a new chat.
    val none = FakeAgent(mapOf(AcpWire.SESSION_NEW to fresh))
    assertEquals("new", AcpChats(none, AcpCaps(), setup()).open(newChat = false, stored = "kept").chatId)
    assertEquals(listOf(AcpWire.SESSION_NEW), none.methods())
  }

  @Test fun theBridgeGoesInOnlyOverHttp() {
    val agent = FakeAgent(mapOf(AcpWire.SESSION_NEW to fresh))
    AcpChats(agent, AcpCaps(mcpHttp = false), setup()).createNew()
    assertEquals(0, agent.calls.single().second.getJSONArray("mcpServers").length())
  }

  @Test fun aNewChatWithoutAnIdFails() {
    val agent = FakeAgent(mapOf(AcpWire.SESSION_NEW to reply("{}")))
    try {
      AcpChats(agent, AcpCaps(), setup()).createNew()
      throw AssertionError("expected a failure")
    } catch (e: AcpException) {
      assertEquals(AcpWire.SESSION_NEW, e.method)
    }
  }

  @Test fun optionsAreSetWhereOffered() {
    val logged = ArrayList<String>()
    val answer = JSONObject(
      """{"sessionId":"new","configOptions":[
        {"id":"mode","currentValue":"auto","options":[{"value":"default"},{"value":"auto"}]},
        {"id":"model","currentValue":"a","options":[{"value":"a"},{"value":"b"}]}]}""",
    )
    val agent = FakeAgent(
      mapOf(
        AcpWire.SESSION_NEW to { _: JSONObject -> answer },
        AcpWire.SET_CONFIG_OPTION to { p: JSONObject ->
          if (p.getString("configId") == "model") throw AcpException(AcpWire.SET_CONFIG_OPTION, AcpError(-32602, "locked")) else JSONObject()
        },
      ),
    )
    val chats = AcpChats(agent, AcpCaps(), setup(options = linkedMapOf("mode" to "default", "model" to "b", "x" to "y")), logged::add)
    chats.applyOptions(chats.createNew())
    val sets = agent.calls.filter { it.first == AcpWire.SET_CONFIG_OPTION }.map { it.second }
    assertEquals(listOf("mode", "model"), sets.map { it.getString("configId") })
    assertEquals("new", sets.first().getString("sessionId"))
    assertEquals("default", sets.first().getString("value"))
    // A refused option is skipped, and said.
    assertTrue(logged.single().contains("model"))
    assertFalse(logged.single().contains("tok"))
  }
}
