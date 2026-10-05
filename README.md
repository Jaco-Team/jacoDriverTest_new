# Курьерское приложение Jaco

Мобильное приложение для курьеров на React Native 0.87.1 (Android и iOS). Рабочая документация и текущее состояние проекта — в [docs/README.md](./docs/README.md).

## Локальный запуск

Нужен Node.js `>=24 <25`, Android SDK или Xcode с настроенным окружением React Native. Установите зависимости из корня проекта:

```bash
npm ci
```

Скопируйте `.env.example` в `.env` и заполните `YAMAP_API_KEY` — ключ Yandex
MapKit для iOS и Android. Локальный `.env` исключён из Git. В CI можно передать
`YAMAP_API_KEY` переменной окружения; она имеет приоритет над `.env`.
Без ключа сборка остановится с сообщением об отсутствующей настройке.

После изменения ключа перезапустите Metro с `npm start -- --reset-cache` и
пересоберите приложение. Для iOS build phase создаёт конфигурацию MapKit в
пакете приложения; для JavaScript ключ подставляет Babel. Ключ в `.env` не
попадает в исходники Git, но входит в готовую мобильную сборку.

Для iOS нужен Ruby `>=3.2 <4.0` (проверено с Ruby 3.4.7); системный Ruby
macOS 2.6 не подходит. После установки JS-зависимостей выполните:

```bash
npm run ios:pods
```

Скрипт устанавливает gems в `vendor/bundle` и запускает `pod install` в `ios`.
Он использует Ruby из `PATH` или уже установленный Homebrew Ruby.
После обновления нативных библиотек повторите эту команду. Если CocoaPods
не находит новую версию SDK в своём индексе: `npm run ios:pods -- --repo-update`.

Запустите Metro в отдельном терминале:

```bash
npm start
```

Затем запустите нужную платформу:

```bash
npm run android
# или
npm run ios
```

Для конкретного iOS-симулятора: `npm run ios -- --simulator "iPhone 18 Pro"`.

Для Android нужен JDK `>=17`, SDK Platform 37, Build Tools 37.0.0 и NDK
29.0.14206865. `npm run android` сохраняет подходящий `JAVA_HOME`, иначе
выбирает уже установленный JDK Android Studio или Homebrew. Это позволяет
запускать проект на Mac, где системная команда `java` всё ещё ведёт на Java 8.
В Android Studio откройте папку `android` и выберите встроенный JDK в
Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK.
Путь SDK задаётся в локальном `android/local.properties` (`sdk.dir=...`).

Собрать Debug APK без запуска эмулятора:

```bash
npm run android:build
```

APK находится в `android/app/build/outputs/apk/debug/app-debug.apk`.
Для уже запущенного эмулятора: `npm run android -- --device emulator-5554 --no-packager`.
Metro должен работать в отдельном терминале; Debug получает JavaScript через
него. Проверку холодного старта без Metro выполняйте в Release.

Если на телефоне уже установлена версия с другой подписью, соберите отдельное
приложение без удаления её данных:

```bash
SENTRY_DISABLE_AUTO_UPLOAD=true SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD=true npm run android:build:local
```

APK: `android/app/build/outputs/apk/localRelease/app-localRelease.apk`.
Пакет `com.jacodrivertest.localtest`, название «Курьер Жако (тест)».
Это Release с локальной debug-подписью и отдельными данными; для него нужен
повторный вход. Для публикации используется основной пакет и релизный ключ.
При наличии двух установок SSO-ссылка может предложить выбрать приложение.

В `release` и `localRelease` включены R8 и сокращение ресурсов. Проверять
нативные модули перед публикацией нужно именно в этих сборках. AAB для
локальной проверки можно собрать без отправки артефактов в Sentry:

```bash
SENTRY_DISABLE_AUTO_UPLOAD=true SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD=true bash scripts/android.sh --build-local-release :app:bundleRelease
```

AAB: `android/app/build/outputs/bundle/release/app-release.aab`.
Метаданные оптимизации: `BUNDLE-METADATA/com.android.tools/r8.json` внутри AAB.
Сохраняйте `android/app/build/outputs/mapping/release/mapping.txt` вместе
с соответствующим выпуском для расшифровки нативных crash-логов.
Локальный AAB подписан debug-ключом; публикация требует релизной подписи.

В Xcode открывайте [ios/jacoDriverTest.xcworkspace](./ios/jacoDriverTest.xcworkspace),
чтобы сборка подключала CocoaPods. Если Xcode сообщает, что Node не найден,
обновите игнорируемый `ios/.xcode.env.local`, указав актуальный абсолютный путь
из `command -v node` в `export NODE_BINARY=...`.

Минимальная версия приложения и Pods — iOS 15.1. `post_install` в Podfile
поднимает старые значения зависимостей до этой версии. Если после установки
Pods открытый Xcode всё ещё сообщает `IPHONEOS_DEPLOYMENT_TARGET` 9–14,
закройте окно workspace и заново откройте `ios/jacoDriverTest.xcworkspace`:
Xcode может продолжать использовать старые настройки проекта из памяти.

На 05.10.2026 проверены чистая установка, Debug-сборка и экран входа на
Xcode 27 / iOS 27 / iPhone 18 Pro Simulator. Для Xcode 27 окно симулятора
открывается через Device Hub. Приложение использует Scene Lifecycle,
который требуется iOS 27 SDK. Результаты проверки и оставшиеся задачи — в
[плане миграции](./docs/new-architecture-migration-plan.md).

По умолчанию приложение обращается к удалённому Laravel API. Скрипт `npm run start:local-api` переключает Metro на локальный API `http://localhost:8080`; для Android-эмулятора дополнительно требуется доступ к этому адресу, например через `adb reverse tcp:8080 tcp:8080`. После смены источника данных перезапустите Metro и приложение. Не проверяйте действия с реальными заказами на рабочем аккаунте.

## Проверки

```bash
npm run lint
npm run typecheck
npm run test:unit
```

`typecheck` — одно слово; команды `npm run type check` нет. Эти проверки не заменяют нативную сборку и ручную проверку Android/iOS. Статус и релизные сценарии — в [документации по тестированию](./docs/testing/README.md).

Не редактируйте `node_modules` вручную: изменения исчезнут после установки зависимостей. Нативный патч MapKit применяется через `patch-package` при `npm ci`; если потребуется другой патч зависимости, добавьте его в репозиторий и проверьте повторную установку.

Офлайн-карты: сценарий скачивания городов и проверка на устройстве описаны в [docs/offline-maps.md](docs/offline-maps.md).
