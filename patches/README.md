# Патчи зависимостей

Патчи автоматически применяются существующим `postinstall: patch-package`.
Версии npm-пакетов при миграции Kotlin 22.10.2026 не менялись. При обновлении
библиотеки её патч нужно сверять с чистым пакетом новой версии: удалять только
те изменения, которые уже поддержаны upstream.

## Android: встроенный Kotlin и публичный DSL AGP 9

| Пакеты | Причина патча |
| --- | --- |
| AsyncStorage 3.1.1, Firebase app/messaging 27.1.0, WebView 14.0.1, Keychain 10.0.0 | Не применять внешний Kotlin-плагин, если Kotlin уже предоставлен AGP. |
| DateTimePicker 9.2.2 | Перенести JVM 17 из `android.kotlinOptions` в `kotlin.compilerOptions`. |
| Firebase app 27.1.0, Permissions 5.6.3, EdgeToEdge 1.8.2 | Явно включить дополнительные Kotlin-каталоги; новые правила AGP не берут Kotlin из произвольных `java.srcDirs`. |
| Yamap Plus 6.12.0 | Условный Kotlin-плагин, новый compiler DSL с JVM 17, Kotlin-каталоги full/lite. Прежние 17 файлов патча карты сохранены. |
| Sentry 8.32.0, DeviceInfo 15.0.2, ImagePicker 8.3.0, InAppBrowser 3.7.1, SafeAreaContext 5.10.1, Screens 4.30.0 | Удалить app-only `versionCode/versionName` из `LibraryDefaultConfig`. Версия самого приложения не меняется. |

В затронутых AsyncStorage, Firebase, Permissions и EdgeToEdge также заменён
алиас `lintOptions` на `lint` с теми же опциями. В остальных библиотеках
поддерживаемые алиасы не переписывались. Реализация SDK, API заказов, хранилище
и бизнес-логика этими Gradle-патчами не меняются.

Шрифты vector-icons не патчатся: локальная
[задача assets](../android/gradle/vector-icon-fonts.gradle) копирует прежний
MaterialIcons через публичный variant API с явной зависимостью задач.
Kotlin `2.4.21` и `AsyncStorage_kspVersion=2.3.12` нужны и после удаления
внешнего Kotlin-плагина; их нельзя удалять вместе с ним.

## Сохранённый патч iOS

`@appmetrica/react-native-analytics+4.2.0.patch` объявляет RN bridge статическим
framework для динамической конфигурации Pods с Firebase 27. AppMetrica SDK
остаётся динамическим. Этот патч не относится к миграции Kotlin.

Результаты проверки патчей на чистых npm-пакетах, сборок и упаковки —
в [журнале тестирования](../docs/testing/testing-progress.md).
