package com.phonecando.runner.api

import android.content.Context
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.agents.KindCatalogs
import com.phonecando.runner.agents.user.UserKinds
import expo.modules.kotlin.modules.ModuleDefinitionBuilder

// The agent kinds the user added, for JS (engine/agents/user/native.ts):
// each with what keeps it from loading, one's JSON, a check, a save and a
// delete (agents/user/UserKinds). A save or delete reloads the kind catalog
// in place (KindCatalogs.reload), so the Choose agent step offers a new
// kind at once; an engine that runs keeps the kind it started with. A
// delete is refused while an agent is of that kind. All synchronous: the
// files are small.
internal fun ModuleDefinitionBuilder.userKindFunctions(context: () -> Context) {
  // [{ id, label, problem }]: problem null when the kind loads.
  Function("listUserKinds") {
    KindCatalogs.userKinds(context()).list().map { e ->
      mapOf("id" to e.id, "label" to e.label, "problem" to e.problem?.let(::problemToJs))
    }
  }

  // The kind's JSON as saved; null when there is no such kind.
  Function("readUserKind") { id: String ->
    KindCatalogs.userKinds(context()).read(id)
  }

  // [{ path, detail }]: why the JSON would not load as a user kind; empty when it would.
  Function("validateUserKind") { json: String ->
    KindCatalogs.userKinds(context()).check(json).map(::problemToJs)
  }

  // { id, problems }: id null and nothing written when there are problems;
  // a kind of the same id is replaced only with [replace].
  Function("saveUserKind") { json: String, replace: Boolean ->
    val ctx = context()
    when (val saved = KindCatalogs.userKinds(ctx).save(json, replace)) {
      is UserKinds.Saved.Done -> {
        KindCatalogs.reload(ctx)
        mapOf("id" to saved.id, "problems" to emptyList<Any>())
      }
      is UserKinds.Saved.Refused -> mapOf("id" to null, "problems" to saved.problems.map(::problemToJs))
    }
  }

  // { deleted, usedBy }: usedBy names the agents of the kind, which keep it.
  Function("deleteUserKind") { id: String ->
    val ctx = context()
    val usedBy = AgentStores.get(ctx).all().filter { it.kind == id }.map { it.name }
    when (val gone = KindCatalogs.userKinds(ctx).delete(id, usedBy)) {
      is UserKinds.Deleted.Done -> {
        if (gone.found) KindCatalogs.reload(ctx)
        mapOf("deleted" to gone.found, "usedBy" to emptyList<String>())
      }
      is UserKinds.Deleted.InUse -> mapOf("deleted" to false, "usedBy" to gone.agents)
    }
  }
}

private fun problemToJs(p: UserKinds.Problem): Map<String, String> = mapOf("path" to p.path, "detail" to p.detail)
