# План подключения мобильного приложения к Laravel API

Дата обновления: 04.09.2026.

Статус: `мобильный код реализован и локально проверен; production-развёртывание и финальная внешняя проверка не выполнены`.

Текущий прогресс на 04.09.2026: мобильный production-код переключён на Laravel API.
Старый API, form-urlencoded transport, legacy-токен и отдельный старый upload
изображений удалены. Авторизация использует один Bearer-токен из Keychain; настройки,
кафе, заказы, геопозиция, график, расчёт, статистика и обратная связь работают через
готовые `/api/v1` endpoints. Для SmartCaptcha добавлены только изолированная
mobile WebView-страница и отдельный GET-маршрут без изменения существующих API;
сайт при переключении и интеграции CAPTCHA не изменялся. Подготовленные изменения
`laravel-api-driver` для mobile CAPTCHA/SSO пока находятся локально и должны быть
развёрнуты в production ответственным за сервер.

Сводка по рабочему чек-листу на 04.09.2026:

- [x] разработан план подключения к новому backend;
- [x] Laravel API запущен и проверен локально;
- [x] приложение переведено со старого API на Laravel API;
- [x] SSO, CAPTCHA и функции нового backend реализованы и проверены локально;
- [x] фейковое удаление demo-аккаунта реализовано и проверено;
- [x] мобильные тесты и release-проверка Android/iOS Simulator выполнены;
- [ ] проверить release на обоих реальных устройствах:
  - [x] Android — Samsung;
  - [ ] iPhone — выполняет руководитель.

Таким образом, по пользовательскому чек-листу выполнено 6 из 7 пунктов. Оставшийся
пункт закрывается после проверки release на реальном iPhone. Production-деплой
Laravel и инфраструктурная настройка CAPTCHA/SSO не входят в задачи мобильного
разработчика, но без них эти сценарии в опубликованном release не заработают полностью.

## 1. Что именно требуется сделать

`laravel-api-driver` уже является готовым backend на Laravel 13. Переносить старый
backend «на Laravel» в рамках этой задачи не требуется. Требуется перевести
React Native-приложение с legacy API `api2.jacochef.ru/driver/public/index.php`
на REST API проекта `laravel-api-driver`.

Источники истины:

- backend: `/Users/denis/Public/work/laravel-api-driver`, ветка `main`;
- web-клиент: `/Users/denis/Public/work/jaco_driver_site`, ветка `api-laravel`;
- production-сайт: `https://driver.jacochef.ru`;
- production API: `https://apidriver.jacochef.ru`;
- мобильный клиент: текущий проект `jacoDriverTest_new`.

На 02.09.2026 подтверждено:

- `GET https://apidriver.jacochef.ru/api/v1/health` отвечает `200` и
  `{"status":"ok","service":"Laravel API","version":"v1"}`;
- `https://driver.jacochef.ru` доступен и перенаправляет на `/list_orders`;
- сайт ветки `api-laravel` уже содержит именованные маршруты и API-адаптеры для
  нового Laravel API;
- мобильное приложение больше не отправляет запросы в legacy API и не передаёт
  токен внутри payload.

## 2. Ограничения и правила безопасности

- Backend не переписывать и не рефакторить без подтверждённой необходимости.
- Сначала адаптировать мобильный frontend под существующий контракт Laravel API.
- Если контракт отсутствует или содержит подтверждённую ошибку, менять endpoint
  только минимально и обратно совместимо.
- Любое изменение endpoint должно сохранять работоспособность сайта
  `jaco_driver_site/api-laravel` и сопровождаться backend-тестом и проверкой сайта.
- Не менять одновременно контракт backend и UI мобильного экрана.
- Не выполнять двойную запись одновременно в Laravel и legacy API.
- Для изменяющих данные операций запрещён автоматический fallback в legacy API:
  повторный запрос может дважды взять, отменить или завершить заказ.
- Реальные токены, пароли и доступы к БД не коммитить и не выводить в логи.

## 3. Локальный запуск Laravel API

В текущей локальной копии `.env` уже существует, подключения `main` и `system`
заполнены, а демо-режим включён. Повторно копировать `.env.example` поверх `.env`
нельзя.

На текущем Mac установлен PHP 8.2, а проект требует PHP `^8.4`. Поэтому первый
`composer install` нужно выполнять внутри Docker, либо сначала установить локальный
PHP 8.4/8.5. Рекомендуемый Docker-вариант:

```bash
cd /Users/denis/Public/work/laravel-api-driver

# Сначала запустить Docker Desktop.

# Первый запуск, если папки vendor ещё нет:
docker compose -f compose.yaml run --rm --no-deps laravel.test composer install

# Запуск API:
docker compose -f compose.yaml up -d laravel.test

# Однократно для нового .env:
docker compose -f compose.yaml exec laravel.test php artisan key:generate

# Миграции выполняются только в служебной system-БД:
docker compose -f compose.yaml exec laravel.test php artisan migrate --database=system

# Проверка:
curl http://localhost:8080/api/v1/health
docker compose -f compose.yaml exec laravel.test php artisan route:list
docker compose -f compose.yaml exec laravel.test php artisan test
```

Ежедневные команды:

```bash
cd /Users/denis/Public/work/laravel-api-driver
docker compose -f compose.yaml up -d
docker compose -f compose.yaml ps
docker compose -f compose.yaml logs -f laravel.test
docker compose -f compose.yaml down
```

Если нужна локальная web-проверка тем же контрактом:

```bash
cd /Users/denis/Public/work/jaco_driver_site
git switch api-laravel
npm ci
npm run dev
```

Сайт откроется на `http://localhost:3225`, а `.env.development` уже направляет
его на `http://localhost:8080`.

Проверка production-сборки сайта:

```bash
cd /Users/denis/Public/work/jaco_driver_site
npm run build
PORT=3225 npm run start
```

Адрес Laravel API для мобильного клиента выбирается по типу сборки:

- Debug: `http://localhost:8080`;
- Release: `https://apidriver.jacochef.ru`.

На Android перед Debug-проверкой выполнить `adb reverse tcp:8080 tcp:8080`, чтобы
`localhost:8080` устройства был направлен в локальный Laravel на Mac. iOS Simulator
доступен по этому адресу напрямую. Такой единый hostname также соответствует
локальной конфигурации SmartCaptcha.

Android уже разрешает cleartext для локальной разработки, а iOS разрешает
локальную сеть. Production всегда должен использовать HTTPS.

## 4. Карта существующих Laravel endpoints

| Модуль | Laravel endpoints | Что заменяет в приложении |
| --- | --- | --- |
| Авторизация | `POST /api/v1/auth/token/login`, `GET /api/v1/auth/me`, `GET /api/v1/auth/session/meta`, `POST /api/v1/auth/logout` | legacy `auth: login/check_token` и локальный logout |
| Восстановление | `POST /api/v1/auth/password/recovery/send-code`, `POST /api/v1/auth/password/recovery/confirm-code` | legacy `get_sms/check_code` |
| Настройки | `GET /api/v1/settings/get`, `GET /api/v1/settings/points`, `POST /api/v1/settings/save`, `avg-time`, `get_point_phones`, `save-position` | legacy-модуль `settings` и часть `orders` |
| Заказы | `get_orders`, `action_order`, `check_fake_order`, `hide_del_orders`, `get_pay_qr`, `check_pay_order` | legacy-модуль `orders` |
| График | `POST /api/v1/graph`, `order-appeals`, `camera-appeals` | legacy-модуль `graph` |
| Расчёт и статистика | `POST /api/v1/price/between`, `POST /api/v1/statistics/show-data` | legacy `price` и `stat_time` |
| Обратная связь | `GET /api/v1/feedback/get_feedbacks`, `POST /api/v1/feedback/save_feedbacks` | legacy `feedback` и отдельный legacy upload изображений |

При реализации поля запросов и ответов сверять не по памяти, а по текущим файлам
`jaco_driver_site/entities/*/api`, `jaco_driver_site/features/auth/api` и DTO/Request
классам `laravel-api-driver`.

## 5. Этапы переноса мобильного клиента

### Этап 0. Зафиксировать baseline

Исторический baseline до начала миграции был записан не полностью, поэтому
неотмеченные пункты ниже нельзя задним числом считать выполненными. Текущее состояние
приложения проверено отдельно в этапах 6–8.

- [ ] Зафиксировать текущие commit SHA backend `main` и сайта `api-laravel`.
- [ ] Запустить backend-тесты до изменений.
- [ ] Запустить `lint`, `typecheck`, тесты и production build сайта до изменений.
- [x] Зафиксировать успешные ответы health, demo login и `/auth/me`; основные
  пользовательские сценарии дополнительно прошли ручной smoke.
- [x] Не менять сайт одновременно с первым переключением мобильного клиента:
  ветка `jaco_driver_site/api-laravel` осталась без изменений.

### Этап 1. Новый транспорт и конфигурация API

- [x] Добавить единый конфиг origin без URL в store: Debug использует
  `http://localhost:8080`, Release — `https://apidriver.jacochef.ru`.
- [x] Добавить отдельный Axios-клиент и именованные Laravel routes.
- [x] Передавать токен только через `Authorization: Bearer <token>`.
- [x] Нормализовать `401`, `403`, `422`, `429`, timeout и отсутствие сети.
- [x] Не отправлять query-string и токен в payload; служебный `type` оставлять
  только в тех mutation payload, где его требует Laravel Request-контракт.
- [x] Покрыть auth transport, auth routes и обработку ошибок unit-тестами.

### Этап 2. Авторизация и безопасная сессия

- [x] Перевести вход на `/auth/token/login` с `login`, `password`, `device_name`
  и при необходимости `captcha_token`.
- [x] После входа получать пользователя через `/auth/me`.
- [x] Заменить проверку Laravel-сессии через legacy `check_token` на `/auth/me`.
- [x] Перевести logout на backend `/auth/logout`, затем всегда очищать локальную
  сессию, даже если сеть недоступна.
- [x] Хранить Laravel access token в `react-native-keychain`.
- [x] Не сохранять логин и пароль в приложении: повторный вход выполняется через
  сохранённую SSO-сессию, локально хранится только access token.
- [x] Перевести восстановление пароля на `send-code/confirm-code` и шестизначный код.
- [x] Реализовать реальную SmartCaptcha по `captcha_required`.
- [x] Удалить временные `[AUTH-RECOVERY]` dev-логи после стабилизации.
- [x] SSO выполнить отдельным подпунктом через system auth session, deep link и
  `/api/v1/auth/sso/exchange`; не копировать web redirect напрямую в WebView.

### Этап 3. Настройки и выбор кафе

- [x] Получать настройки и доступные кафе через `/settings/get` (`all_points`).
- [x] Хранить выбранный `point_id` локально для сессий пользователя.
- [x] Передавать `point_id` во все endpoints, где его поддерживает сайт.
- [x] Загружать телефоны выбранной точки через `/settings/get_point_phones`.
- [x] Перевести среднее время и отправку геопозиции на `avg-time/save-position`.
- [x] Сохранять настройки через `/settings/save`.
- [x] Использовать backend-флаг доступа к статистике без dev-открытия.

### Этап 4. Read-only бизнес-данные

- [x] Перевести получение заказов и удалённых заказов.
- [x] Перевести график, расчёт и статистику.
- [x] Перевести список обратной связи и загрузку изображений.

### Этап 5. Изменяющие данные операции

- [x] Перевести «Взять», «Отменить», «Завершить» и «Клиент не вышел на связь».
- [x] Перевести скрытие просмотренных отменённых заказов.
- [x] Перевести обжалования ошибок заказа и камеры.
- [x] Перевести создание обращения с multipart-изображениями.
- [ ] По QR-оплате получить решение руководителя: подключить готовые endpoints
  `get_pay_qr/check_pay_order` либо временно скрыть кнопку.

### Этап 6. SSO, CAPTCHA и сохранение входа

Статус 04.09.2026: SmartCaptcha подключена через изолированную WebView-страницу
Laravel. При входе она показывается только после `captcha_required`, а при
восстановлении обязательна перед отправкой кода. SSO открывается через системную
auth-сессию: Laravel выполняет Authorization Code + PKCE на сервере, возвращает
приложению одноразовый `login_code` по фиксированному deep link, после чего
приложение обменивает код на Bearer-токен. Вход через SSO вручную подтверждён
владельцем проекта на iOS Simulator и Android Emulator. На реальном Samsung release
SSO закономерно остаётся web-сценарием до production-развёртывания server-side
mobile callback.

- [x] Оставить OIDC-клиент и PKCE на Laravel, не встраивать client secret в приложение.
- [x] Согласовать и зарегистрировать `jacodriver://auth/sso` для Android и iOS.
- [x] Реализовать системную auth-сессию и возврат через deep link.
- [x] Обменять одноразовый `login_code` через `/api/v1/auth/sso/exchange`.
- [x] Проверить SSO на iOS Simulator и Android Emulator.
- [x] Реализовать CAPTCHA при входе и восстановлении пароля.

## 6. Фейковое удаление тестового аккаунта

Тестовый аккаунт:

- login: `79990000001`;
- password: `DemoDriver1!`;
- backend demo mode: `DRIVER_DEMO_ENABLED=true` и
  `DRIVER_DEMO_LOGIN=79990000001`.

В Laravel API сейчас нет endpoint удаления аккаунта. По требованию руководителя
удаление для тестового аккаунта должно быть только имитацией и не должно удалять
строки из `main.users`, настройки, заказы или доступы.

Чек-лист реализации:

- [x] Показывать кнопку «Удалить аккаунт» только если `/auth/me` вернул demo login
  `79990000001`.
- [x] Разместить кнопку внизу страницы «Настройки» отдельной опасной зоной.
- [x] По нажатию открывать подтверждение с явным предупреждением.
- [x] На подтверждении показать loading и имитировать успешное завершение.
- [x] Допустимо вызвать обычный `/auth/logout`, но запрещено вызывать DELETE,
  менять пользователя или добавлять backend-удаление.
- [x] После подтверждения очистить access token и локальную сессию, перейти на Auth
  и показать сообщение «Аккаунт удалён».
- [x] Повторный вход демо-данными должен продолжать работать.
- [x] Для всех остальных пользователей кнопку не показывать.
- [x] Добавить тесты видимости, отмены, подтверждения, очистки сессии и отсутствия
  любого destructive HTTP-запроса.

## 7. Открытые решения до завершения

- [ ] QR-оплата: подключать сейчас или скрыть до отдельного согласования.
- [ ] Тёмная тема приложения.
- [ ] Развернуть подготовленные mobile CAPTCHA/SSO-изменения Laravel API ответственным
  за production; до этого release SSO открывает существующий web-сценарий без возврата
  в приложение.
- [ ] Финальный release smoke на реальном iPhone выполняет руководитель.

Не входят в текущую мобильную сдачу: сохранение логина/пароля (осознанно исключено;
приложение хранит только Bearer-токен), production-деплой backend и настройка
инфраструктуры.

## 8. Definition of Done

Миграция считается завершённой, когда:

- в мобильном production-коде нет запросов к `api2.jacochef.ru` и legacy upload;
- все запросы используют именованные Laravel routes и Bearer token;
- токен хранится в защищённом хранилище;
- авторизация, настройки, кафе, заказы, карта, график, расчёт, статистика и обратная
  связь работают через Laravel API;
- фейковое удаление demo account работает без изменения backend-данных;
- мобильное приложение проходит `lint`, `typecheck` и полный набор unit/integration-тестов;
- Android release smoke завершён на реальном Samsung, iOS — на Simulator, а реальный
  iPhone подтверждён руководителем.
