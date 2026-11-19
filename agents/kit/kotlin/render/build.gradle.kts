plugins {
    `java-library`
    kotlin("jvm")
    `maven-publish`
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    api(project(":kit-api"))
    api(project(":kit-manifest"))
    testImplementation(kotlin("test-junit5"))
    testImplementation("org.junit.jupiter:junit-jupiter:6.1.3")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.test {
    useJUnitPlatform()
    // The schema's fixtures: a user kind the TS validator takes must load here too.
    val fixtures = file("../../schema/fixtures")
    inputs.dir(fixtures)
    systemProperty("phonecando.fixtures", fixtures.absolutePath)
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            from(components["java"])
            artifactId = "agents-kit-render"
        }
    }
}
