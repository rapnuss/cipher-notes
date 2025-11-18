## ciphernotes TWA module

This directory contains the Trusted Web Activity (TWA) Android wrapper for ciphernotes.

### Requirements

- JDK 17
- Android SDK
- Gradle wrapper in this directory (`./gradlew`)

### Build for F-Droid (unsigned)

F-Droid expects an unsigned `release` build.

```bash
cd twa
./gradlew :app:assembleRelease
```

The unsigned APK will be in `app/build/outputs/apk/release/`.

### Build for Google Play (signed upload)

The `play` build type is signed with your upload keystore using `keystore.properties`, which is not committed to git.

1. Place your upload keystore in `twa/app/upload-keystore.jks` (or adjust the path below).
2. Create `twa/app/keystore.properties`:

```properties
storeFile=upload-keystore.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=YOUR_KEY_ALIAS
keyPassword=YOUR_KEY_PASSWORD
```

3. Build the signed artifacts:

```bash
cd twa
./gradlew :app:assemblePlayRelease    # APK
./gradlew :app:bundlePlayRelease      # AAB
```

The Play upload artifacts will be in `app/build/outputs/apk/play/release/` and `app/build/outputs/bundle/playRelease/`.


