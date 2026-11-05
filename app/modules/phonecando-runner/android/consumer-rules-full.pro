# Full flavor only (build.gradle). AutomationHost.kt looks FullAutomation up
# by name and reads its INSTANCE field, so R8 must keep both; without them a
# minified full build would lose its automation host and every gated bridge
# call would answer automation_off.
-keep class com.phonecando.runner.FullAutomation {
    public static final com.phonecando.runner.FullAutomation INSTANCE;
}
