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
    // Resumable verified blob downloads and the per-host retry rules (network/).
    implementation("com.phonecando.network:network-download:0.1.0-dev")
    implementation("com.phonecando.network:network-retry:0.1.0-dev")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")
    // FakePort and the reply helpers replay recorded responses.
    testImplementation(testFixtures("com.phonecando.network:network-http:0.1.0-dev"))
    testImplementation(kotlin("test-junit5"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.test {
    useJUnitPlatform()
    // LRE_LIVE=1 turns on the live Docker Hub test; as an input, flipping it reruns the tests.
    inputs.property("lreLive", providers.environmentVariable("LRE_LIVE").orElse(""))
    // Blob tests write MBs; keep their temp dirs under build/, not a small /tmp.
    val testTmp = layout.buildDirectory.dir("test-tmp").get().asFile
    doFirst { testTmp.mkdirs() }
    systemProperty("java.io.tmpdir", testTmp.absolutePath)
    testLogging {
        events("skipped", "failed")
        showStandardStreams = providers.environmentVariable("LRE_LIVE").orNull == "1"
    }
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            from(components["java"])
            artifactId = "lre-oci"
        }
    }
}
