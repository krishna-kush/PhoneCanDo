plugins {
    `java-library`
    kotlin("jvm")
    `maven-publish`
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    // The model keeps the blocks we hand to the app verbatim (the web
    // adapter, signIn) as JSON trees, so the JSON library is part of its API.
    // Same version as lre/oci; the app already ships it.
    api("org.jetbrains.kotlinx:kotlinx-serialization-json:1.12.0")
    testImplementation(kotlin("test-junit5"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.test {
    useJUnitPlatform()
    // The schema's fixtures, and lre-api's PackageFamily source: the kit's
    // family names are its ids (PackageFamiliesTest).
    val fixtures = file("../../schema/fixtures")
    val osInfo = file("../../../../lre/api/src/main/kotlin/com/phonecando/lre/api/OsInfo.kt")
    inputs.dir(fixtures)
    inputs.file(osInfo)
    systemProperty("phonecando.fixtures", fixtures.absolutePath)
    systemProperty("phonecando.lreOsInfo", osInfo.absolutePath)
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            from(components["java"])
            artifactId = "agents-kit-manifest"
        }
    }
}
