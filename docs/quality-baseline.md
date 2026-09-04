# Quality baseline

## Цель документа

Этот документ фиксирует обязательный baseline качества проекта:

- `lint`;
- `typecheck`;
- unit-тесты.

Baseline нужен, чтобы перед заливкой и при проверке PR всегда проходили одни и те же быстрые проверки.

## Короткий вывод

Проект имеет зеленый локальный baseline:

- `npm run lint`;
- `npm run typecheck`;
- `npm run test:unit`.

Также добавлен GitHub Actions workflow:

- [.github/workflows/ci-baseline.yml](../.github/workflows/ci-baseline.yml)

## Текущий статус на 2026-09-04

### `lint`

Текущая команда:

```bash
npm run lint
```

Фактический результат:

- команда проходит успешно;
- проект использует flat config [eslint.config.js](../eslint.config.js);
- старый [.eslintrc.js](../.eslintrc.js) оставлен как исторический файл, но ESLint 10 берет `eslint.config.js`;
- `@typescript-eslint`, `eslint-plugin-react-hooks` и `eslint-plugin-react-native` закреплены явными dev-зависимостями с поддержкой ESLint 10 / TypeScript 5.9;
- текущий lint baseline минимальный: он проверяет парсинг и базовые правила, но строгие RN/hooks правила пока не включены как обязательный gate.

Вывод:

- `lint` восстановлен как рабочий gate;
- warning про неподдерживаемую версию TypeScript для `@typescript-eslint/typescript-estree` снят обновлением `@typescript-eslint` до 8.x;
- усиление правил стоит делать отдельной задачей, чтобы не смешивать baseline и большую чистку lint-замечаний.

### `typecheck`

Фактическая команда:

```bash
npm run typecheck
```

Текущий результат:

- команда проходит успешно.

Что было исправлено:

- лишние `@ts-expect-error` в [src/components/ui/table/index.tsx](../src/components/ui/table/index.tsx);
- неправильная типизация `mediaType` для `react-native-image-picker` в [src/features/feedback/model/useCreateFeedbackModal.ts](../src/features/feedback/model/useCreateFeedbackModal.ts);
- некорректное числовое приведение настроек в [src/features/settings/model/useSettingsLogic.ts](../src/features/settings/model/useSettingsLogic.ts);
- похожие ошибки приведения в [src/shared/store/store.ts](../src/shared/store/store.ts).
- добавлены focused unit-тесты для settings parsing/save flow, settings store `getSettings`, settings store `saveSettings`, orders-map filters/getOrders, feedback image picker/form flow, feedback store api flow, GEOStore permissions/location flow, auth/token flow, auth/reset hooks, schedule hooks, orders-list hooks, updater hooks, stat store api flow и global store helpers.

Вывод:

- `typecheck` готов как обязательная проверка.

### Unit-тесты

Текущая команда:

```bash
npm run test:unit
```

Текущий результат:

- `88` test suites passed;
- `339` tests passed;
- `0` snapshots;
- команда использует `--runInBand --watchman=false`.

Причина `--watchman=false`:

- обычный запуск может падать на Watchman-правах в локальной среде.

Что было исправлено:

- `jest.setSystemTime(new Date(...))` заменен на timestamp в миллисекундах в тестах статистики.
- добавлены тесты:
  - [__tests__/useSettingsLogic.settings.test.tsx](../__tests__/useSettingsLogic.settings.test.tsx);
  - [__tests__/settings-store.getSettings.test.ts](../__tests__/settings-store.getSettings.test.ts);
  - [__tests__/settings-store.saveSettings.test.ts](../__tests__/settings-store.saveSettings.test.ts);
  - [__tests__/orders-map.filters-fetch.test.ts](../__tests__/orders-map.filters-fetch.test.ts);
  - [__tests__/useCreateFeedbackModal.test.tsx](../__tests__/useCreateFeedbackModal.test.tsx);
  - [__tests__/feedback-store.api-flow.test.ts](../__tests__/feedback-store.api-flow.test.ts);
  - [__tests__/global-store.state.test.ts](../__tests__/global-store.state.test.ts);
  - [__tests__/geo-store.location.test.ts](../__tests__/geo-store.location.test.ts);
  - [__tests__/auth-reset-hooks.test.tsx](../__tests__/auth-reset-hooks.test.tsx);
  - [__tests__/schedule-hooks.test.tsx](../__tests__/schedule-hooks.test.tsx);
  - [__tests__/orders-list-hooks.test.tsx](../__tests__/orders-list-hooks.test.tsx);
  - [__tests__/updater-hooks.test.tsx](../__tests__/updater-hooks.test.tsx);
  - [__tests__/login-store.auth.test.ts](../__tests__/login-store.auth.test.ts);
  - [__tests__/stat-store.api-flow.test.ts](../__tests__/stat-store.api-flow.test.ts);
  - [__tests__/laravel-api-routing.test.ts](../__tests__/laravel-api-routing.test.ts);
  - [__tests__/laravel-api-errors.test.ts](../__tests__/laravel-api-errors.test.ts);
  - [__tests__/laravel-auth-api.test.ts](../__tests__/laravel-auth-api.test.ts);
  - [__tests__/laravel-auth-token-storage.test.ts](../__tests__/laravel-auth-token-storage.test.ts);
  - [__tests__/sso-callback.test.ts](../__tests__/sso-callback.test.ts);
  - [__tests__/ui.auth-smart-captcha.test.tsx](../__tests__/ui.auth-smart-captcha.test.tsx).

## Обязательный локальный baseline

Перед заливкой нужно запускать:

```bash
npm run lint
npm run typecheck
npm run test:unit
```

## Что было сделано

### Этап 1. Стабилизировать unit-тесты

Готово: `npm run test:unit` проходит зеленым.

### Этап 2. Добавить явный unit-скрипт

Готово:

```json
"test:unit": "jest --runInBand --watchman=false"
```

### Этап 3. Сделать `typecheck` зеленым

Готово:

```json
"typecheck": "tsc --noEmit"
```

### Этап 4. Оживить ESLint

Готово:

- добавлен [eslint.config.js](../eslint.config.js) под ESLint 10;
- явно добавлены современные lint dev-зависимости:
  - `@eslint/js`;
  - `@typescript-eslint/parser`;
  - `@typescript-eslint/eslint-plugin`;
  - `typescript-eslint`;
  - `eslint-plugin-react-hooks`;
  - `eslint-plugin-react-native`.

Важно: текущий config намеренно минимальный. React Native / React Hooks strict rules можно усиливать отдельной задачей после зеленого baseline.

### Этап 5. Сделать baseline обязательным

Готово. Минимальный набор:

```bash
npm run lint
npm run typecheck
npm run test:unit
```

### Этап 6. Добавить проверку при заливке в Git

Готово: добавлен workflow [.github/workflows/ci-baseline.yml](../.github/workflows/ci-baseline.yml).

Он запускается:

- на `pull_request`;
- на `push` в `main` и `new_architecture`.

Параметры:

- name: `CI Baseline`
- job name: `lint-typecheck-unit`
- Node.js: `24`
- install: `npm ci`
- checks:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:unit -- --ci`

Подробная инструкция:

- [docs/testing/git-checks.md](./testing/git-checks.md)

## Что не закрыто этим baseline

Текущий baseline не включает:

- e2e;
- iOS/Android native build;
- запуск на simulator/emulator;
- строгий набор RN/hooks lint-правил;
- branch protection в настройках GitHub.

## Следующий организационный шаг

После первого зеленого PR нужно включить branch protection и сделать `CI Baseline / lint-typecheck-unit` обязательным check.

## Связанные документы

- [docs/project-overview.md](./project-overview.md)
- [docs/project-rules.md](./project-rules.md)
- [docs/testing/README.md](./testing/README.md)
- [docs/testing/unit-testing-rules.md](./testing/unit-testing-rules.md)
- [docs/testing/git-checks.md](./testing/git-checks.md)
- [docs/testing/testing-progress.md](./testing/testing-progress.md)
