package com.phonecando.runner.appaccess

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// A tap on PhoneCanDo's own screen while the user has a question there.
class OwnQuestionsTest {
  @Test fun ownAppWithAQuestionWaitingIsRefused() {
    assertTrue(OwnQuestions.refuse(OWN, OWN) { true })
  }

  @Test fun ownAppWithNoQuestionPasses() {
    assertFalse(OwnQuestions.refuse(OWN, OWN) { false })
  }

  @Test fun anotherAppPassesWithoutLookingAtTheQuestions() {
    assertFalse(OwnQuestions.refuse("com.example.bank", OWN) { error("not asked") })
    assertFalse(OwnQuestions.refuse(null, OWN) { error("not asked") })
  }

  @Test fun noOwnPackageMeansNoCheck() {
    assertFalse(OwnQuestions.refuse(OWN, null) { true })
  }
}
