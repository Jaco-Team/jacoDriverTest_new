# Статус тестирования и baseline

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

- текущий config минимальный;
- строгие RN/hooks правила нужно усиливать отдельной задачей, чтобы не смешивать baseline и большую lint-чистку.

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
