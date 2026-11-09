package com.phonecando.runner.agents.install

/** Typed reasons an install call is refused; [code] is what JS matches (state/flows/logic/installErrors.ts). */
enum class InstallError(val code: String) {
  /** The kind cannot be installed on the image's family, or needs a runtime this build lacks. */
  NO_RECIPE("no_recipe"),

  /** The version check's output names no version. */
  VERIFY_FAILED("verify_failed"),
}

/** A refused install call: the message starts with the code, so JS can read it from either. */
class InstallException(val error: InstallError, detail: String) : Exception("${error.code}: $detail")
