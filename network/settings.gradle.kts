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

rootProject.name = "phonecando-network"

include(":http", ":download", ":retry")
// Our one way to the network, shared by every engine that downloads (lme's
// models, lre's Linux images): pure JVM modules. Dependency law (no other
// edges, no cycles):
//   http <- download, http <- retry
// No engine types here: an engine maps NetException to its own errors at
// its edge. No android.*, no org.json anywhere here.
