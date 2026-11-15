package com.phonecando.runner.checks.rules

import com.phonecando.agents.kit.Capability
import com.phonecando.agents.kit.MessagingLevel

// How far messages reach an agent of a kind now: its declared level
// (MessagingLevel), dropped one step at a time while what that level rests
// on is not ok. [ok]: the capabilities it declares that are not failed now.
//   wakes      stays with wake or acp ok, else try delivered
//   delivered  stays with messages or acp ok, else try inbox
//   inbox      stays with tools ok, else none
// Pure.
internal object LevelNow {
  fun of(declared: MessagingLevel, ok: Set<Capability>): MessagingLevel {
    var level = declared
    if (level == MessagingLevel.WAKES && Capability.WAKE !in ok && Capability.ACP !in ok) level = MessagingLevel.DELIVERED
    if (level == MessagingLevel.DELIVERED && Capability.MESSAGES !in ok && Capability.ACP !in ok) level = MessagingLevel.INBOX
    if (level == MessagingLevel.INBOX && Capability.TOOLS !in ok) level = MessagingLevel.NONE
    return level
  }
}
