# Обзор проекта

## Цель документа

Этот документ нужен как практическая карта проекта:

- что это за приложение;
- на каком стеке оно собрано;
- как устроен вход в приложение;
- где лежит основная логика;
- где находятся внешние интеграции;
- какие зоны считаются критичными.

Документ рассчитан на разработчика, который работает с проектом, и на руководителя, которому нужно понимать общую картину без глубокого погружения в код.

## Что это за проект

`jacoDriverTest` - мобильное приложение на `React Native` для курьерского/водительского сценария.

По текущей структуре приложение покрывает:

- авторизацию и восстановление пароля;
- список заказов;
- карту заказов;
- действия курьера с заказом;
- настройки приложения;
- расчет/зарплатный экран;
- график работы;
- статистику времени;
- обратную связь;
- аналитику, уведомления, геолокацию и карты.

## Основной стек

- `React Native 0.87.1` с New Architecture / Fabric и Hermes
- `TypeScript`
- `Zustand` для глобального состояния
- `React Navigation` с `Drawer.Navigator`
- `NativeWind` и `Gluestack UI` для UI-слоя
- `Axios` для API-запросов
- `react-native-keychain` для Bearer-токена; `AsyncStorage` — только для несекретного локального состояния
- `Firebase Messaging` и локальная notification-обвязка
- `AppMetrica` для аналитики
- `Sentry` для crash/error reporting
- `react-native-yamap-plus` для карты
- `Jest` и `React Native Testing Library` для unit/component-level тестов

## Платформы

Проект содержит полноценные нативные папки:

- [android](../android)
- [ios](../ios)

Это значит, что изменения могут затрагивать не только JS-слой, но и нативную инфраструктуру.

## Базовые команды

Команды определены в [package.json](../package.json).

Сейчас есть:

- `npm run android`
- `npm run ios`
- `npm start`
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm test`
- `npm run test:ib`
- `npm run test:clean`
- `npm run test:ci`

Обязательный локальный baseline:

```bash
npm run lint
npm run typecheck
npm run test:unit
```

Подробнее про текущий статус проверок:

- [docs/quality-baseline.md](./quality-baseline.md)

## Как стартует приложение

Поток запуска:

1. [index.js](../index.js)
2. подключение `react-native-gesture-handler`
3. установка dev-флагов для fake orders в `__DEV__`
4. регистрация `App`
5. [App.tsx](../App.tsx)
6. инициализация `Sentry`
7. импорт [global.css](../global.css)
8. инициализация `YaMap`
9. инициализация `AppMetrica`
10. установка JS crash handler
11. запуск `AppProviders`
12. запуск `RootNavigator`

Важно: уже на старте приложения выполняются внешние интеграции и side effects. Поэтому изменения в startup-слое нужно считать рискованными.

## Архитектурная картина

Проект частично похож на feature-sliced структуру:

- `app`
- `processes`
- `features`
- `entities`
- `shared`
- `components`

При этом значительная часть бизнес-логики сосредоточена в одном общем store:

- [src/shared/store/store.ts](../src/shared/store/store.ts)

Практический вывод:

- папки разделены модульно;
- но состояние и бизнес-действия сильно централизованы;
- изменение store может затронуть сразу несколько экранов и сценариев.

## Основные папки

### `src/app`

Корневой уровень приложения.

Здесь находятся:

- провайдеры;
- навигация;
- стартовый экран приветствия.

Ключевые файлы:

- [src/app/providers/AppProviders.tsx](../src/app/providers/AppProviders.tsx)
- [src/app/navigation/RootNavigator.tsx](../src/app/navigation/RootNavigator.tsx)
- [src/app/navigation/MainDrawerNavigator.tsx](../src/app/navigation/MainDrawerNavigator.tsx)
- [src/app/screens/Greeting.tsx](../src/app/screens/Greeting.tsx)

### `src/features`

Основные пользовательские сценарии приложения.

Ключевые зоны:

- `auth` - авторизация;
- `reset-pwd` - восстановление пароля;
- `orders-list` - список заказов;
- `orders-map` - карта заказов;
- `settings` - настройки;
- `salary` - расчет;
- `schedule` - график;
- `statistics` - статистика времени;
- `feedback` - обратная связь.

### `src/entities`

Предметные UI-элементы.

Сейчас ключевая зона:

- [src/entities/CardOrder](../src/entities/CardOrder)

Здесь находится карточка заказа и связанные элементы действий/отображения.

### `src/shared`

Общий технический слой.

Здесь находятся:

- глобальные store;
- API-обвязка;
- типы;
- общие lib-хуки;
- ассеты;
- общие UI-компоненты.

Критичные файлы:

- [src/shared/store/store.ts](../src/shared/store/store.ts)
- [src/shared/store/api.ts](../src/shared/store/api.ts)
- [src/shared/lib/notifications.ts](../src/shared/lib/notifications.ts)
- [src/shared/lib/useUserLocationUpdater.ts](../src/shared/lib/useUserLocationUpdater.ts)
- [src/shared/lib/useSettingsUpdater.ts](../src/shared/lib/useSettingsUpdater.ts)
- [src/shared/lib/useAvgTimeUpdater.ts](../src/shared/lib/useAvgTimeUpdater.ts)

### `src/components/ui`

Базовые UI-примитивы и обвязка `Gluestack UI`.

Эта папка ближе к инфраструктурному UI-слою, чем к бизнес-компонентам.

### `src/analytics`

Интеграция с `AppMetrica`.

Ключевой файл:

- [src/analytics/AppMetricaService.tsx](../src/analytics/AppMetricaService.tsx)

## Глобальное состояние

Основное состояние живет в `Zustand`.

Ключевые store из [src/shared/store/store.ts](../src/shared/store/store.ts):

- `useGlobalStore`
- `useLoginStore`
- `useStatStore`
- `useSettingsStore`
- `useGEOStore`
- `useOrdersStore`
- `useFeedbackStore`

## Тема интерфейса

Тема приложения отделена от настройки оформления маркеров карты:

- `system` используется по умолчанию и следует теме устройства;
- `light` и `dark` выбираются в настройках и сохраняются в AsyncStorage;
- старая включённая настройка `night_map` один раз переносится в тёмную тему;
- Yandex Map использует тёмный режим по фактической теме всего приложения;
- палитра, Gluestack, навигация, Safe Area и системные панели переключаются
  централизованно через [src/shared/theme/AppThemeProvider.tsx](../src/shared/theme/AppThemeProvider.tsx).

Поле `theme` в settings store по-прежнему отвечает только за оформление маркеров.

Самые чувствительные сценарии:

- авторизация и токен;
- получение и обновление заказов;
- действия с заказом;
- геолокация курьера;
- карта заказов;
- настройки;
- статистика и расчет;
- обратная связь.

При временной потере сети `useOrdersStore` сохраняет успешно загруженные заказы
раздельно для текущего пользователя, кафе и типа списка. Поэтому при офлайн-
переключении разделов не смешиваются чужие выборки, список и маркеры продолжают
отображаться, а карточка заказа открывается с маркера без дополнительного API-запроса.
После первой успешной загрузки остальные разделы прогреваются последовательно в
фоне. Затем раз в 45 секунд обновляется один закрытый раздел по кругу: при пяти
разделах каждая закрытая выборка обновляется примерно раз в три минуты. Текущий
раздел сохраняет свой серверный интервал, фон не запускается одновременно с ним и
приостанавливается после сетевой ошибки до следующего успешного обычного запроса.
При смене рабочей точки контекст заказов переключается сразу: старые центр карты,
лимиты и открытая карточка сбрасываются, для новой точки показывается её кэш и
запускается отдельный актуальный запрос. Фоновая загрузка старой точки не блокирует
его и не может перезаписать заказы, телефоны или среднее время новой точки.
Последние успешно полученные заказы, настройки и телефоны также сохраняются в
AsyncStorage. При холодном запуске без сети приложение восстанавливает их до
открытия списка; кэш разделён по пользователю, кафе и типу заказов и очищается при
выходе. Bearer-токен в этот кэш не попадает и остаётся в Keychain/Keystore.
После успешной загрузки заказов приложение в фоне передаёт координаты выбранной
рабочей точки и крайних заказов в нативный `OfflineCacheManager` Yandex MapKit.
Приложение выбирает самый маленький доступный регион, покрывающий эти координаты,
и автоматически начинает его загрузку или обновление. Связь `point_id` с регионом
сохраняется в AsyncStorage, повторные запросы не запускают уже идущую загрузку.
Без сети та же нативная карта MapKit использует загруженную подложку, а маркеры и
карточки заказов строятся из локального кэша. Диагностической кнопки на карте нет.
В проекте используется платная лицензия Yandex MapKit с доступом к
`OfflineCacheManager`. Если SDK возвращает состояние `unsupported`, это считается
ошибкой активации офлайн-функций или привязки платной лицензии к ключу; фоновая
синхронизация при этом прекращается без блокировки списка, карты и кэша заказов.

Глобальный `ConnectivityLocationIndicator` подписан на изменения NetInfo и
принудительно обновляет состояние сети каждые 15 секунд. Если устройство отключено
от сети или интернет недоступен, отдельной строкой под навигационной шапкой
появляется плашка «Нет подключения к интернету». На экранах без шапки она
располагается внутри безопасной области. После восстановления соединения плашка
скрывается автоматически и не перехватывает нажатия по интерфейсу.

Переходы между экранами без сети не запускают серверные загрузчики. Категории
заказов переключаются мгновенно из кэша, а после восстановления связи выбранная
категория обновляется в фоне. Офлайн недоступны действия, которым обязательно
нужен сервер: создание предложения, сохранение настроек, выход из аккаунта,
управление периодом статистики, выбор месяца графика и открытие разборов ошибок по
заказам/камерам. На карте офлайн скрываются геолокация и слой пробок; локальная
блокировка поворота карты остаётся доступна.

Данные «Предложений», «Статистики времени», «Графика работы» и «Расчёта» не входят
в офлайн-кэш. Без сети эти разделы показывают пустое состояние и не отправляют
запросы; ответы прежней онлайн-сессии не отображаются. При восстановлении сети
открытый раздел сам запрашивает данные без полной перезагрузки: если данных ещё
нет, виден спиннер на время запроса, а уже полученные данные остаются на экране
при фоновом обновлении. Временные сетевые и серверные ошибки повторяются с
задержкой только пока раздел открыт; пустой успешный ответ не считается ошибкой.
Заказы, настройки и телефоны продолжают работать из своего отдельного кэша.

## Навигация

Навигация построена на `React Navigation`.

Корневой сценарий:

- [src/app/navigation/RootNavigator.tsx](../src/app/navigation/RootNavigator.tsx)
- [src/app/navigation/MainDrawerNavigator.tsx](../src/app/navigation/MainDrawerNavigator.tsx)

Используется `Drawer.Navigator`.

Основные экраны:

- `Greeting`
- `Auth`
- `ResetPwd`
- `List_orders`
- `Map`
- `Price`
- `Graph`
- `Statistics`
- `Settings`
- `Feedback`

Особенность: в `MainDrawerNavigator` также подключены updater-хуки и инициализация уведомлений. Поэтому навигационный слой одновременно является частью runtime-обвязки приложения.

## Внешние интеграции

### Backend API

Приложение использует Laravel REST API `/api/v1`; legacy API удалён из production-кода.
Debug и Release по умолчанию обращаются к `https://apidriver.jacochef.ru`.
Локальный `http://localhost:8080` включается только явным build-time флагом
`JACO_LARAVEL_API=local`. Основные точки:

- [src/shared/store/api.ts](../src/shared/store/api.ts)
- [src/shared/api/laravel/config.ts](../src/shared/api/laravel/config.ts)
- [src/shared/api/laravel/connector.ts](../src/shared/api/laravel/connector.ts)
- [src/shared/api/laravel/routes.ts](../src/shared/api/laravel/routes.ts)

API используется через именованные routes, store-методы и бизнес-хуки. Авторизация
работает через Bearer-токен в Keychain/Keystore; CAPTCHA и SSO имеют отдельные
mobile-сценарии, для которых требуется production-развёртывание подготовленных
изменений Laravel.

### Аналитика

Используется `AppMetrica`.

Основная точка:

- [src/analytics/AppMetricaService.tsx](../src/analytics/AppMetricaService.tsx)

### Crash/error reporting

Используется `Sentry`.

Инициализация находится в:

- [App.tsx](../App.tsx)

### Карты

Используется `react-native-yamap-plus`.

Инициализация находится в:

- [App.tsx](../App.tsx)

Основной экран:

- [src/features/orders-map/ui/MapScreen.tsx](../src/features/orders-map/ui/MapScreen.tsx)

Для iOS/Fabric используется `patch-package`, который инициализирует geometry
маркера `react-native-yamap-plus` до нативного mount/recycle. Перед передачей в
MapKit координаты заказов, домашней точки и курьера проверяются на конечность и
допустимый диапазон; некорректный заказ остаётся в store и списке, но его маркер
на карте не создаётся.

Поверх `YaMap` отображаются индикаторы заказов за пределами видимой области — круг
с количеством, цветами статусов и стрелкой направления. Границы, центр и поворот
берутся из камеры MapKit; по нажатию карта центрируется на соответствующей группе,
сохраняя масштаб и поворот. Расчёт выполняется локально и использует восстановленные
из кэша заказы также при отсутствии сети.

### Геолокация

Используются:

- `@react-native-community/geolocation`
- `react-native-permissions`

Основная логика связана с:

- `useGEOStore`
- [src/shared/lib/useUserLocationUpdater.ts](../src/shared/lib/useUserLocationUpdater.ts)

### Уведомления

Связанные зависимости:

- `@react-native-firebase/messaging`
- `@notifee/react-native`

Основная обвязка:

- [src/shared/lib/notifications.ts](../src/shared/lib/notifications.ts)

## Самые рискованные зоны проекта

### 1. `src/shared/store/store.ts`

Причины:

- много store в одном файле;
- есть бизнес-действия с заказами;
- есть авторизация и токен;
- есть геолокация и настройки;
- высокая связность между экранами.

### 2. Заказы и действия курьера

Ключевые зоны:

- [src/features/orders-list](../src/features/orders-list)
- [src/features/orders-map](../src/features/orders-map)
- [src/entities/CardOrder](../src/entities/CardOrder)

Причины:

- это основной бизнес-сценарий приложения;
- есть API-действия;
- есть ветки GPS/карты/модалок;
- ошибка может повлиять на реальные рабочие процессы.

### 3. Startup-слой

Ключевые файлы:

- [index.js](../index.js)
- [App.tsx](../App.tsx)
- [src/app/navigation/MainDrawerNavigator.tsx](../src/app/navigation/MainDrawerNavigator.tsx)

Причины:

- инициализация аналитики, Sentry, карт и уведомлений;
- updater-хуки;
- dev-флаги fake orders.

### 4. Геолокация и карта

Ключевые зоны:

- `useGEOStore`
- [src/features/orders-map](../src/features/orders-map)
- [src/shared/lib/useUserLocationUpdater.ts](../src/shared/lib/useUserLocationUpdater.ts)

Причины:

- platform-specific поведение;
- permissions;
- фоновое обновление позиции;
- визуальная группировка и отображение заказов.

### 5. Тестовая инфраструктура

Ключевые файлы:

- [jest.config.js](../jest.config.js)
- [jest.setup.ts](../jest.setup.ts)
- [**mocks**](../__mocks__)
- [**tests**](../__tests__)

Причины:

- много нативных зависимостей замокано вручную;
- тесты завязаны на fake timers;
- последняя локальная проверка 01.10.2026: 103 набора / 424 теста;
  `lint` и `typecheck` также прошли. Нативную сборку в этот прогон не включали.

## Минимальный безопасный подход к изменениям

1. Понять, какой слой затрагивается.
2. Проверить, не задевает ли изменение `store`, заказы, карту, startup или уведомления.
3. Найти похожий существующий паттерн.
4. Внести изменение локально.
5. Запустить релевантные проверки.
6. Для чувствительных зон обновить или добавить unit-тест.
7. Если меняются правила или процесс, обновить документацию.

## Связанные документы

- [docs/project-rules.md](./project-rules.md)
- [docs/quality-baseline.md](./quality-baseline.md)
- [docs/testing/README.md](./testing/README.md)
- [docs/new-architecture-migration-plan.md](./new-architecture-migration-plan.md)
- [docs/driver-site-ui-migration-plan.md](./driver-site-ui-migration-plan.md)
- [docs/laravel-api-mobile-migration-plan.md](./laravel-api-mobile-migration-plan.md)
