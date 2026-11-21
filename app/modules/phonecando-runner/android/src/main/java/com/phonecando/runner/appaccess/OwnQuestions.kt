package com.phonecando.runner.appaccess

// PhoneCanDo is never asked about (AppAccessRules), so an agent could drive
// its own screens, the question that would let it into an app among them.
// While the user has a question to answer there (an app, an unlock, an
// agent's permission), an agent's tap or pack run on PhoneCanDo's screen
// is refused (409 user_deciding): only the user answers. Looking stays
// allowed, and answers behind the biometric were safe anyway. Pure.
object OwnQuestions {
  /** `waiting` is only asked when PhoneCanDo is in front. */
  fun refuse(front: String?, own: String?, waiting: () -> Boolean): Boolean =
    own != null && front == own && waiting()
}
