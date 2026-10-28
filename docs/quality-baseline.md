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

## Текущий baseline

Актуальный стек — RN `0.88.0`, React `19.3.1`, TypeScript `6.0.3` и ESLint 10.
Число наборов/тестов, результаты последнего прогона, нативных сборок и ручных
проверок фиксируются только в [журнале тестирования](./testing/testing-progress.md).
Датированные записи этого журнала не являются проверкой более новой сборки.

### `lint`

Текущая команда:

```bash
npm run lint
```

Фактический результат:

- команда проходит успешно;
- проект использует flat config [eslint.config.js](../eslint.config.js);
- старый [.eslintrc.js](../.eslintrc.js) оставлен как исторический файл, но ESLint 10 берет `eslint.config.js`;
- `@typescript-eslint`, `eslint-plugin-react-hooks` и `eslint-plugin-react-native` закреплены явными dev-зависимостями; единый TypeScript 6.0.3 используется и как `tsc`, и как compiler API для `typescript-eslint`;
- текущий lint baseline проверяет парсинг и базовые правила; для TS/TSX
  `react-hooks/rules-of-hooks` включён как `error`, а `react-hooks/exhaustive-deps`
  — как `warn`. Строгий набор React Native-правил не включён;
- команда `eslint .` не задаёт `--max-warnings=0`: предупреждение о зависимостях
  хука само по себе не делает baseline красным.

Вывод:

- `lint` восстановлен как рабочий gate;
- проверенная прямая установка TypeScript 7 ломает `typescript-eslint`; итоговый TypeScript 6.0.3 входит в его поддерживаемый диапазон `<6.1.0`;
- усиление остальных правил и перевод предупреждений в ошибки стоит делать
  отдельной задачей, чтобы не смешивать baseline и большую lint-чистку.

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

Команда использует `--runInBand --watchman=false`. Свежий результат полного
набора и отсутствие/наличие пропущенных тестов смотрите в
[журнале тестирования](./testing/testing-progress.md), а не в исторических
числах прежних волн.

В этот baseline входят unit/component-тесты, включая синхронизацию офлайн-регионов MapKit. Detox и запуск эмуляторов в него не входят; нативные сборки и ручные проверки ведутся отдельно.

Причина `--watchman=false`:

- обычный запуск может падать на Watchman-правах в локальной среде.

Исторические исправления при первоначальной стабилизации:

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

Важно: действующие hooks-правила и их уровни перечислены выше. Остальные
React Native / React Hooks strict rules усиливаются отдельной задачей.

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
- Node.js: `>=24.12.0 <25` (Firebase 27)
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
- полный строгий набор RN/hooks lint-правил (два действующих hooks-правила
  и их уровни описаны выше);
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
