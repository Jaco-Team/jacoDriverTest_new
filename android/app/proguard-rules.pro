# React Native, Hermes, MapKit and other dependencies supply consumer rules.
# Add only rules for app-specific reflection/JNI here; blanket package keeps
# prevent R8 from optimizing code and reduce Google Play DEX coverage.
# Keep mapping.txt from the exact release for crash deobfuscation.

# Native CodePush entry points are consumed by the following installer stage.
-keep class com.jacodrivertest.codepush.** { *; }
