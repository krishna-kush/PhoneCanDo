plugins {
    id("com.android.library")
    kotlin("android")
    `maven-publish`
}

android {
    namespace = "com.phonecando.pce.shizuku"
    compileSdk = 36

    defaultConfig {
        minSdk = 24
    }

    testOptions {
        targetSdk = 36
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    publishing {
        singleVariant("release") {}
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    api(project(":api"))
    api("dev.rikka.shizuku:api:13.1.5")
    implementation("dev.rikka.shizuku:aidl:13.1.5")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")

    testImplementation(kotlin("test-junit"))
    testImplementation("junit:junit:4.13.2")
    testImplementation(project(":testkit"))

    androidTestImplementation(project(":testkit"))
    androidTestImplementation("dev.rikka.shizuku:provider:13.1.5")
}

afterEvaluate {
    publishing {
        publications {
            create<MavenPublication>("release") {
                from(components["release"])
                artifactId = "pce-shizuku"
            }
        }
    }
}
