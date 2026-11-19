package com.phonecando.runner.presence

/** How the agent says it is getting on: at work, thinking it over, or waiting on something. */
enum class StatusMood { WORKING, THINKING, WAITING }

/** An agent's own short line on what it is doing now (agents_status), and when it said it (elapsedRealtime). */
data class AgentStatus(val text: String, val mood: StatusMood, val at: Long)
