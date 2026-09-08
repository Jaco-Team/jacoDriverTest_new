# Статус тестирования и baseline

## Дата фиксации

2026-09-07

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

- `91` suites passed;
- `357` tests passed;
- всего `91` suites и `357` tests.

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
