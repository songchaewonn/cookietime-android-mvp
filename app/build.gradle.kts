plugins { id("com.android.application") }

val webRoot = rootProject.projectDir.resolve("web")
val generatedWeb = layout.buildDirectory.dir("generated/webAssets")
val syncWebAssets = tasks.register<Sync>("syncWebAssets") {
    from(webRoot) {
        include("index.html", "app.js", "auth.js", "auth-config.js", "styles.css", "public/assets/**")
    }
    into(generatedWeb.map { it.dir("www") })
}

android {
    namespace = "com.cookietime.mvp"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.cookietime.mvp"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    sourceSets.getByName("main").assets.srcDir(generatedWeb)
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

tasks.named("preBuild").configure { dependsOn(syncWebAssets) }
