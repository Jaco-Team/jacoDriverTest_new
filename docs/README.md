# Документация проекта

Эта папка нужна как единое место для рабочей документации по `jacoDriverTest`.

Актуальный статус на 04.09.2026: RN `0.87.1` / Fabric, UI и мобильный переход
на Laravel API реализованы; локальный baseline — 88 suites / 339 tests. Android
release проверен на реальном Samsung, iOS — на Simulator. Открыты production-
развёртывание mobile CAPTCHA/SSO ответственным за сервер, реальный iPhone, решение
по QR-оплате и тема после появления готового эталона на сайте.

Сюда входят:

- общий обзор проекта;
- правила безопасной разработки;
- текущий quality baseline по `lint`, `typecheck` и unit-тестам;
- документация по тестированию;
- контрольные материалы для релизной проверки.

## Текущая структура

### Общие документы

[docs/project-overview.md](./project-overview.md)

Общая карта проекта:

- что это за приложение;
- какой стек используется;
- как устроены основные слои;
- где лежит критичная бизнес-логика;
- какие зоны требуют повышенной осторожности.

[docs/project-rules.md](./project-rules.md)

Рабочие правила для изменений:

- как менять проект локально и безопасно;
- какие зоны считать рискованными;
- что обязательно проверять после изменений;
- как не увеличивать хаос в архитектуре и стиле.

[docs/quality-baseline.md](./quality-baseline.md)

Текущий план приведения проекта к обязательному baseline:

- `lint`;
- `typecheck`;
- `unit`-тесты;
- порядок стабилизации;
- что считать готовым состоянием.

[docs/new-architecture-migration-plan.md](./new-architecture-migration-plan.md)

План переезда курьерского приложения на RN `0.87` и New Architecture / Fabric:

- ветка `new_architecture`;
- целевой стек;
- этапы и текущий статус;
- курьерские риски;
- чеклист для Битрикс;
- что не входит в эту миграцию;
- оркестратор ролей Cursor в `.cursor/rules`.

[docs/driver-site-ui-migration-plan.md](./driver-site-ui-migration-plan.md)

План поэтапного переноса UI курьерского сайта в React Native-приложение:

- эталонный проект и его текущая ветка;
- порядок экранов;
- визуальные и функциональные границы;
- известные UI-недоработки;
- критерии проверки Android и iOS.

[docs/laravel-api-mobile-migration-plan.md](./laravel-api-mobile-migration-plan.md)

План переключения React Native-приложения с legacy API на готовый Laravel API:

- правила сохранения работоспособности сайта `jaco_driver_site/api-laravel`;
- локальный запуск backend и сайта;
- порядок переноса endpoint по модулям;
- Bearer auth, secure storage, SSO и CAPTCHA;
- фейковое удаление тестового аккаунта.

### Раздел тестирования

[docs/testing/README.md](./testing/README.md)

Отдельный раздел по тестированию.

Внутри него:

- [docs/testing/README.md](./testing/README.md)
- [docs/testing/unit-testing-rules.md](./testing/unit-testing-rules.md)
- [docs/testing/git-checks.md](./testing/git-checks.md)
- [docs/testing/testing-progress.md](./testing/testing-progress.md)
- [docs/testing/release-checklist.md](./testing/release-checklist.md)

## Как этим пользоваться

1. Для общего входа в проект смотреть [docs/project-overview.md](./project-overview.md).
2. Перед изменениями смотреть [docs/project-rules.md](./project-rules.md).
3. Для работ по `lint`, `typecheck` и unit-тестам смотреть [docs/quality-baseline.md](./quality-baseline.md).
4. Для правил unit-тестов смотреть [docs/testing/unit-testing-rules.md](./testing/unit-testing-rules.md).
5. Для проверки при заливке в Git смотреть [docs/testing/git-checks.md](./testing/git-checks.md).
6. Для текущего статуса смотреть [docs/testing/testing-progress.md](./testing/testing-progress.md).
7. Перед релизом проходить [docs/testing/release-checklist.md](./testing/release-checklist.md).
8. Для переезда на New Architecture смотреть [docs/new-architecture-migration-plan.md](./new-architecture-migration-plan.md).
9. Для переноса UI курьерского сайта смотреть [docs/driver-site-ui-migration-plan.md](./driver-site-ui-migration-plan.md).
10. Для подключения приложения к Laravel API смотреть [docs/laravel-api-mobile-migration-plan.md](./laravel-api-mobile-migration-plan.md).

## Правило оформления ссылок

Внутри проектной документации ссылки на файлы должны оформляться как явные Markdown-ссылки с относительным путем от текущего документа.

Правильно:

- [docs/project-overview.md](./project-overview.md)

Неправильно:

- `docs/project-overview.md`

Если нужно сослаться на раздел, который лежит в папке, лучше ссылаться на `README.md` внутри этой папки.

Пример:

- [docs/testing/README.md](./testing/README.md)
