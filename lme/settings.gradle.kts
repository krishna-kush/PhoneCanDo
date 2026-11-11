pluginManagement {
    repositories {
        gradlePluginPortal()
        google()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "phonecando-lme"

// Our shared network code (network/): HTTP, resumable verified downloads,
// retries. Built from source, like the app builds us.
includeBuild("../network") {
    dependencySubstitution {
        substitute(module("com.phonecando.network:network-http")).using(project(":http"))
        substitute(module("com.phonecando.network:network-download")).using(project(":download"))
        substitute(module("com.phonecando.network:network-retry")).using(project(":retry"))
    }
}

include(":api", ":gguf", ":catalog", ":store", ":host", ":cli")
