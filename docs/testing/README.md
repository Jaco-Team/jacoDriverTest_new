# Документация по тестированию

Этот раздел нужен как единое место, где зафиксированы:

- текущий статус тестов;
- правила unit-тестирования;
- текущий quality baseline;
- релизный чеклист.

Сейчас основной baseline проекта - `lint`, `typecheck` и unit-тесты.

## Структура раздела

### [docs/testing/unit-testing-rules.md](./unit-testing-rules.md)

Правила написания и поддержки unit/component-level тестов.

Нужны для:

- стабильных тестов без реального backend;
- аккуратной работы с fake timers;
- понимания, какие сценарии обязательно покрывать.

### [docs/testing/git-checks.md](./git-checks.md)

Проверка при заливке в Git.

Нужен для:

- GitHub Actions workflow;
- проверки на `pull_request` и `push`;
- настройки branch protection и required status checks.

### [docs/testing/testing-progress.md](./testing-progress.md)

Текущий статус внедрения quality baseline.

Нужен для:

- фиксации текущего состояния baseline;
- контроля ближайших шагов;
- понимания, что уже проверено.

### [docs/testing/release-checklist.md](./release-checklist.md)

Чеклист перед релизом.

Нужен для:

- повторяемой проверки;
- контроля критичных сценариев;
- разделения автоматических и ручных проверок.

## Текущие команды

### Unit-тесты

Базовая команда:

```bash
npm test
```

Стабильная локальная команда:

```bash
npm run test:unit
```

### TypeScript

```bash
npm run typecheck
```

### ESLint

Текущая команда:

```bash
npm run lint
```

На 2026-09-04 команда проходит через [eslint.config.js](../../eslint.config.js) под ESLint 10. Подробности:

- [docs/quality-baseline.md](../quality-baseline.md)

## Что сейчас считается unit-тестами

Текущие тесты лежат в:

- [__tests__](../../__tests__)

Они покрывают:

- действия с заказом;
- ветки GPS;
- модалки подтверждения;
- аналитику;
- UI-условия карточки заказа;
- fake API guards;
- группировку заказов на карте;
- статистику;
- updater-интервалы.
- Laravel API transport/routes/errors и DTO adapters;
- Bearer-токен в Keychain/Keystore;
- SSO callback/exchange и SmartCaptcha;
- выбор кафе, backend-флаг статистики и фейковое удаление demo-аккаунта;
- стабильность маркера геопозиции Android/Fabric.

Текущий результат: 88 suites / 339 tests. Нативные release-проверки ведутся
отдельно в [release checklist](./release-checklist.md).

## Текущий обязательный baseline

```bash
npm run lint
npm run typecheck
npm run test:unit
```

## Связанные документы

- [docs/quality-baseline.md](../quality-baseline.md)
- [docs/testing/unit-testing-rules.md](./unit-testing-rules.md)
- [docs/testing/git-checks.md](./git-checks.md)
- [docs/testing/testing-progress.md](./testing-progress.md)
- [docs/testing/release-checklist.md](./release-checklist.md)
