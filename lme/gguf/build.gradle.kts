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
    api(project(":api"))
    testImplementation(kotlin("test-junit5"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.test {
    useJUnitPlatform()
    // LME_GGUF_DIR=<dir with real .gguf files> turns on the real-file test;
    // as an input, setting it reruns the tests.
    inputs.property("lmeGgufDir", providers.environmentVariable("LME_GGUF_DIR").orElse(""))
    testLogging {
        events("skipped", "failed")
    }
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            from(components["java"])
            artifactId = "lme-gguf"
        }
    }
}
