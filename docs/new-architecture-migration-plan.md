# План миграции на React Native / Fabric

## Уточнение iOS и исправление ядра — 16.10.2026

Первоначальное обновление оставило закешированный `React-Core-prebuilt` 0.87.1
при JS / React-Core 0.88.0. CocoaPods не перечитал внешний podspec, чей текст
не изменился (версия в нём берётся косвенно из package.json). Сборка проходила,
но запуск выявил mismatch; прежние сообщения об успешной сборке не означали
проверку согласованности нативного ядра.

По запросу пользователя выполнен только целевой `pod update React-Core-prebuilt
--no-repo-update`: ядро, его build script, архив и заголовок теперь 0.88.0.
Добавлена проверка перед `npm run ios` и восстановление устаревших RN Pods
в `ios:pods` (одна попытка, без полного update или удаления кешей/данных).
`--deployment` не допускает автообновления lock. CI проверяет committed lock
без зависимости от локальных Pods. Результаты полного unit-прогона, lint /
typecheck и отдельных нативных проверок фиксируются в
[журнале тестирования](testing/testing-progress.md).

iOS Debug для используемого iPhone 17 Pro / iOS 26.2 (arm64) пересобран
в стандартный DerivedData. `BUILD SUCCEEDED`; UUID встроенного React совпадает
с новым pod и отличается от 0.87.1. Установка и запуск оставлены пользователю,
аккаунты/данные и поведение приложения не менялись. Пользовательское подтверждение
онлайн/офлайн, карт и тем учитывается в [журнале](testing/testing-progress.md)
отдельно от подтверждения платформ, типа сборки и release-smoke. Актуальные
незакрытые проверки — в [релизном чек-листе](testing/release-checklist.md).

## Обновление зависимостей — 16.10.2026

Пользователь согласовал обновление в текущем `main` с сохранением всех
незакоммиченных изменений. Старая `new_architecture` отстаёт на 15 коммитов;
переключение ветки и коммиты не выполнялись. Исторические версии и результаты
ниже относятся к прежним волнам, а не к текущей проверке.

Установлены RN `0.88.0` и связанная группа `@react-native/*` `0.88.0`.
React / React DOM / react-test-renderer синхронно обновлены до `19.3.1`.
Navigation обновлён до Drawer `7.14.4`, Native `7.5.1`, Native Stack `7.21.0`,
Sentry — до `8.31.0`, Screens — до `4.30.0`, SVG — до `15.16.0`, Image Picker —
до `8.3.0`, Lucide — до `1.58.0`, React Hook Form — до `7.90.0`.
Обновлены Testing Library `14.1.0`, TypeScript ESLint `8.71.2`, Prettier
`3.9.10`, Babel runtime `7.29.10`, baseline-browser-mapping `2.11.29`,
test-renderer `1.3.1` и override gRPC `^1.14.6`. ESLint остаётся на `10.12.0`.

`react-native-yamap-plus` обновлён до `6.12.0`; патч переименован и перенесён
на чистые исходники этой версии. Сохранены изменения всех 17 файлов: офлайн-API,
рециклинг/загрузка/точные границы меток, пробки, тема и корректный статус маршрута.
Также сохранены новые upstream-настройки `focusInsets`; MapKit остаётся
`4.42.0-full`, формат скачанных пакетов намеренно не менялся. Проверены применение
нового патча без fuzz и совпадение всех 17 установленных файлов с результатом
переноса. Старый патч `6.11.0` заменён; его версия доступна в Git.

Reanimated `4.7.1` / Worklets `0.13.0` поддерживают RN 0.88 и не менялись.
TypeScript 7, Babel 8, Tailwind 4 / NativeWind 5, Expo HTML Elements новой
ветки и миграция Firebase на SwiftPM остаются вне этой волны. Firebase app /
messaging `26.4.0` и CocoaPods-подключение сохранены. Прежнее ограничение
«RN 0.88 ещё не выпущен» снято; список отложенных миграций ниже актуализирован.

Исходный baseline до установки: lint и typecheck прошли; 123 набора / 688
unit-тестов, из них 674 прошли и 14 упали в четырёх уже изменённых UI-наборах
(`settings-screen`, `ui.orders-map-screen`, `ui.orders-map-sheet`,
`ui.orders-filter-sheet`). После обновления: 123 набора / 689 тестов,
675 прошли, те же 14 упали, новых падений нет. Добавлен контракт согласованности
пакетов RN и версий React/рендерера; проверки патча привязаны к `6.12.0`.
На этапе обновления полный unit-набор ещё оставался красным. Затем по
отдельному запросу пользователя 16.10.2026 исправлены RN-моки, мок иконки
обновления и ожидание асинхронных действий в тестах карты/карточки. Все 689
прежних сценариев сохранены, добавлено 5 проверок заглушек кнопок:
124 набора / 694 теста проходят, без skipped/todo. Lint и typecheck проходят.
Бизнес-логика и production-код ради зелёного набора не менялись. Подробности —
в [статусе тестирования](testing/testing-progress.md); числовые результаты выше
относятся к соответствующим этапам 16 октября, а не к последнему прогону.

Lint и typecheck после установки прошли. Нативные регрессии исполняют настоящие
тела методов установленной карты: iOS lifecycle 125/125, iOS image race 31/31,
Android images 31/31 assertions — успешно, без запуска устройств и эмуляторов.

Для iOS скрипт `ios:pods` дополнительно выбирает установленный Homebrew
Ruby 3.4 / 3.x, если текущий Ruby не входит в `>=3.2 <4.0`; глобальная
версия Ruby не переключается и новые системные среды не устанавливаются.
Android Debug и `localRelease` собраны успешно для `arm64-v8a` и `x86_64`.
Оба APK прошли `zipalign -c -P 16 4`; в `localRelease` есть встроенный
JS/Hermes bundle. Это локальная debug-подпись, не артефакт для публикации.
Сохраняются прежние предупреждения AGP/R8 для Google Sign-In;
Gradle также сообщил о перезапуске daemon из-за лимита metaspace, но сборка
завершилась успешно.

iOS Debug собран Xcode 27 для generic iOS Simulator (`arm64` / `x86_64`),
без подписи и запуска симулятора. Первый проход завершился с кодом 0, но
вывел противоречивую Swift-диагностику «failed with exit code 0» для Sentry
и AppDelegate. Повторный проход с полным `.xcresult` подтвердил
`BUILD SUCCEEDED`, `status: succeeded`, `errorCount: 0`; исходники Sentry
и startup приложения для обхода этой диагностики не менялись.
Предупреждение об устаревшем `RCTAppDelegate` остаётся: его замена на
`RCTReactNativeFactory` — отдельный рефакторинг startup, не требование
успешной сборки RN 0.88. iOS Release / физический iPhone и ручной smoke
этой волны ещё не проверены; Android APK также не устанавливались.

`npm audit` после установки: 51 предупреждение (32 high / 19 moderate),
как и до обновления. Это число затронутых пакетов, а не обязательно независимых
уязвимостей; часть цепочек относится к RN/Metro/Jest/Gluestack и средствам сборки.
`audit fix --force` не применялся; разбор оставшихся цепочек — отдельная задача.

## Локальная подготовка Android — 05.10.2026

После обновления библиотек собраны Debug и Release для `arm64-v8a` и
`x86_64`: Gradle 9.4.1, AGP 9.2.1, JDK Android Studio 25.0.3,
SDK/Build Tools 37, NDK 29.0.14206865. Kotlin поднят до 2.2.10 — именно эту
версию уже выбирает AGP; AsyncStorage теперь подключает соответствующий
KSP 2.2.10-2.0.2 без предупреждения о несовместимости.

`npm run android` выбирает установленный JDK вместо системной Java 8;
`npm run android:build` создаёт Debug APK. Локальные Kotlin sessions
исключены из Git. Подготовлен отдельный эмулятор `Jaco_Android_16_16KB`
(Android 16 / API 36.1, arm64, страницы 16 КБ, хранилище 10 ГБ).
Старый эмулятор не очищался: установка на нём завершилась
`INSTALL_FAILED_INSUFFICIENT_STORAGE`.

Первый Debug-запуск выявил `AssertionError: You need to set the API key
before using MapKit`. Старый Metro-bundle сохранял необработанное
`process.env.YAMAP_API_KEY`; после перезапуска Metro с `--reset-cache`
подстановка ключа из `.env` подтверждена без вывода самого ключа.
В существующий патч MapKit добавлены отказ инициализации при пустом ключе
и обработка `Throwable`, включая SDK AssertionError. Патч повторно применён
к чистым исходникам в отдельном временном каталоге: все 13 файлов совпали.

Исправленный Debug установлен и открыл экран авторизации на новом эмуляторе;
после повторного запуска новых вылетов приложения в журнале не обнаружено.
Release APK содержит встроенный JS/Hermes bundle с настроенным ключом.
`zipalign -c -P 16 4` прошёл для обоих APK. Для локальной Release-сборки
отключена автоматическая загрузка sourcemaps и символов в Sentry переменными
`SENTRY_DISABLE_AUTO_UPLOAD=true` и `SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD=true`.
APK подписан существующим debug-ключом и предназначен для локальной проверки.

Проверены lint и 9 наборов / 82 уникальных теста startup, конфигурации,
меток, сессий карточки и офлайн-загрузок. После входа пользователя на
эмуляторе проверены онлайн-карта и скачивание Самары (129,9 МБ): статус
«Доступна офлайн» сохранился после установки Release поверх Debug.
Тольятти (87,8 МБ) был предварительно сохранён автоматической загрузкой.

Release холодно запущен в авиарежиме без `adb reverse` и подключения к
Metro: восстановились сессия, список заказов, карта Тольятти и метки.
Проверены точные касания подписи кружка и пина, игнорирование касания
ниже рамки, серия 20 открытий/закрытий через фон и последующее открытие
другого заказа. Новых crash/ANR в журнале не найдено. После выключения
авиарежима плашка скрылась и заказы обновились; сеть эмулятора восстановлена.

Для входа отключён режим рукописного ввода Gboard «Write in text fields»:
экранная цифровая клавиатура проверена, пользователь авторизовался сам.
Разрешение геолокации «While using the app» выбрано пользователем.
Пауза/возобновление проверены на Xiaomi ниже; удаление пакетов, все темы и
размеры меток, реальные GPS и push остаются в чеклисте.

Подключён Xiaomi 23021RAA2Y, Android 15 / API 35, arm64, страницы 4 КБ.
Обновление установленного приложения через USB отклонено из-за несовпадения
подписей (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`); старая версия и её данные
сохранены. Добавлен `localRelease` с пакетом `com.jacodrivertest.localtest`
и названием «Курьер Жако (тест)». `npm run android:build:local` собирает
отдельный APK со встроенным bundle и debug-подписью. Сборка, проверка
`zipalign`, установка и холодный запуск экрана входа на Xiaomi прошли.
Пользователь вошёл в тестовое приложение. На телефоне проверены онлайн-пин,
скачивание Самары (129,9 МБ), ручная пауза на 29% с переходом между экранами
и продолжение. Потеря сети остановила загрузку на 71%. Холодный запуск
в авиарежиме без Metro восстановил сессию, заказы и карту Тольятти (87,8 МБ).
Касание текста метки-кружка открыло карточку; касание ниже рамки её не открыло.
Серия 20 быстрых пар касаний «закрыть через фон / открыть» не привела к вылету
или блокировке карточки; PID сохранился, crash/ANR приложения не найдено.

Выявлена потеря автопродолжения загрузки после холодного запуска: начальная
пустая сессия считалась выходом из аккаунта. Теперь намерение продолжить
сбрасывается только при переходе из авторизованного состояния в выход.
Регрессионный тест сначала воспроизвёл сбой, затем прошёл с исправлением;
также проверены ручная пауза и выход. Lint, typecheck и 3 набора / 27 тестов
офлайн-карт прошли. После ручного продолжения Самара полностью скачана.
Данные основной установки в тестовую не переносятся. SSO, доставка push,
реальная точность GPS и все варианты оформления на этом телефоне не проверены.
Исправленный APK повторно собран, прошёл `zipalign` и установлен на Xiaomi.
Холодный онлайн-запуск восстановил сессию и заказы; пакеты Самары и Тольятти
сохранились со статусом «Доступна офлайн». Нажатия на значок и текст метки
открыли один и тот же правильный заказ. Автопродолжение незавершённой загрузки
после исправления подтверждено автоматическим тестом; повторная проверка
именно этого сценария на телефоне ещё требуется, поскольку оба пакета
уже полностью скачаны.

## Локальная подготовка iOS — 05.10.2026

`origin/new_architecture` влита fast-forward в локальный `main` на `5d47036`.
Следующие версии заменяют пины в историческом описании ниже:

- RN `0.87.1`, React `19.3.0`, Fabric сохраняются.
- Reanimated `4.7.1` + Worklets `0.13.0`: Worklets 0.13 теперь имеет npm-тег
  `latest`; совместимость с RN 0.87 подтверждена
  [таблицей Software Mansion](https://docs.swmansion.com/react-native-reanimated/docs/guides/compatibility/).
- Sentry `8.29.0`, Safe Area `5.10.1`, Prettier `3.9.9`.
- Обновлены зависимости в разрешённых диапазонах: Navigation Native `7.5.0`,
  Native Stack `7.20.0`, Drawer `7.14.3`, Lucide `1.52.0`, React Hook Form
  `7.89.0`, ESLint `10.12.0`, TypeScript ESLint `8.71.0`.
- Ruby `>=3.2 <4.0`, Bundler `2.7.2`, CocoaPods `1.17.0`, Xcodeproj `1.28.1`.
  Команда `npm run ios:pods` устанавливает gems и Pods; системный Ruby 2.6
  заменяется уже установленным Homebrew Ruby, если он доступен.
- Overrides обновляют `@grpc/grpc-js` до `^1.14.5` и `tmp` до `^0.2.7`.
  Аудит снизился с 38 до 32 high: оставшиеся предупреждения идут от `braces`,
  для которого [исправленный релиз отсутствует](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
  `npm audit fix --force` предлагает несовместимые смены версий и не применялся.

Babel 8, TypeScript 7, Tailwind 4 и Expo HTML Elements 57 требуют отдельных
миграций; текущий Babel 7 / TypeScript 6 / Tailwind 3 стек сохранён.
Коммиты и push этого локального обновления выполняет пользователь.

Для будущих обновлений Firebase нужна отдельная миграция способа подключения:
[Firebase прекращает новые публикации в CocoaPods в октябре 2026](https://firebase.google.com/docs/ios/cocoapods-deprecation).
Текущие Firebase Pods `12.18.0` остаются доступными. В этой подготовке сохранён
существующий CocoaPods-путь с `$RNFirebaseDisableSPM = true`.

Проверки на этой машине: Node `24.19.0`, Ruby `3.4.7`, Xcode `27.0`, iPhone 18
Pro Simulator / iOS `27.0`. Прошли `npm ci` с патчем MapKit,
`npm run ios:pods -- --deployment`, lint, typecheck, 103 набора / 424 теста,
Metro iOS bundle и нативная Debug-сборка. `Podfile.lock` совпадает с установленными
Pods. Приложение установлено, подключилось к Metro и открыло экран авторизации;
системный запрос уведомлений оставлен пользователю.

Первый запуск выявил UIKit `EXC_BREAKPOINT`: отсутствовал Scene Lifecycle,
[обязательный при сборке с iOS 27 SDK](https://developer.apple.com/documentation/technotes/tn3187-migrating-to-the-uikit-scene-based-life-cycle).
В [AppDelegate.swift](../ios/jacoDriverTest/AppDelegate.swift) отключена автоматическая
загрузка окна `RCTAppDelegate`; `SceneDelegate` создаёт `UIWindow(windowScene:)`
и запускает существующую React Native factory. В
[Info.plist](../ios/jacoDriverTest/Info.plist) зарегистрирована одна сцена.
Холодные URL передаются в launch options, активные URL и universal links —
в `RCTLinkingManager`. Инициализация Firebase и MapKit остаётся в AppDelegate.
После изменения Debug-сборка и запуск на iOS 27 прошли.

Этот прогон не включает Android, Release, реальный iPhone, вход в аккаунт,
SSO/CAPTCHA с сервером, доставку push и проверку заказов/офлайн-карты после входа.

## История исходной миграции — август–октябрь 2026

Разделы 1–7 ниже сохраняют исходный план, его прежние версии и результаты.
Их пины, ветки и статус smoke не описывают текущую волну RN `0.88.0`.
Актуальный стек сверять по разделу «Обновление зависимостей — 16.10.2026» и
[package.json](../package.json), результаты — по
[журналу тестирования](testing/testing-progress.md).

Дата исходного плана: 24 августа 2026 года. Последнее обновление исходного
плана: 1 октября 2026 года. Версия той волны — RN `0.87.1`, не клиентский
`0.86`. Tailwind 4, NativeWind 5 и остальные major-переходы в ту волну не входили.

Ветка: `new_architecture`. Ветка `main` не меняется этим планом.

## 1. Зачем

На `main` проект был на RN `0.77.2` / React `18.3` / Paper, New Architecture выключена. Это тупик.

На `new_architecture` фундамент уже поднят до RN `0.86` + Fabric. Дальше не копируем клиентский пин `0.86` (он был актуален, когда делали сайт). Текущая версия волны: **RN `0.87.1`** — patch-релиз после первоначального перехода на `0.87.0`.

Цель: тот же курьерский продукт на текущем фундаменте. Не новое приложение.

Не цель первой волны:

- переписать store, навигацию, карту, заказы, шиты, стили;
- менять геолокацию «заодно»;
- оптимизировать списки как каталог клиентского приложения.

## 2. Роль клиентского проекта

Клиентское приложение смотрели только чтобы понять, что на практике значит New Architecture:

- RN latest + Fabric сразу, не Paper-first (у клиента на момент той миграции это был `0.86`);
- Reanimated 4 через `react-native-worklets`, не через `worklets-core`;
- Gesture Handler 3, Node 24, Hermes.

Клиентское **не эталон**. Там свои зоны (каталог, MiniCodePush, Skia, WebView, Detox), и зависимости там ещё не все закрыты. Пины, UI-архитектуру и незакрытый хвост оттуда не копировать.

Курьерское проще по экранам, но свои дорогие зоны: карта заказов, GPS, действия с заказом, Sentry, drawer.

## 3. Исторический статус этапов на 01.10.2026

| Этап | Статус |
| --- | --- |
| 0. Ветка и docs | сделан |
| 1. Аудит и bump + флаги Fabric | сделан: RN `0.87.1` + Fabric, yamap-plus |
| 2. Native compile | Android debug/release и iOS simulator debug/release ранее собирались на `0.87.1`; после последних изменений нужна новая проверка обеих платформ |
| 3. Jest / TS хвост | На 01.10.2026 `lint`, `typecheck` и 103 набора / 424 unit-теста прошли на `0.87.1` + ESLint 10; нативную сборку в этот прогон не включали |
| 4. Android smoke | debug проверен на эмуляторе; release APK установлен и проверен на реальном Samsung, включая повторное определение геопозиции |
| 5. iOS smoke | debug/release и основные сценарии, включая CAPTCHA/SSO, проверены на Simulator; реальный iPhone остаётся руководителю |
| 6. Release smoke | Android на реальном Samsung и iOS Simulator пройдены; реальный iPhone не проверен, production-выкладка не входит в задачу |

После этапа 0 запуск из `new_architecture` был равен `main` (RN `0.77`, Paper). Fabric появился на этапе 1 (сначала `0.86`, сейчас `0.87`).

## 4. Целевой стек исходной миграции

Конкретные patch-версии сверять по этому репозиторию, не по клиентскому `package.json`.

- Node `>=24 <25` (минимум RN 0.87 — `>= 22.13`; CI на Node 24)
- React Native `0.87.1`
- React / React DOM `19.3.0`
- New Architecture / Fabric / Hermes включены
- Reanimated `4.6.0` + `react-native-worklets` `0.12.2` + Gesture Handler `3.3.0`
- Screens `4.28.0` / Safe Area `5.10.0`
- Navigation: `@react-navigation/drawer` `^7.14.2`, `native` `^7.4.1`, `native-stack` `^7.19.2` (линейка 7; восьмёрка — alpha, не берём)
- Sentry `@sentry/react-native` `8.27.0` (патч `7.13.0` снят)
- Firebase `@react-native-firebase/app` + `messaging` `26.4.0` (одна версия на оба)
- ESLint `10.x`; Babel `^7.29.7` (не 8; пресет RN 0.87 на семёрке); TypeScript `6.0.3`
- Android: compileSdk/buildTools 37, targetSdk 36, NDK `29.0.14206865`, AGP 9 с `android.builtInKotlin=false` и `android.newDsl=false`
- iOS: `RCT_NEW_ARCH_ENABLED=1` и `RCTNewArchEnabled` в Info.plist; RN SwiftPM не включать; Firebase native — CocoaPods (`$RNFirebaseDisableSPM = true` + static `use_frameworks!`)

Версии после волны 21 сентября; это историческая таблица, не текущие пины
`package.json`. В момент её фиксации нативная группа ожидала ручной smoke:

| Пакет | package.json |
| --- | --- |
| `react-native` | `0.87.1` |
| `react-native-reanimated` / `react-native-worklets` | `4.6.0` / `0.12.2` |
| `react-native-gesture-handler` | `3.3.0` |
| `react-native-screens` / `react-native-safe-area-context` | `4.28.0` / `5.10.0` |
| `nativewind` | `4.2.7` |
| `react-native-yamap-plus` | `6.11.0` |
| `@sentry/react-native` | `8.27.0` |
| `@appmetrica/react-native-analytics` | `4.2.0` |
| `@react-native-async-storage/async-storage` | `3.1.1` (локальные настройки, телефоны и офлайн-кэш заказов; Bearer-токен хранится отдельно в Keychain/Keystore) |
| `@react-native-community/datetimepicker` | `9.2.1` (peer `react-native-modal-datetime-picker`, прямой импорт в Calendar закомментирован) |
| `@fortawesome/react-native-fontawesome` | `1.0.0` (рендерер FA7; core/icons уже 7.x) |
| `lucide-react-native` | `1.47.0` (JS поверх `react-native-svg`; Copy / QrCode / RefreshCcw / Search). Metro: в `sourceExts` нужен `mjs` — пакет 1.x отдаёт ESM `.mjs`, native-сборку не трогаем |
| `@react-native-community/netinfo` | `12.0.1` (глобальный индикатор сети включён в AppProviders; refresh каждые 15 секунд) |
| `react-native-device-info` | `15.0.2` (breaking 15 = compileSdk 34+, у нас 37; индикатор интернета его не использует) |
| `@react-native-firebase/app` + `messaging` | `26.4.0` |
| `@react-navigation/drawer` / `native` / `native-stack` | `^7.14.2` / `^7.4.1` / `^7.19.2` |
| `eslint` | `^10.11.0` |
| `@babel/core` | `^7.29.7` |
| `typescript` | `6.0.3` |

Совместимые обновления внутри текущих major от 27 августа 2026:

- Font Awesome core/icons `7.3.1`, resolvers `5.9.1`, axios `1.20.0`;
- dayjs `1.11.23`, query-string `9.5.0`, react-hook-form `7.87.0`, zustand `5.0.15`;
- react-native-permissions `5.6.1`, baseline-browser-mapping `2.11.21`;
- 4 сентября: Sentry `8.25.0`, datetimepicker `9.2.0`, Firebase app + messaging `26.3.3`;
- 7 сентября: Firebase app + messaging `26.4.0`, lucide `1.41.0`,
  react-hook-form `7.87.0`, ESLint `10.10.0`, Jest `30.5.1` и
  `@typescript-eslint` / `typescript-eslint` `8.69.0`.
- 7 сентября, отдельный эксперимент: прямая замена на TypeScript 7.0.2
  подтвердила несовместимость с `typescript-eslint`, а официальный side-by-side
  вариант TS7/TS6 прошёл проверки, но был признан избыточным для проекта.
  Итоговая версия — TypeScript `6.0.3`: один compiler/API, совместимый с
  `typescript-eslint@8.70.0`, и подготовленный к будущему переходу на TS7.
- Tailwind `3.4.19` и NativeWind `4.2.6` оставлены без изменений.
- 8 сентября: `react-native-worklets` `0.12.2` и datetimepicker `9.2.1`;
  Android release и iOS Simulator debug собраны успешно без запуска эмуляторов.
- 21 сентября: обновлены Navigation `7.14.2` / `7.4.1` / `7.19.2`, React и
  связанные пакеты `19.3.0`, Sentry `8.27.0`, NativeWind `4.2.7`,
  Gesture Handler `3.3.0`, Reanimated `4.6.0`, Worklets `0.12.2`,
  Safe Area `5.10.0`, Screens `4.28.0`, Permissions `5.6.2`, Edge-to-Edge
  `1.8.2`, lucide `1.47.0`, react-hook-form `7.88.0`, ESLint `10.11.0`,
  Jest `30.5.2`, Prettier `3.9.8`, TypeScript-ESLint `8.70.0` и
  baseline-browser-mapping `2.11.25`. Reanimated и Worklets оставлены на
  стабильной паре `4.6.0` / `0.12.2`: Worklets `0.13.0` пока имеет npm-тег
  `next`, хотя требуется Reanimated `4.7.0`.

Контроль 04.09.2026: `npm run lint`, `npm run typecheck`, `npm run test:unit` (88 suites / 339 tests), Android debug/release и iOS Simulator debug/release — успешно. Android release APK дополнительно установлен и вручную проверен на реальном Samsung.

Контроль TypeScript-эксперимента 07.09.2026: итоговый `tsc` и compiler API —
TypeScript 6.0.3; `npm run lint`, `npm run typecheck` и `npm run test:unit`
(88 suites / 339 tests) — успешно. Нативные сборки и эмуляторы для этого
эксперимента не запускались.

Контроль 21.09.2026 после полного согласованного обновления: `npm run lint`,
`npm run typecheck` и `npm run test:unit` (91 suite / 357 тестов) — успешно;
`pod install` синхронизировал iOS-зависимости. Нативные сборки, симуляторы и
эмуляторы не запускались.

`npm audit` после обновления 21 сентября показывает 7 проблем (2 low / 5 high). Автоматический `audit fix` не применялся: оставшиеся проблемы находятся в зафиксированных RN/Metro/Gluestack-зависимостях. Разбирать audit-хвост нужно отдельной задачей с повторной полной проверкой.

В той волне сохранялись shim `InteractionManager`, TS-условие
`react-native-legacy-deep-imports` и Metro `sourceExts` + `mjs` под lucide 1.
Ожидание, что TS-условие можно снять при RN 0.88, не подтвердилось автоматически:
текущее решение описано в разделе «Что не обновляли и почему». Патч Sentry 7 снят.

Babel: `react-native-worklets/plugin`. Не использовать `react-native-reanimated/plugin` и `react-native-worklets-core`.

При bump убрать мёртвое:

- `react-native-worklets-core`
- `reanimated-bottom-sheet` (нет импортов в `src/`)
- старые патчи `reanimated+3.16.7`, `gesture-handler+2.29.1`, `community-cli-plugin+0.77.2`, `css-interop` под worklets-core
- Finder-дубликаты `* 2.patch`
- патч `react-native-svg+15.13.0`, если это мусор сборки

`edgeToEdgeEnabled` в первой волне не включать.

### Карты: New Arch пробуем на `react-native-yamap-plus`

В коде уже `react-native-yamap-plus@6.11.0`. Старая `react-native-yamap@4.8.3` снята. New Architecture проверяем на plus.

Почему так: оригинал `4.8.3` — последний релиз ноября 2024, New Arch там нет. Plus живой (линейка 6 = New Arch, 5 = Paper + New Arch). Это не «сейчас», а решение плана на этапы 1–2 и карточный smoke.

Что было учтено при переходе:

- пакет другой: `react-native-yamap` → `react-native-yamap-plus`;
- init и часть props не drop-in (`YaMap.init` → `YamapInstance.init`, жесты `*Enabled` → `*Disabled`);
- старый патч `react-native-yamap+4.8.3` удалён; смысл фиксов переносить только если plus их ещё не закрыл;
- карта — основной экран: маркеры, grouping, tap, zoom, traffic.

Это **не пакет Яндекса**, и **Волга-Волга тоже не Яндекс**. Официально Яндекс даёт MapKit для Android, iOS и Flutter: [MapKit SDK](https://yandex.ru/maps-api/products/mapkit), репозиторий [yandex/yandex_maps_mapkit](https://github.com/yandex/yandex_maps_mapkit). Отдельной официальной библиотеки React Native у Яндекса нет.

`react-native-yamap` — сторонная обёртка компании Волга-Волга (`vvdev.ru`, GitHub `volga-volga`). `react-native-yamap-plus` — форк этой обёртки (автор Aleksey Pekhterev, [Qudaeo/react-native-yamap-plus](https://github.com/Qudaeo/react-native-yamap-plus)). Поэтому «переехали и не сказали»: не было официального анонса Яндекса. Plus не хороним заранее — это просто более живой community-форк с New Arch, не гарантия навсегда.

## 5. Этапы

### Этап 0. Ветка и docs

Сделано этим документом:

- ветка `new_architecture` от `main`;
- этот файл;
- ссылка из [docs/README.md](./README.md);
- оркестратор ролей Cursor в [.cursor/rules](../.cursor/rules).

Код приложения не менять. CI на Node 24 не включать в этом этапе. Коммиты делает только пользователь.

### Этап 1. Аудит и bump + флаги Fabric

Только после отдельного разрешения менять код.

- аудит [package.json](../package.json), [patches](../patches), native-либ драйвера;
- bump RN / React / Reanimated / Worklets / Gesture Handler;
- Android `newArchEnabled=true`, iOS `RCT_NEW_ARCH_ENABLED=1`;
- клиентские файлы и пины не копировать.

Ориентир нативной миграции: Upgrade Helper `0.86.0 → 0.87.0`, затем patch `0.87.1`, и требования RN `0.87`. Не копировать клиентские пины.

### Этап 2. Native compile

Сборка группами. После каждой группы — Android debug start. iOS — после `pod install`.

- Reanimated / Worklets / Gesture Handler
- Screens / Safe Area / Drawer
- карта: `react-native-yamap-plus` (New Arch пробуем на ней, не на старой `4.8.3`)
- Sentry
- Firebase / Notifee / Permissions
- AppMetrica

CMake/codegen чинить точечно. Fabric не откатывать.

### Этап 3. Jest / TS хвост

Вернуть зелёные команды из [docs/quality-baseline.md](./quality-baseline.md):

```bash
npm run lint
npm run typecheck
npm run test:unit
```

Это нужно сделать до ручного smoke. Не смешивать с починкой карты.

Текущий контракт [new-architecture.contract.test.ts](../__tests__/new-architecture.contract.test.ts)
проверяет `ConnectivityProvider` и единый `SafeAreaProvider` в `AppProviders`,
индикатор под шапкой drawer и shim `InteractionManager` в `index.js` до `App`.
Авторизация использует защищённый Laravel token storage (Keychain/Keystore);
`AsyncStorage.getItem('token')` / `setItem('token', ...)` в store запрещены.

### Этап 4. Android debug smoke

По [docs/testing/release-checklist.md](./testing/release-checklist.md):

- cold start, Greeting/Auth;
- Sentry / AppMetrica / YaMap не валят старт;
- логин / ошибка логина / токен;
- список заказов, карточка, модалка подтверждения;
- карта: маркеры, grouping, открытие заказа, пустое состояние;
- GPS: permission, позиция, GPS-зависимые действия;
- drawer: Settings / Graph / Statistics / Salary / Feedback;
- шиты заказа и фидбека: open / close / backdrop;
- fake orders остаются `off`.

UI чинить только если сломалось. Эмулятор не вердикт по производительности.

### Этап 5. iOS debug smoke

Тот же список отдельно на iOS.

### Этап 6. Release smoke

Embedded bundle без Metro, Android 16 KB, iOS archive / permissions / push на старте.

MiniCodePush в этом проекте нет.

## 6. Курьерские риски

Правила работы: [docs/project-rules.md](./project-rules.md). Обзор: [docs/project-overview.md](./project-overview.md).

1. **Карта** — основной рабочий экран. New Arch проверяем на `react-native-yamap-plus`, не на старой `react-native-yamap@4.8.3`. Точки: [MapScreen.tsx](../src/features/orders-map/ui/MapScreen.tsx), `freezeOnBlur: false` в [MainDrawerNavigator.tsx](../src/app/navigation/MainDrawerNavigator.tsx).
2. **Геолокация** — `@react-native-community/geolocation` в [store.ts](../src/shared/store/store.ts). Библиотеку не менять, пока 0.87 её не сломает.
3. **Sentry** — `Sentry.wrap`, metro, [reanimatedGuard.ts](../src/shared/lib/reanimatedGuard.ts). После `pod install` версия `8.27.0` должна синхронизировать iOS с `RNSentry 8.27.0` без патча `RCTTextView.h` (патч `7.13.0` удалён).
3a. **Drawer / InteractionManager** — RN `0.87` удалил `InteractionManager`. Drawer `7.14.2` / `react-native-drawer-layout` 4.2.x на RN ≥ 0.82 сами не дергают handle, но shim [interactionManagerCompat.ts](../src/shared/lib/interactionManagerCompat.ts) оставляем: жест меню на устройстве без shim не снимали. Navigation 8 — alpha, не берём.
    Отложенные dev-предупреждения RN `0.87`: `DrawerLayoutAndroid` ранее приходил из внутреннего legacy-экспорта `react-native-gesture-handler@3.2.1`; повторяющийся Reanimated `dependencies should only be used in web implementation` — из overlay `react-native-drawer-layout@4.2.10`; `ImageBackground` — из регистрации компонентов `react-native-css-interop` / NativeWind 4, а не из кода приложения. После обновления Gesture Handler до `3.3.0` и NativeWind до `4.2.7` предупреждения нужно перепроверить вручную; патчи добавлять только при подтверждённой проблеме.
3b. **Firebase 26** — modular JS уже был (`getApp` / `getMessaging`). Native iOS: не SPM (статическая линковка), `$RNFirebaseDisableSPM = true`. Откат — парой `app`+`messaging`.
4. **`react-native-reanimated-table`** в графике и статистике. Если сломается на Reanimated 4 — точечный фикс.
5. **`@react-spring/native`** в [CustomAlert.tsx](../src/shared/ui/CustomAlert.tsx). Менять только при регрессии.
6. **Шиты gorhom** на карте и в фидбеке. Не переписывать заранее под клиентский `BottomSheetModal`.
7. **Глобальные overlay** в [AppProviders.tsx](../src/app/providers/AppProviders.tsx). Если перехватят тачи карты — чинить `pointerEvents` только там.
8. **`removeClippedSubviews={true}`** в [OrdersList.tsx](../src/features/orders-list/ui/OrdersList.tsx) и [FeedbackList.tsx](../src/features/feedback/ui/FeedbackList.tsx). Запасной фикс, не превентивная правка.

## 7. Чеклист для Битрикс

Задача: «Курьерское приложение — новая архитектура, обновление зависимостей».

1. Составление плана миграции курьерского приложения
2. Проведение аудита и обновление зависимостей
3. Выполнение перехода на новую архитектуру
4. Стабилизация приложения после миграции
5. Проверка карты заказов, маркеров и YaMap
6. Проверка геолокации, permissions и GPS-зависимых действий
7. Проверка списка заказов, логина и основных экранов
8. Проведение тестирования на реальных устройствах Android и iOS
9. Проверка release-сборки Android и iOS

Не добавлять в этот чеклист заранее: «баги», splash / edge-to-edge / шиты, доработку модалок, замеры FPS, «обновить документацию».

## 8. Вне этой миграции

### Что не обновляли и почему

Актуализировано 16.10.2026 для RN `0.88.0`: перечисленные ниже переходы
остаются отдельными миграциями, а не обычной заменой номера версии.

**Отдельно оцениваемые переходы**

- Переход на `react-native` `0.88.0` выполнен 16.10.2026 (проверки — в начале
  документа). Условие `react-native-legacy-deep-imports` пока сохранено:
  RN 0.88 всё ещё предоставляет этот режим, а перевод всего приложения и
  сторонних типов на строгий публичный API не входит в обновление библиотек.
- `@react-navigation/*` 8 (`@next`) — alpha. Используется семёрка
  (drawer `^7.14.4`); shim `InteractionManager` оставляем.
- `nativewind` 5 / Tailwind 4 — отдельная миграция UI-инфраструктуры, не
  drop-in обновление. Проект остаётся на NativeWind `4.2.7` / Tailwind `3.4.19`.
  Перед переходом заново проверить статус выпуска и официальный путь миграции;
  локальным компонентам Gluestack, Babel/Metro и CSS-interop потребуется
  согласованная адаптация. Наличие инструкции Gluestack само по себе не
  означает совместимость текущих локальных компонентов без изменений.

**Ломает текущий стек**

- `tailwindcss` 4 — другой движок. NativeWind 4 и Gluestack `className` заточены под Tailwind 3. `^3.4.19` = последний 3.x (npm `v3-lts`).
- `@babel/core` 8 — пресет `@react-native/babel-preset@0.88.0` использует
  Babel 7 и плагины семёрки; текущий core оставлен на `^7.29.7`.
- прямая замена пакета `typescript` на 7 — нативный Go-`tsc` не предоставляет
  прежний JS compiler API; `typescript-eslint@8` требует `>=4.8.4 <6.1.0` и
  на 7 падает. Рекомендованный Microsoft side-by-side TS7/TS6 технически
  работает, но для этого проекта пока избыточен; оставлен единый TypeScript
  `6.0.3`.
- `@expo/html-elements` 55+ — нумерация Expo SDK, не drop-in с `^0.13.8`. Gluestack (Heading / Table / Actionsheet) сидит на 0.13.
- Android `edgeToEdgeEnabled` / splash — не npm, флаг вёрстки; ломает системные инсеты (шапка, карта). С клиентского приложения не копировать.

**Не пакеты этой волны**

- SwiftPM вместо CocoaPods — экспериментальная сборка iOS; Firebase/RN оставляем на pods (`$RNFirebaseDisableSPM = true`).
- усиление ESLint-правил (движок уже 10)
- e2e
- переписывание шитов «под клиентскую схему»

### UI-хвост

Отдельный план переноса интерфейса: [docs/driver-site-ui-migration-plan.md](./driver-site-ui-migration-plan.md).

UI выполняется в ветке `new_architecture`, но отдельными согласованными этапами и не смешивается с волной обновления зависимостей.

Исходный UI-хвост, который перенесён под контроль отдельного плана:

- `ScreenLayout` переведён с deprecated `SafeAreaView` React Native на `react-native-safe-area-context`; `SafeAreaProvider` поднят в `AppProviders`, drawer-layout использует края без `top`, а `Auth` / `ResetPwd` / `Greeting` сохраняют верхний inset
- Status Bar централизован через route-aware `SystemBars` для Android и iOS: красные Greeting/drawer-шапка получают светлые иконки, светлые Auth/ResetPwd — тёмные
- карта растянута до нижнего края, а её панель и лимиты используют фактический bottom inset; обычные drawer-экраны и нижние шторки также защищены от iOS home indicator и Android navigation bar
- настройки карты используют обычные управляемые checkbox. Тема интерфейса
  вынесена из старого `night_map` в отдельный выбор `system | light | dark`, а
  карта следует фактической теме приложения. Тот же управляемый шаблон сохранён
  для «Уведомить о решении» в фидбеке.

Состав текущего стека приведён в начале документа и в
[package.json](../package.json); старые номера из UI-этапов не являются
рекомендацией для новой установки. Для iOS/Fabric `yamap-plus` пропатчен:
нативная geometry маркера инициализируется до mount/recycle, а JS-слой не
монтирует маркеры с нечисловыми или выходящими за диапазон координатами.
Предыдущий native release-smoke на Samsung/iOS Simulator относится к своей
сборке. Подтверждения после обновления зависимостей и оставшиеся проверки
реальных устройств ведутся в [журнале](testing/testing-progress.md) и
[релизном чек-листе](testing/release-checklist.md).

### Отдельная задача, не этот переезд

Кнопка «Удалить аккаунт» для тестового аккаунта `79990000001` / `DemoDriver1!`.

Кнопка реализована только для demo-пользователя. Она показывает подтверждение, имитирует успешное удаление, очищает локальную сессию и выполняет обычный logout, но не удаляет данные на backend. Для остальных аккаунтов кнопка скрыта; сценарий вручную и тестами проверен.

## 9. Definition of Done

Исходные критерии миграции (история, не изменение действующих правил веток):

- ветка `new_architecture` живёт отдельно от `main`;
- Android и iOS debug стартуют на RN `0.87` + Fabric;
- карта, список заказов, логин, GPS, основные drawer-экраны проходят ручной smoke;
- шиты работают или точечно починены без смены архитектуры;
- `lint` / `typecheck` / `test:unit` зелёные;
- Android release smoke пройден на реальном Samsung, iOS release smoke — на Simulator; проверка на реальном iPhone явно оставлена руководителю;
- бизнес-логика store и заказов не переписана «под Fabric».

На 04.09.2026 техническая миграция RN/Fabric выполнена. За её пределами остаются:
production-настройка Laravel CAPTCHA/SSO ответственным за сервер, реальный iPhone,
решение по QR-оплате, ручной smoke тем Android/iOS и отдельный аудит
транзитивных зависимостей.

## 10. Роли Cursor

Короткий набор, не копия клиентского:

- [.cursor/rules/00-orchestrator.mdc](../.cursor/rules/00-orchestrator.mdc) — всегда
- [.cursor/rules/90-safety.mdc](../.cursor/rules/90-safety.mdc) — всегда
- [.cursor/rules/10-analyst.mdc](../.cursor/rules/10-analyst.mdc)
- [.cursor/rules/20-developer.mdc](../.cursor/rules/20-developer.mdc)
- [.cursor/rules/30-tester.mdc](../.cursor/rules/30-tester.mdc)
- [.cursor/rules/31-reviewer.mdc](../.cursor/rules/31-reviewer.mdc)

Оркестратор: сначала анализ, код только после подтверждения, коммиты не делать.

Дальше работаем через эти роли. Если роль не покрывает задачу или мешает — правим `.mdc`, не обходим правило в чате.

## 11. Дисциплина

Правила: [docs/project-rules.md](./project-rules.md).

- менять локально;
- не смешивать bump, UI-rewrite и majors;
- store и заказы не трогать без причины;
- этот документ обновлять вместе со статусом этапов.

Этап 1 и дальше — только после отдельного разрешения менять код приложения.
