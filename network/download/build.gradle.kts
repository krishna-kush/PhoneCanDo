plugins {
    `java-library`
    `java-test-fixtures`
    kotlin("jvm")
    `maven-publish`
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    api(project(":http"))
    testFixturesApi(testFixtures(project(":http")))
    testImplementation(testFixtures(project(":http")))
    testImplementation(kotlin("test-junit5"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.test {
    useJUnitPlatform()
    // Test files live under build/, not the system temp dir.
    systemProperty("java.io.tmpdir", temporaryDir.absolutePath)
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            from(components["java"])
            artifactId = "network-download"
        }
    }
}
