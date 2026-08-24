# План миграции на React Native 0.86 / Fabric

Дата: 24 августа 2026 года.

Ветка: `new_architecture`. Ветка `main` не меняется этим планом.

## 1. Зачем

Сейчас проект на RN `0.77.2` / React `18.3` / Paper. New Architecture выключена:

- Android: `newArchEnabled=false` в [android/gradle.properties](../android/gradle.properties)
- iOS: `ENV['RCT_NEW_ARCH_ENABLED'] = '0'` в [ios/Podfile](../ios/Podfile)

Это тупик, не «стабильная старая база». В RN `0.86` отключить New Architecture уже нельзя считать рабочей стратегией.

Цель: тот же курьерский продукт на новом фундаменте. Не новое приложение.

Не цель первой волны:

- переписать store, навигацию, карту, заказы, шиты, стили;
- менять геолокацию «заодно»;
- оптимизировать списки как каталог клиентского приложения.

## 2. Роль клиентского проекта

Клиентское приложение смотрели только чтобы понять, что на практике значит New Architecture:

- RN `0.86` + Fabric сразу, не Paper-first;
- Reanimated 4 через `react-native-worklets`, не через `worklets-core`;
- Gesture Handler 3, Node 24, Hermes.

Клиентское **не эталон**. Там свои зоны (каталог, MiniCodePush, Skia, WebView, Detox), и зависимости там ещё не все закрыты. Пины, UI-архитектуру и незакрытый хвост оттуда не копировать.

Курьерское проще по экранам, но свои дорогие зоны: карта заказов, GPS, действия с заказом, Sentry, drawer.

## 3. Текущий статус этапов

| Этап | Статус |
| --- | --- |
| 0. Ветка и docs | сделан. Запуск Android и iOS из `new_architecture` ок, поведение как на `main` |
| 1. Аудит и bump + флаги Fabric | не начат, нужен отдельный допуск на код |
| 2. Native compile | не начат |
| 3. Jest / TS хвост | не начат |
| 4. Android debug smoke | не начат |
| 5. iOS debug smoke | не начат |
| 6. Release smoke | не начат |

После этапа 0 запуск из `new_architecture` равен запуску с `main`: RN `0.77`, Paper, New Arch выключена. Fabric появится только на этапе 1+.

## 4. Целевой стек

Конкретные patch-версии сверять по этому репозиторию, не по клиентскому `package.json`.

- Node `>=24 <25` (сейчас `>=18`, CI на Node 20)
- React Native `0.86.0`
- React / React DOM `19.2.x`
- New Architecture / Fabric / Hermes включены
- Reanimated `4.x` + `react-native-worklets` + Gesture Handler `3.x`
- Screens / Safe Area — актуальные под RN `0.86`
- Firebase минимум `24.x` (сейчас `23.5.0`); `25.x` — отдельная волна
- Android: SDK 36, NDK `29.0.14206865`
- iOS: `RCT_NEW_ARCH_ENABLED=1` и `RCTNewArchEnabled` в Info.plist

Babel: `react-native-worklets/plugin`. Не использовать `react-native-reanimated/plugin` и `react-native-worklets-core`.

При bump убрать мёртвое:

- `react-native-worklets-core`
- `reanimated-bottom-sheet` (нет импортов в `src/`)
- старые патчи `reanimated+3.16.7`, `gesture-handler+2.29.1`, `community-cli-plugin+0.77.2`, `css-interop` под worklets-core
- Finder-дубликаты `* 2.patch`
- патч `react-native-svg+15.13.0`, если это мусор сборки

`edgeToEdgeEnabled` в первой волне не включать.

### Карты: New Arch пробуем на `react-native-yamap-plus`

Сейчас в проекте `react-native-yamap@4.8.3` (оригинал Волга-Волга, Paper). Для New Architecture **не опираемся на эту линейку**. На этапах native compile и smoke карты переходим на [react-native-yamap-plus](https://www.npmjs.com/package/react-native-yamap-plus) и **на ней** проверяем Fabric.

Почему так: оригинал `4.8.3` — последний релиз ноября 2024, New Arch там нет. Plus живой (линейка 6 = New Arch, 5 = Paper + New Arch). Это не «сейчас», а решение плана на этапы 1–2 и карточный smoke.

Что учесть при переходе (когда дойдём до кода):

- пакет другой: `react-native-yamap` → `react-native-yamap-plus`;
- init и часть props не drop-in (`YaMap.init` → `YamapInstance.init`, жесты `*Enabled` → `*Disabled`);
- старый патч [patches/react-native-yamap+4.8.3.patch](../patches/react-native-yamap+4.8.3.patch) к plus как есть не приклеится — смысл фиксов переносить только если plus их ещё не закрыл;
- карта — основной экран: маркеры, grouping, tap, zoom, traffic.

Это **не пакет Яндекса**, и **Волга-Волга тоже не Яндекс**. Официально Яндекс даёт MapKit для Android, iOS и Flutter: [MapKit SDK](https://yandex.ru/maps-api/products/mapkit), репозиторий [yandex/yandex_maps_mapkit](https://github.com/yandex/yandex_maps_mapkit). Отдельной официальной библиотеки React Native у Яндекса нет.

`react-native-yamap` — сторонная обёртка компании Волга-Волга (`vvdev.ru`, GitHub `volga-volga`). `react-native-yamap-plus` — форк этой обёртки (автор Aleksey Pekhterev, [Qudaeo/react-native-yamap-plus](https://github.com/Qudaeo/react-native-yamap-plus)). Поэтому «переехали и не сказали»: не было официального анонса Яндекса. Plus не хороним заранее — это просто более живой community-форк с New Arch, не гарантия навсегда.

## 5. Этапы

### Этап 0. Ветка и docs

Сделано этим документом:

- ветка `new_architecture` от `main`;
- этот файл;
- ссылка из [docs/README.md](./README.md);
- оркестратор ролей Cursor в [.cursor/rules](../.cursor/rules).

Код приложения не менять. CI на Node 24 не включать в этом этапе. Коммиты делает только пользователь.

### Этап 1. Аудит и bump + флаги Fabric

Только после отдельного разрешения менять код.

- аудит [package.json](../package.json), [patches](../patches), native-либ драйвера;
- bump RN / React / Reanimated / Worklets / Gesture Handler;
- Android `newArchEnabled=true`, iOS `RCT_NEW_ARCH_ENABLED=1`;
- клиентские файлы и пины не копировать.

Ориентир: Upgrade Helper `0.77.2 → 0.86.0` и требования RN `0.86`.

### Этап 2. Native compile

Сборка группами. После каждой группы — Android debug start. iOS — после `pod install`.

- Reanimated / Worklets / Gesture Handler
- Screens / Safe Area / Drawer
- карта: `react-native-yamap-plus` (New Arch пробуем на ней, не на старой `4.8.3`)
- Sentry
- Firebase / Notifee / Permissions
- AppMetrica

CMake/codegen чинить точечно. Fabric не откатывать.

### Этап 3. Jest / TS хвост

Вернуть зелёные команды из [docs/quality-baseline.md](./quality-baseline.md):

```bash
npm run lint
npm run typecheck
npm run test:unit
```

Это нужно сделать до ручного smoke. Не смешивать с починкой карты.

### Этап 4. Android debug smoke

По [docs/testing/release-checklist.md](./testing/release-checklist.md):

- cold start, Greeting/Auth;
- Sentry / AppMetrica / YaMap не валят старт;
- логин / ошибка логина / токен;
- список заказов, карточка, модалка подтверждения;
- карта: маркеры, grouping, открытие заказа, пустое состояние;
- GPS: permission, позиция, GPS-зависимые действия;
- drawer: Settings / Graph / Statistics / Salary / Feedback;
- шиты заказа и фидбека: open / close / backdrop;
- fake orders остаются `off`.

UI чинить только если сломалось. Эмулятор не вердикт по производительности.

### Этап 5. iOS debug smoke

Тот же список отдельно на iOS.

### Этап 6. Release smoke

Embedded bundle без Metro, Android 16 KB, iOS archive / permissions / push на старте.

MiniCodePush в этом проекте нет.

## 6. Курьерские риски

Правила работы: [docs/project-rules.md](./project-rules.md). Обзор: [docs/project-overview.md](./project-overview.md).

1. **Карта** — основной рабочий экран. New Arch проверяем на `react-native-yamap-plus`, не на старой `react-native-yamap@4.8.3`. Точки: [MapScreen.tsx](../src/features/orders-map/ui/MapScreen.tsx), `freezeOnBlur: false` в [MainDrawerNavigator.tsx](../src/app/navigation/MainDrawerNavigator.tsx).
2. **Геолокация** — `@react-native-community/geolocation` в [store.ts](../src/shared/store/store.ts). Библиотеку не менять, пока 0.86 её не сломает.
3. **Sentry** — `Sentry.wrap`, metro, [reanimatedGuard.ts](../src/shared/lib/reanimatedGuard.ts).
4. **`react-native-reanimated-table`** в графике и статистике. Если сломается на Reanimated 4 — точечный фикс.
5. **`@react-spring/native`** в [CustomAlert.tsx](../src/shared/ui/CustomAlert.tsx). Менять только при регрессии.
6. **Шиты gorhom** на карте и в фидбеке. Не переписывать заранее под клиентский `BottomSheetModal`.
7. **Глобальные overlay** в [AppProviders.tsx](../src/app/providers/AppProviders.tsx). Если перехватят тачи карты — чинить `pointerEvents` только там.
8. **`removeClippedSubviews={true}`** в [OrdersList.tsx](../src/features/orders-list/ui/OrdersList.tsx) и [FeedbackList.tsx](../src/features/feedback/ui/FeedbackList.tsx). Запасной фикс, не превентивная правка.

## 7. Чеклист для Битрикс

Задача: «Курьерское приложение — новая архитектура, обновление зависимостей».

1. Составление плана миграции курьерского приложения
2. Проведение аудита и обновление зависимостей
3. Выполнение перехода на новую архитектуру
4. Стабилизация приложения после миграции
5. Проверка карты заказов, маркеров и YaMap
6. Проверка геолокации, permissions и GPS-зависимых действий
7. Проверка списка заказов, логина и основных экранов
8. Проведение тестирования на реальных устройствах Android и iOS
9. Проверка release-сборки Android и iOS

Не добавлять в этот чеклист заранее: «баги», splash / edge-to-edge / шиты, доработку модалок, замеры FPS, «обновить документацию».

## 8. Вне этой миграции

- Android edge-to-edge / splash — отдельная волна, только если после Fabric полезет
- оставшиеся majors зависимостей
- усиление ESLint
- e2e, если решим заводить
- переписывание шитов «под клиентскую схему»

### Отдельная задача, не этот переезд

Кнопка «Удалить аккаунт» для тестового аккаунта `79990000001` / `DemoDriver1!`.

Сейчас кнопки нет. Кнопка фейковая: бэкенд аккаунт не удаляет. По UX должна имитировать реальный сценарий. В Битрикс — отдельная задача, не пункт этой.

## 9. Definition of Done

Миграция закрыта, когда:

- ветка `new_architecture` живёт отдельно от `main`;
- Android и iOS debug стартуют на RN `0.86` + Fabric;
- карта, список заказов, логин, GPS, основные drawer-экраны проходят ручной smoke;
- шиты работают или точечно починены без смены архитектуры;
- `lint` / `typecheck` / `test:unit` зелёные;
- release smoke пройден или явно отложен здесь;
- бизнес-логика store и заказов не переписана «под Fabric».

## 10. Роли Cursor

Короткий набор, не копия клиентского:

- [.cursor/rules/00-orchestrator.mdc](../.cursor/rules/00-orchestrator.mdc) — всегда
- [.cursor/rules/90-safety.mdc](../.cursor/rules/90-safety.mdc) — всегда
- [.cursor/rules/10-analyst.mdc](../.cursor/rules/10-analyst.mdc)
- [.cursor/rules/20-developer.mdc](../.cursor/rules/20-developer.mdc)
- [.cursor/rules/30-tester.mdc](../.cursor/rules/30-tester.mdc)
- [.cursor/rules/31-reviewer.mdc](../.cursor/rules/31-reviewer.mdc)

Оркестратор: сначала анализ, код только после подтверждения, коммиты не делать.

Дальше работаем через эти роли. Если роль не покрывает задачу или мешает — правим `.mdc`, не обходим правило в чате.

## 11. Дисциплина

Правила: [docs/project-rules.md](./project-rules.md).

- менять локально;
- не смешивать bump, UI-rewrite и majors;
- store и заказы не трогать без причины;
- этот документ обновлять вместе со статусом этапов.

Этап 1 и дальше — только после отдельного разрешения менять код приложения.
