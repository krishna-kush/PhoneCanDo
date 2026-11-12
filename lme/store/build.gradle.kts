plugins {
    `java-library`
    kotlin("jvm")
    `maven-publish`
    kotlin("plugin.serialization")
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    api(project(":api"))
    api(project(":gguf"))
    // Resumable verified downloads and sha256 (network/).
    implementation("com.phonecando.network:network-download:0.1.0-dev")
    // models.json only; kept internal to this module. Same version as lre.
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.12.0")
    testImplementation(testFixtures("com.phonecando.network:network-http:0.1.0-dev"))
    testImplementation(testFixtures("com.phonecando.network:network-download:0.1.0-dev"))
    testImplementation(testFixtures(project(":gguf")))
    testImplementation(kotlin("test-junit5"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.test {
    useJUnitPlatform()
    // Test model dirs live under build/, not the system temp dir.
    systemProperty("java.io.tmpdir", temporaryDir.absolutePath)
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            from(components["java"])
            artifactId = "lme-store"
        }
    }
}
