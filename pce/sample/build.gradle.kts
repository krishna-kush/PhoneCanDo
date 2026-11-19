plugins {
    application
    kotlin("jvm")
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(project(":core"))
    implementation(project(":testkit"))
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.11.0")
}

application {
    mainClass.set("com.phonecando.pce.sample.MainKt")
}
