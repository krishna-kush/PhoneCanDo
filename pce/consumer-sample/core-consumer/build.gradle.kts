plugins {
    application
    kotlin("jvm")
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation("com.phonecando.pce:pce-core:0.1.0-dev")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.10.2")
}

application {
    mainClass.set("com.phonecando.pce.consumer.core.MainKt")
}
