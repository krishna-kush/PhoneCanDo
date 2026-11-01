plugins {
    application
    kotlin("jvm")
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation("com.phonecando.pce:pce-api:0.1.0-dev")
}

application {
    mainClass.set("com.phonecando.pce.consumer.api.MainKt")
}
