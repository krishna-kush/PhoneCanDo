plugins {
    id("com.android.library")
    kotlin("android")
    `maven-publish`
}

android {
    namespace = "com.phonecando.pce.android"
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
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")

    androidTestImplementation(project(":core"))
    androidTestImplementation(project(":testkit"))
}

afterEvaluate {
    publishing {
        publications {
            create<MavenPublication>("release") {
                from(components["release"])
                artifactId = "pce-android"
            }
        }
    }
}
