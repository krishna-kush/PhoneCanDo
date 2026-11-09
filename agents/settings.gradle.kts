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

rootProject.name = "agents"

include(":kit-api")
project(":kit-api").projectDir = file("kit/kotlin/api")

include(":kit-manifest")
project(":kit-manifest").projectDir = file("kit/kotlin/manifest")

include(":kit-render")
project(":kit-render").projectDir = file("kit/kotlin/render")

include(":kit-term")
project(":kit-term").projectDir = file("kit/kotlin/term")

// A leaf for CI only: renders install scripts with the kit (nothing depends on it).
include(":kit-cli")
project(":kit-cli").projectDir = file("kit/kotlin/cli")

include(":builtin")
project(":builtin").projectDir = file("builtin/kotlin")

// Every agent kind with Kotlin code: {native,image}/<id>/kotlin/build.gradle.kts
// becomes the project :<id>. Adding a kind needs no edit here; builtin reads
// the list (gradle.extra["agentKinds"]) and depends on each one.
val kinds = listOf("native", "image").flatMap { type ->
    file(type).listFiles().orEmpty()
        .filter { it.resolve("kotlin/build.gradle.kts").isFile }
        .map { it.name to it.resolve("kotlin") }
}.sortedBy { it.first }

kinds.forEach { (id, dir) ->
    include(":$id")
    project(":$id").projectDir = dir
}

gradle.extra["agentKinds"] = kinds.map { it.first }
