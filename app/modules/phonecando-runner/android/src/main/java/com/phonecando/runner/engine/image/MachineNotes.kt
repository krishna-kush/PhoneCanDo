package com.phonecando.runner.engine.image

import com.phonecando.agents.kit.AgentKind
import com.phonecando.runner.agents.AgentDirectory
import com.phonecando.runner.agents.AgentRecord
import java.io.File

// Keeps the machine-mates note (MachineNote) current in the instructions
// file of every agent on one machine (kit AgentKind.instructionsFile, in
// the agent's own state folder when it keeps one: AgentFiles): after an
// agent is made, renamed or deleted there, and on every engine start
// (after the seeder may have written the file afresh). An agent whose kind
// has no instructions file, or is not in this build, gets no note but is
// named in the others'. One agent's file failing never stops the others';
// [failed] hears of it. Pure JVM over the agents and kinds given.
internal class MachineNotes(
  private val agents: AgentDirectory,
  private val kinds: (String) -> AgentKind?,
) {
  /** [home]: the machine's HOME (host path), where every agent's file is. */
  fun refresh(imageId: String, home: File, failed: (AgentRecord, Exception) -> Unit) {
    val onMachine = agents.onMachine(imageId)
    val mates = onMachine.associate { it.id to MachineNote.Mate(it.name, kinds(it.kind)?.displayName ?: it.kind) }
    for (agent in onMachine) {
      try {
        val file = kinds(agent.kind)?.instructionsFile(home, AgentFiles.ownState(home, agent)) ?: continue
        val others = onMachine.filter { it.id != agent.id }.map { mates.getValue(it.id) }
        MachineNote.apply(file, MachineNote.body(mates.getValue(agent.id), others))
      } catch (e: Exception) {
        failed(agent, e)
      }
    }
  }
}
