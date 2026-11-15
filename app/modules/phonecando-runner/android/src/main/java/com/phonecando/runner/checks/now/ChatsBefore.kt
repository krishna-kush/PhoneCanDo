package com.phonecando.runner.checks.now

import java.util.concurrent.ConcurrentHashMap

// The chat each agent was in before its check, which its next own-app
// start opens again once the check is over (CheckNow gives it back as the
// agent's kept chat, AgentRecord.acpChat): the one we kept for it when the
// check began (a terminal launch opens that next), else the one its ACP
// part would have gone back to (AcpAgentHandle.chatBefore: the newest it
// listed before the check made its own). Without either, nothing is
// known. Thread-safe; pure.
internal class ChatsBefore {
  private val chats = ConcurrentHashMap<String, String>()

  /** A check of [agentId] begins; [kept]: its kept chat now. */
  fun began(agentId: String, kept: String?) {
    if (kept != null) chats[agentId] = kept else chats.remove(agentId)
  }

  /** What its ACP part's driver would have gone back to; the kept one wins. */
  fun noted(agentId: String, before: String?) {
    if (before != null) chats.putIfAbsent(agentId, before)
  }

  /** The check is over: the chat to give back, once; null when none is known. */
  fun take(agentId: String): String? = chats.remove(agentId)
}
