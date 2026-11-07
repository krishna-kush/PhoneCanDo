plugins {
    `java-library`
    kotlin("jvm")
    `maven-publish`
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    api(project(":api"))
    // xz streams (the baked Default image). Public domain / 0BSD.
    implementation("org.tukaani:xz:1.10")
    testImplementation(kotlin("test-junit5"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.test {
    useJUnitPlatform()
    // Test archives unpack under build/, not the system temp dir.
    systemProperty("java.io.tmpdir", temporaryDir.absolutePath)
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            from(components["java"])
            artifactId = "lre-tar"
        }
    }
}
