package com.phonecando.runner.presence

/**
 * What you can do with the controls, from the mascot, the app or a
 * notification: take them and let the agent watch (LET_ME), take them and
 * stop it (STOP), hand them back (GIVE_BACK), start a paused agent again
 * (START_AGAIN), or keep it stopped and close the hand-over (LEAVE).
 */
enum class UserAct { LET_ME, STOP, GIVE_BACK, START_AGAIN, LEAVE }
