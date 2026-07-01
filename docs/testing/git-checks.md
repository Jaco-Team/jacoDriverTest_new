# Проверка при заливке в Git

## Цель документа

Этот документ описывает автоматическую проверку при заливке в Git.

Идея такая:

- локально `lint`, `typecheck` и unit-тесты зеленые;
- репозиторий имеет GitHub Actions workflow;
- workflow запускается на `pull_request` и `push`;
- branch protection не дает слить изменения, если baseline красный.

## Почему это последний этап

Git-проверку нельзя включать первой.

Сначала нужно:

1. сделать unit-тесты зелеными;
2. добавить стабильный `test:unit`;
3. сделать `typecheck` зеленым;
4. восстановить `lint`;
5. убедиться, что все три команды повторяемо проходят локально.

Этот порядок уже выполнен для текущего baseline.

## Целевая локальная проверка перед push

Перед заливкой разработчик должен иметь возможность локально выполнить:

```bash
npm run lint
npm run typecheck
npm run test:unit
```

Если локально красно, в Git заливать нельзя, пока причина не понятна.

## Целевой GitHub Actions workflow

По примеру соседнего проекта добавлен workflow:

- файл: [.github/workflows/ci-baseline.yml](../../.github/workflows/ci-baseline.yml);
- name: `CI Baseline`;
- запуск: на каждый `pull_request`;
- запуск: на `push` в `main`;
- job name: `lint-typecheck-unit`;
- Node.js: `20`;
- установка зависимостей: `npm ci`;
- проверки:
  - `npm run lint`;
  - `npm run typecheck`;
  - `npm run test:unit -- --ci`.

Пример целевого workflow:

```yaml
name: CI Baseline

on:
  pull_request:
  push:
    branches:
      - main

concurrency:
  group: ci-baseline-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  baseline:
    name: lint-typecheck-unit
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck

      - name: Unit tests
        run: npm run test:unit -- --ci
```

Важно: если основной рабочей веткой проекта станет другая ветка, в workflow нужно заменить `main`.

## Branch protection

Чтобы workflow был настоящей защитой, а не просто отчетом, нужно включить branch protection в GitHub.

Настройка:

1. `Settings` репозитория.
2. `Branches`.
3. Rule для основной рабочей ветки.
4. Включить `Require status checks to pass before merging`.
5. Добавить required check: `CI Baseline / lint-typecheck-unit`.

После этого merge будет разрешен только при зеленом baseline.

## Как проверять, что Git-gate работает

Проверка внедрения:

1. Создать PR.
2. Убедиться, что стартует workflow `CI Baseline`.
3. Убедиться, что job `lint-typecheck-unit` проходит зеленым.
4. После включения branch protection убедиться, что красный check блокирует merge.

## Что не включать в первый CI baseline

На первом этапе не нужно добавлять:

- iOS build;
- Android build;
- e2e;
- реальные device/simulator проверки;
- публикацию артефактов;
- релизные сборки.

Первый CI baseline должен быть коротким и надежным:

- `lint`;
- `typecheck`;
- `unit`.

## Связанные документы

- [docs/quality-baseline.md](../quality-baseline.md)
- [docs/testing/README.md](./README.md)
- [docs/testing/testing-progress.md](./testing-progress.md)
- [docs/testing/release-checklist.md](./release-checklist.md)
