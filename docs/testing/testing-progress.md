# Статус тестирования и baseline

Документация и результаты проверок CodePush находятся в [едином документе](./codepush-checks.md).

## Запуск Android Debug — 22.10.2026

По отдельному разрешению пользователя приложение установлено и запущено
в `Pixel_9` (Android 15), после миграции Kotlin. Для освобождения места по
явному разрешению удалены старые тестовые `com.jaco_test_app_site` и
`ru.jaco.nativepilot`. Сброс эмулятора не выполнялся.

Установка — `Success`; холодный запуск MainActivity — `Status: ok`.
Процесс остаётся в foreground, JavaScript подтвердил запуск `jacoDriverTest`
с `fabric: true`; стартовых ошибок AndroidRuntime/ReactNativeJS не обнаружено.
Вход, карта, действия с заказами и сохранение данных прежней установки
этим запуском не проверялись. Предыдущие записи «не запускалось» относятся
к этапам до отдельного разрешения пользователя.

## Встроенный Kotlin — 22.10.2026

По разрешению пользователя включены built-in Kotlin и новый Android DSL.
Причина, настройки и границы — в
[плане миграции](../new-architecture-migration-plan.md),
перечень изменений библиотек — в [описании патчей](../../patches/README.md).

- Debug и localRelease собраны для `arm64-v8a` / `x86_64`, без установки
  и запуска. После дополнительной проверки формата патчей итоговый Debug
  также повторно собран с аудитом реально настроенных Gradle-модулей.
- Аудит подтвердил **26 Android-модулей** со встроенным Kotlin и новым DSL;
  внешний `org.jetbrains.kotlin.android` / `kotlin-android` нигде не применён.
  Предупреждений `Deprecated 'org.jetbrains.kotlin.android' plugin usage`
  в итоговых Debug/localRelease логах — **0**. Другие deprecated API сторонних
  библиотек остаются видимыми; их диагностика не подавлялась.
- Оба APK прошли `zipalign -c -P 16 4`. В localRelease есть встроенный
  JS/Hermes bundle — 10 831 224 байта.
- В обоих APK `assets/fonts/MaterialIcons.ttf` побайтово совпадает с исходником;
  другие icon fonts не добавлены. Прежние Roboto assets сохранены.
- В DEX Debug APK проверены именно определения семи Kotlin-классов:
  MainApplication, ReactNativeFirebaseApp, NativeRNFBTurboApp,
  RNPermissionsModule, EdgeToEdgeModule, TransportModuleImpl, AsyncStorageModule.
  Это проверка попадания дополнительных Kotlin-каталогов в компиляцию,
  а не только наличия их имён в строках или исходниках.
- `npm run postinstall` успешно применяет все **16** патчей проекта.
  Дополнительно **15 Gradle-патчей / 32 файла** проверены настоящим patch-package
  на чистых npm-архивах тех же версий; результат побайтово совпадает с установленными
  файлами. Прежние 17 файлов патча карты сохранены; AppMetrica patch не менялся.
- `npm run lint`, `npm run typecheck` — успешно.
  `npm run test:unit -- --ci --silent --verbose=false` —
  **131 набор / 991 тест**, все прошли; snapshots: 0.
  Существующий контракт настроек обновлён на built-in Kotlin / новый DSL.
- Статическое ревью Gradle, generated assets и сохранения версий — без замечаний.

Приложения и эмуляторы не запускались; Sentry upload отключён. Версии npm,
Kotlin/KSP, minSdk/targetSdk/NDK и версия приложения сохранены. iOS/Pods на этом
этапе не менялись и не пересобирались. Ручной запуск и проверка поведения —
в [чек-листе](./release-checklist.md).

## Sentry 8.32 — 22.10.2026

По отдельному разрешению пользователя `@sentry/react-native` обновлён с
`8.31.0` до `8.32.0`, Sentry CLI — до `3.8.1`, Cocoa SDK — до `9.31.0`.
Обязательной миграции настроек приложения нет; подробности и официальный
релиз — в [плане миграции](../new-architecture-migration-plan.md).

- В npm lock изменились только Sentry и его зависимости. Прочие пакеты,
  настройки `Sentry.init`, обработка ошибок и Metro сохранены.
- `npm run ios:pods -- --no-repo-update` — успешно: `RNSentry 8.32.0`;
  среди версий Pods изменился только RNSentry. Prebuilt Sentry SDK загружен
  штатным скриптом с проверкой SHA-256; версия framework — `9.31.0`.
  Сохранены Firebase SwiftPM pins и файл проекта Xcode. Проверка RN подтверждает
  совпадение JS / iOS `0.88.0`.
- `npm run lint`, `npm run typecheck`, `npm ls --depth=0` — успешно.
  `sentry-cli --version` подтверждает `3.8.1`.
- `npm run test:unit -- --ci --silent --verbose=false` —
  **131 набор / 991 тест**, все прошли; snapshots: 0.
- Android localRelease собран для `arm64-v8a` / `x86_64`, APK прошёл
  `zipalign -c -P 16 4`, встроенный bundle присутствует. Source map подтверждает
  сохранение source exports HTML Elements для NativeWind 4.
- iOS Release собран для generic iPhone без подписи:
  `.xcresult`: `status=succeeded`, `errorCount=0`. В приложении встроен
  `RNSentry.framework 8.32.0`, bundle — 10 828 492 байта; source map также
  подтверждает прежнюю обработку HTML Elements. Сохраняются предупреждения
  сторонних модулей и скриптов сборки.

Приложения и эмуляторы не запускались. Sentry upload при сборках отключён;
доставка событий и символикация вручную не проверены. Эти сценарии остаются
в [релизном чек-листе](./release-checklist.md).

## Expo HTML Elements 58 — 22.10.2026

По отдельному разрешению пользователя `@expo/html-elements` обновлён с
`0.13.8` до `58.0.3`. Другие npm-версии этой операцией не менялись.
Для совместимости с NativeWind 4 Metro выбирает официальный `expo-source`
только у этого пакета: причина и устройство — в
[плане миграции](../new-architecture-migration-plan.md).

- [26 новых тестов](../../__tests__/expo-html-elements-resolution.test.ts)
  используют реальный Metro resolver и установленный Babel, обходя UI-моки.
  Проверены Android/iOS, публичные exports, выбор `.native.tsx`, обработка
  JSX через CSS interop, неизменность контекста и разрешения других пакетов.
  Контрольный сценарий подтверждает, что `build/` сохраняет обычный JSX runtime
  и сам по себе не получает преобразование NativeWind.
- `npm run lint`, `npm run typecheck` — успешно, без ошибок и предупреждений.
- `npm run test:unit -- --ci --silent --verbose=false` —
  **131 набор / 991 тест**, все прошли; snapshots: 0. Прежние 965 тестов сохранены.
- Android localRelease собран для `arm64-v8a` / `x86_64`; APK прошёл
  `zipalign -c -P 16 4`, встроенный bundle — 10 826 612 байт.
- iOS Release собран для generic iPhone без подписи:
  `.xcresult`: `status=succeeded`, `errorCount=0`; bundle — 10 816 468 байт.
  Сохраняются предупреждения сторонних модулей и скриптов сборки.
- В source maps обеих Release-сборок все 14 файлов HTML Elements происходят
  из `src/`, из `build/` нет ни одного. Это подтверждает работу настройки
  в настоящих сборках с обёртками NativeWind/Sentry, а не только в unit-тесте.
- Статическое ревью селектора и порядка обёрток — без блокирующих замечаний.

Приложения и эмуляторы не запускались; отправка артефактов в Sentry отключена.
Визуальная проверка шторок и тем остаётся пользователю в
[чек-листе](./release-checklist.md). Общие Heading/Table и SectionHeaderText
сейчас не используются на экранах; их наличие не выдаётся за ручной сценарий.
Проверки resolver/Babel не подтверждают визуальное совпадение интерфейса.

## Обновления со скриншотов — 22.10.2026

По явному разрешению пользователя обновлены все 13 прямых пакетов со
скриншотов, включая Firebase app/messaging `27.0.0` и resolvers `6.0.0`.
Версии и необходимые изменения подключения Firebase описаны в
[плане миграции](../new-architecture-migration-plan.md).
На момент этого этапа CodePush ещё не был подключён к startup; актуальное
устройство описано в едином документе, указанном в начале журнала.

Автоматические проверки:

- `npm run lint` — успешно, без ошибок и предупреждений. Один промежуточный
  запуск пересёкся с удалением старых Firebase Pods и завершился `ENOENT`;
  после окончания установки Pods повторный запуск прошёл.
- `npm run typecheck` — успешно.
- `npm run test:unit -- --ci --silent --verbose=false` — **130 наборов / 965 тестов**,
  все прошли; snapshots: 0. Сценарии первого этапа CodePush сохранены.
- `npm ls --depth=0` — версии согласованы, ошибок зависимостей нет.
- `npm run postinstall` — применяются патч карты `react-native-yamap-plus@6.12.0`
  и однострочный патч линковки RN-моста `@appmetrica/react-native-analytics@4.2.0`.
  Устаревшее исправление удалённых Android paper-интерфейсов RNGH больше
  не вызывается, скрипт удалён.
- `npm run ios:pods -- --no-repo-update` — успешно: RNFBApp/Messaging `27.0.0`,
  Firebase SDK подключён через SPM. `node scripts/check-ios-rn-version.cjs`
  подтверждает совпадение JS / iOS RN `0.88.0`.
- Статическое ревью нативной конфигурации выполнено. Замечание о минимуме
  Node исправлено: `>=24.12.0 <25`, локальная `24.15.0` подходит.

Нативные проверки:

- Android Debug и localRelease успешно собраны для `arm64-v8a` / `x86_64`.
  Оба APK прошли `zipalign -c -P 16 4`; localRelease содержит встроенный bundle.
  Сохранились предупреждения о старых Gradle/Kotlin API, Google Sign-In/D8
  и лимите metaspace; они не остановили сборку.
- SwiftPM resolve завершился успешно. В сохранённом workspace `Package.resolved`
  закреплены 13 зависимостей, Firebase SDK — ровно `13.0.0`. Первая загрузка
  GitHub-кеша оборвалась по HTTP/2; повторная загрузка завершилась.
- Контрактный тест дополнительно проверяет FirebaseCore в app target,
  фазу встраивания SPM frameworks и версию SDK в `Package.resolved`.
- iOS Debug собран для generic iPhone (`arm64`, Xcode 27), без подписи и запуска.
  Итоговый `.xcresult`: `status=succeeded`, `errorCount=0`. В процессе проверки
  исправлена линковка UTI frameworks у ImagePicker/Clipboard и RN-моста
  AppMetrica; настройки и код аналитики не менялись. Сохраняются предупреждения
  сторонних модулей и скриптов сборки, включая deprecated `RCTAppDelegate`.
- iOS Release также успешно собран для generic iPhone (`arm64`), без подписи
  и запуска: `.xcresult` подтверждает `status=succeeded`, `errorCount=0`.
  Встроенный JS готовится обычным Release pipeline; отправка source maps и
  нативных debug symbols в Sentry отключена.
- Release-артефакт дополнительно проверен без запуска: `main.jsbundle`
  содержит **10 816 280 байт**. У 60 встроенных frameworks / 61 Mach-O образа
  все 320 ссылок `@rpath` разрешаются внутри приложения. AppMetrica Core/Crashes
  и FirebaseCore встроены по одному экземпляру; статический RN-мост AppMetrica
  отдельно не встраивается. Класс `FIRMessaging` определён ровно один раз внутри
  `RNFBMessaging.framework`: отдельный `FirebaseMessaging.framework` для этого
  automatic SPM product не требуется.

Ручные сценарии остаются в [релизном чек-листе](./release-checklist.md).
Приложения и эмуляторы не запускались; Sentry upload при сборке отключён.
Реальные API, заказы, S3, публикация и `npm audit fix` не использовались.

## Предыдущий baseline и дополнительные регрессии — 16.10.2026

Это единый источник свежих числовых результатов; датированные разделы ниже
сохраняют историю предыдущих этапов и не заменяют текущую проверку.

После актуализации документации и добавления тестов:

- `npm run lint` — успешно, без ошибок и предупреждений;
- `npm run typecheck` — успешно;
- `npm run test:unit -- --ci` — **128 наборов / 782 теста**, все прошли,
  0 failed / skipped / todo; предыдущие 717 сценариев сохранены;
- `node scripts/check-ios-rn-version.cjs` — JS / iOS `0.88.0`, версии совпадают;
- нативные регрессии меток — iOS lifecycle **125/125**, iOS images **31/31**,
  Android images **31/31** assertions.

Добавлено 65 сценариев, без изменения кода и поведения приложения:

- поздний ответ загрузки настроек после успешного сохранения или сброса,
  с задержкой как API, так и чтения AsyncStorage;
- 20 повторных обновлений заказов при медленном запросе, ответе `st=false`,
  исключении и переходе офлайн: очередь, кэш и индикаторы освобождаются;
- сохранение реального JSON частичного фильтра и восстановление при холодном
  офлайн-старте, без смешивания пользователей, кафе и разделов;
- распознавание изображений без MIME, нормализация метаданных, смешанный
  выбор фото/видео и отказ API до чтения токена и отправки запрещённых файлов;
- обычное сохранение прозрачных и фиксированных тем меток в светлой, тёмной
  и системной теме, включая смену темы устройства без повторного выбора меток;
- выбор JDK и команд Android: только временные фикстуры и подставные инструменты,
  без настоящих Gradle, Java, npx, установки приложения или сети.

Обновлены актуальные сводки, инструкции запуска и правила тестирования.
Исходники приложения, сборочные скрипты, зависимости и lock-файлы в этом шаге
не менялись. Новые проверки не выявили ошибок поведения приложения.
Сборки, приложения и эмуляторы не запускались, реальные API и заказы не использовались.
Разбор предупреждений `npm audit` по решению пользователя отложен; повторный
audit и автоматическое исправление зависимостей в этот шаг не входят.

### Ручная проверка пользователя после обновления

16.10.2026 пользователь сообщил, что приложение нормально работает онлайн
и офлайн, в том числе карты и смена тем. Это пользовательское подтверждение
проверенных им сценариев, а не полный release-smoke: конкретные платформы,
устройства, Debug/Release и остальные сценарии в сообщении не уточнены.
Непроверенные пункты [релизного чек-листа](./release-checklist.md) остаются открытыми.

## Исправление iOS version mismatch — 16.10.2026

Успешная первоначальная сборка не выявила смешанную установку: JS и React-Core
были 0.88.0, но закешированный внешний pod `React-Core-prebuilt`, его build script
и реальное ядро оставались 0.87.1. Поэтому повторный `npm run ios` воспроизводил
ошибку в runtime. Это пропуск проверки нативной версии, а не выбор симулятора.

Выполнен точечный `pod update React-Core-prebuilt --no-repo-update`, без удаления
Pods, приложения, аккаунтов или скачанных карт. Версии обоих lock-файлов,
podspec, build scripts, URL архивов и нативного заголовка теперь совпадают: 0.88.0.
Перед `npm run ios` выполняется read-only guard. `ios:pods` один раз обновляет
только обнаруженные устаревшие RN Pods и проверяет результат; с `--deployment`
автообновление запрещено. Контрактный тест проверяет сохранённый lock без Pods
на чистом CI; workflow-тесты исполняют bash только на временных заглушках.

Результат после этого исправления: lint / typecheck проходят,
126 suites / 717 tests passed, 0 failed / skipped / todo. Это прежние 694
сценария и 23 новые проверки версий/восстановления. Нативные проверки меток:
125 + 31 + 31 assertions — успешно.

Исправленный iOS Debug собран для iPhone 17 Pro / iOS 26.2 (arm64),
`BUILD SUCCEEDED`. UUID встроенного React совпадает с новым ядром из Pods
(`1DBB6CDD-8925-3FB0-BC70-35DD5FA73EAF`) и отличается от старого 0.87.1.
Сборка выполнена в стандартный DerivedData, используемый `npm run ios`.
Приложение не устанавливалось и не запускалось; ручной runtime smoke выполняет
пользователь. Ранее собранный generic Simulator-артефакт был смешанной версии
и не считается runtime-подтверждением RN 0.88.

## Зелёный baseline — 16.10.2026

По отдельному запросу пользователя исправлены все 14 исходных падений.
Результат на этом этапе: `lint`, `typecheck` и полный `test:unit` проходят;
124 набора / 694 теста, 0 failed / skipped / todo. Все прежние 689 сценариев
сохранены; добавлено 5 проверок корректности тестовых кнопок.

Причины и исправления:

- RN-заглушки `Pressable` / `TouchableOpacity` теперь учитывают disabled через
  responder, доступность по роли и вычисление callback-стиля. Это исправляет
  ложное нажатие неактивного сброса настроек, поиск ручки по роли и стили фильтра.
- В тесте карты иконка `RefreshCcw` теперь представлена компонентом с переданными
  props вместо пустой заглушки. Цвет проверяется через публичный prop `color`,
  толщина линий и поведение обновления по-прежнему проверяются.
- В тестах карты/карточки добавлено ожидание асинхронных `fireEvent` и `act`,
  чтобы незавершённое действие не влияло на следующий тест.

Код приложения, условия действий с заказами и набор проверяемых сценариев не
менялись. Повторены нативные проверки: iOS lifecycle 125/125, iOS images 31/31,
Android images 31/31 assertions — успешно. Приложения не запускались.

## Обновление зависимостей — 16.10.2026

RN `0.88.0`, React `19.3.1`, `react-native-yamap-plus` `6.12.0` и
сопутствующие библиотеки обновлены в текущем `main` с согласия пользователя.
Полный состав и ограничения: [план миграции](../new-architecture-migration-plan.md).

- Lint и typecheck проходят до и после обновления.
- До обновления: 123 набора / 688 тестов, 674 passed / 14 failed.
- После обновления: 123 набора / 689 тестов, 675 passed / 14 failed.
- Состав 14 ошибок не изменился: `settings-screen`, `ui.orders-map-screen`,
  `ui.orders-map-sheet`, `ui.orders-filter-sheet`. Новых падений нет,
  но на этом этапе полный unit-набор ещё не был зелёным; позже исправлен выше.
- Нативные регрессии установленной карты: iOS lifecycle 125/125,
  iOS images 31/31, Android images 31/31 assertions — успешно.
- Production JS bundles iOS и Android собраны успешно.
- Android Debug и localRelease собраны успешно для arm64-v8a / x86_64;
  оба APK прошли `zipalign -c -P 16 4`, localRelease содержит JS/Hermes bundle.
  iOS Debug для generic Simulator (arm64 / x86_64, Xcode 27) собран;
  повторный проход: `BUILD SUCCEEDED`, `.xcresult` status succeeded / 0 errors.
  iOS Release в эту проверку не входил.
- Приложение, устройства и эмуляторы в этой проверке не запускались;
  ручная проверка карты, карточек, тем и офлайн-режима ещё требуется.
- `npm audit`: 51 предупреждение (32 high / 19 moderate), как до обновления;
  принудительное исправление с заменой несовместимых зависимостей не запускалось.

Ниже сохранён исторический baseline на 01.10.2026; актуальные результаты
и состав проверок приведены в начале документа.

## Дата фиксации

2026-10-01

## Короткий статус

Quality baseline реализован и проходит локально.

Текущий обязательный baseline:

1. `npm run lint`;
2. `npm run typecheck`;
3. `npm run test:unit`.

## Unit-тесты

Команда:

```bash
npm run test:unit
```

Текущий результат:

- `103` suites passed;
- `424` tests passed;
- Detox, эмуляторы и нативные сборки в этот прогон не входили.

Сделано:

- добавлен скрипт `test:unit`;
- исправлены тесты статистики с `jest.setSystemTime`.
- добавлены focused unit-тесты для:
  - settings hook state/save flow;
  - settings store `getSettings`;
  - settings store `saveSettings`;
  - orders-map filters/getOrders;
  - feedback modal validation/image picker flow;
  - GEOStore permissions/current-position/watch-position flow;
  - login/auth/SMS/check-token/logout flow;
  - stat store price/graph/errors/statistics/avg-time flow;
  - feedback store list/detail/create/upload/modal flow;
  - global store token/modal/alert/settings helpers;
  - auth/reset hooks validation/navigation flow;
  - schedule hooks graph/month/error-modal flow;
  - orders-list hooks and limits;
  - settings/avg-time updater intervals.
  - Laravel routes, transport, error normalization and DTO adapters;
  - Bearer-token storage in Keychain/Keystore and logout cleanup;
  - SSO callback/exchange and SmartCaptcha UI lifecycle;
  - Laravel auth, settings, feedback, orders and menu visibility;
  - demo-account deletion guards and absence of destructive requests;
  - Android/Fabric map marker stability during repeated geolocation;
  - iOS/Fabric marker geometry initialization and invalid-coordinate filtering;
  - сохранение списка и маркеров заказов при временной потере сети.

## Typecheck

Команда:

```bash
npm run typecheck
```

Текущий статус:

- команда проходит успешно;
- скрипт добавлен в [package.json](../../package.json).

## Lint

Команда:

```bash
npm run lint
```

Текущий статус:

- команда проходит успешно;
- добавлен [eslint.config.js](../../eslint.config.js) под ESLint 10.
- современные lint-плагины закреплены явно в [package.json](../../package.json), включая `@typescript-eslint@8.x`.

Ограничение:

- для TS/TSX сейчас включены `react-hooks/rules-of-hooks: error` и
  `react-hooks/exhaustive-deps: warn`; предупреждения не блокируют команду;
- остальные строгие RN/hooks правила усиливаются отдельной задачей, без
  смешивания baseline и большой lint-чистки.

## Что считать готовым baseline

Baseline готов, когда проходят:

```bash
npm run lint
npm run typecheck
npm run test:unit
```

И при этом:

- команды описаны в [package.json](../../package.json);
- результаты зеленые локально;
- проверки повторяемы;
- документация обновлена.

## Последний этап: GitHub gate

GitHub gate добавлен:

- workflow [.github/workflows/ci-baseline.yml](../../.github/workflows/ci-baseline.yml);
- запуск на `pull_request`;
- запуск на `push` в `main`;
- проверки `npm run lint`, `npm run typecheck`, `npm run test:unit -- --ci`;
- required check для branch protection: `CI Baseline / lint-typecheck-unit`.

Подробно:

- [docs/testing/git-checks.md](./git-checks.md)

## Журнал решений

### 2026-10-06 — финальная проверка Android и загрузки маркеров

- В нативном Android-маркере воспроизведена гонка A → B → A → B: устаревшая
  загрузка оставляла `pendingSource` и блокировала следующий запрос того же PNG.
  Смена source теперь отменяет старый запрос, а ошибка декодирования освобождает
  pending через callback на главном потоке, сохраняя прежнюю иконку без busy retry.
- Аналогичная гонка смены source закрыта в iOS. Исправление Fabric recycle
  сохраняется. Изменения обоих платформ включены в `patch-package`.
- Нативные тесты исполняют настоящие тела методов зависимости: Android 31/31
  (до правки 23/31), iOS image race 31/31 (до правки 20/31), iOS recycle 125/125.
- Пройдены `lint`, `typecheck` и 8 профильных Jest suites / 96 tests: маркеры,
  карта, карточки, сессии, фильтры и скачивание офлайн-городов.
- Собраны `assembleRelease` и `assembleLocalRelease` с R8/shrinkResources и
  встроенным JS. Оба APK проходят `zipalign -c -P 16 4`; все 48 `.so`
  (`arm64-v8a`, `x86_64`) хранятся без сжатия, все ELF LOAD align ≥ 0x4000.
  Полный patch снят и повторно применён к чистым исходникам во временной папке;
  результат совпал с установленным модулем байт-в-байт.
- На Android 16 / 16 КБ проверены отображение маркеров, открытие по центру текста
  онлайн и в авиарежиме, сохранение обоих заказов при переходе список ↔ карта,
  10 последовательных открытий/закрытий карточки и отдельная зелёная метка.
  Процесс приложения не перезапускался, app crash/ReactNativeJS errors не найдено.
- Холодный запуск в авиарежиме восстановил список и карту с прежними заказами.
  Тайлы и метки появились после начальной загрузки SDK. Офлайн-обновление и
  переключения «Мои» → «У других» → «Активные» сохранили нужные маркеры.
  После возврата сети загрузка завершилась, карта получила актуальные заказы;
  авиарежим выключен, Wi-Fi включён. UIAutomator на этом системном образе иногда
  даёт timeout: повторные карточки дополнительно проверены свежими скриншотами
  с ожиданием окончания анимации. Физическое Android-устройство исключено из
  прогона по выбору пользователя.

### 2026-10-13

Локально прошли `npm run lint`, `npm run typecheck` и `npm run test:unit` —
119 наборов / 593 теста. Добавлены проверки ИИ-рекомендаций и безопасного
запроса, маршрута и его маркеров, отмены устаревшего анализа при взятии заказа,
состояния без подходящих заказов, настроек `map_hints`/`ai_recommend` и передачи
флага пробок в нативную карту. Эмуляторы и новая нативная сборка не запускались.

### 2026-10-01

Локально повторно прошли `npm run lint`, `npm run typecheck` и
`npm run test:unit` — 103 набора / 424 теста. Это не подтверждает нативную
сборку или ручные сценарии на Android/iOS. Проверка 29.09.2026 дала
100 наборов / 408 тестов.

### 2026-09-21

Сделано:

- включён глобальный индикатор отсутствия интернета;
- NetInfo сообщает об изменении сразу и принудительно обновляется каждые 15 секунд;
- плашка занимает отдельную строку под навигационной шапкой и не перекрывает её;
- плашка автоматически скрывается после восстановления соединения и не
  перехватывает нажатия;
- холодный запуск и успешная авторизация дожидаются загрузки настроек кафе до
  перехода к списку, чтобы первый запрос заказов сразу использовал `point_id`;
- заказы, настройки и телефоны сохраняются в AsyncStorage и восстанавливаются при
  холодном запуске без сети; кэш изолирован по пользователю/кафе/типу и очищается
  при выходе, Bearer-токен в него не записывается;
- добавлены системная, светлая и тёмная темы с локальным сохранением выбора;
- тема интерфейса отделена от оформления маркеров, а Yandex Map следует
  фактической теме приложения;
- добавлены тесты выбора, восстановления, миграции темы и тёмного режима карты;
- `lint`, `typecheck`, 94 suites / 374 tests пройдены без запуска эмуляторов.

### 2026-09-08

Сделано:

- при временной потере сети заказы сохраняются в памяти раздельно по пользователю,
  кафе и типу списка, без подмены данными другого раздела;
- после первой загрузки все разделы последовательно прогреваются в фоне, а затем
  обновляются по одному раз в 45 секунд без параллельного запроса текущего раздела;
- после сетевой ошибки фоновое обновление приостанавливается до успешного обычного запроса;
- сохранённые маркеры открывают карточки заказов без дополнительного API-запроса;
- `lint`, `typecheck`, 91 suites / 357 tests пройдены без запуска эмуляторов.

### 2026-09-07

Сделано:

- iOS/Fabric crash при mount маркера с неинициализированной geometry закрыт
  воспроизводимым `patch-package`-патчем для `react-native-yamap-plus@6.11.0`;
- координаты заказов, домашней точки и курьера валидируются до передачи в MapKit;
- `lint`, `typecheck`, 90 suites / 346 tests пройдены без запуска эмуляторов.

### 2026-09-04

Сделано:

- полный мобильный baseline повторно пройден: `lint`, `typecheck`, 88 suites / 339 tests;
- тестами покрыты Laravel API, защищённый токен, CAPTCHA, SSO, выбор кафе,
  фейковое удаление demo-аккаунта и стабилизация маркера геопозиции;
- Android release APK установлен и вручную проверен на реальном Samsung;
- iOS debug/release и основные auth-сценарии проверены на Simulator;
- реальный iPhone и production-настройка Laravel CAPTCHA/SSO оставлены внешней проверкой.

### 2026-06-30

Решено:

- создать проектную документацию в `docs`;
- сфокусироваться на `lint`, `typecheck` и unit-тестах;
- не менять код приложения на этапе первичной документации;
- зафиксировать исходное красное состояние baseline честно, без маскировки;
- добавить GitHub-проверку как последний этап после зеленого локального baseline.

Сделано:

- стабилизированы unit-тесты;
- добавлены `test:unit`, `typecheck`, обновлен `test:ci`;
- исправлены TypeScript-ошибки;
- восстановлен `lint` через ESLint 9 flat config;
- явно обновлены `@typescript-eslint`/RN/hooks lint-плагины до совместимых версий;
- добавлены focused unit-тесты для settings, orders-map, feedback hook/store, GEOStore, auth flow, auth/reset hooks, schedule hooks, orders-list hooks, updater hooks, stat store и global store;
- добавлен GitHub Actions workflow `CI Baseline`;
- локальный baseline проходит зеленым.

## Связанные документы

- [docs/quality-baseline.md](../quality-baseline.md)
- [docs/testing/README.md](./README.md)
- [docs/testing/unit-testing-rules.md](./unit-testing-rules.md)
- [docs/testing/git-checks.md](./git-checks.md)
- [docs/testing/release-checklist.md](./release-checklist.md)
