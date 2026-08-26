# План миграции на React Native 0.87 / Fabric

Дата: 24 августа 2026 года. Обновлён 25 августа 2026: цель волны — RN `0.87.0`, не клиентский `0.86`. Волна зависимостей после `0.87`: Navigation 7.13.9, Sentry 8.23.0, Firebase 26.3.2, AppMetrica 4.2.0, async-storage 3.1.1, datetimepicker 9.1.0, netinfo 12.0.1, fontawesome RN 1.0.0, lucide-react-native 1.34.0, device-info 15.0.2, ESLint 10, screens 4.27, RNGH 3.2.1, yamap-plus 6.11.0, Babel 7.29.

Ветка: `new_architecture`. Ветка `main` не меняется этим планом.

## 1. Зачем

На `main` проект был на RN `0.77.2` / React `18.3` / Paper, New Architecture выключена. Это тупик.

На `new_architecture` фундамент уже поднят до RN `0.86` + Fabric. Дальше не копируем клиентский пин `0.86` (он был актуален, когда делали сайт). Цель волны: **RN `0.87.0`** — latest stable на момент 25 августа 2026.

Цель: тот же курьерский продукт на текущем фундаменте. Не новое приложение.

Не цель первой волны:

- переписать store, навигацию, карту, заказы, шиты, стили;
- менять геолокацию «заодно»;
- оптимизировать списки как каталог клиентского приложения.

## 2. Роль клиентского проекта

Клиентское приложение смотрели только чтобы понять, что на практике значит New Architecture:

- RN latest + Fabric сразу, не Paper-first (у клиента на момент той миграции это был `0.86`);
- Reanimated 4 через `react-native-worklets`, не через `worklets-core`;
- Gesture Handler 3, Node 24, Hermes.

Клиентское **не эталон**. Там свои зоны (каталог, MiniCodePush, Skia, WebView, Detox), и зависимости там ещё не все закрыты. Пины, UI-архитектуру и незакрытый хвост оттуда не копировать.

Курьерское проще по экранам, но свои дорогие зоны: карта заказов, GPS, действия с заказом, Sentry, drawer.

## 3. Текущий статус этапов

| Этап | Статус |
| --- | --- |
| 0. Ветка и docs | сделан |
| 1. Аудит и bump + флаги Fabric | сделан: RN `0.87.0` + Fabric, yamap-plus |
| 2. Native compile | debug Android и iOS на `0.87` собираются (после Sentry 8 / Firebase 26 тоже) |
| 3. Jest / TS хвост | lint / typecheck / unit зелёные на `0.87` + ESLint 10 |
| 4. Android debug smoke | список, drawer, карта и маркеры на эмуляторе ок; GPS — на Samsung |
| 5. iOS debug smoke | симулятор стартует, список ок; карту/drawer с симулятора не докликали (нет a11y-тапа); реального iPhone нет |
| 6. Release smoke | не начат. Прод-выкладку делает не эта задача |

После этапа 0 запуск из `new_architecture` был равен `main` (RN `0.77`, Paper). Fabric появился на этапе 1 (сначала `0.86`, сейчас `0.87`).

## 4. Целевой стек

Конкретные patch-версии сверять по этому репозиторию, не по клиентскому `package.json`.

- Node `>=24 <25` (минимум RN 0.87 — `>= 22.13`; CI на Node 24)
- React Native `0.87.0`
- React / React DOM `19.2.x` (не даунгрейдить патч ниже шаблонного)
- New Architecture / Fabric / Hermes включены
- Reanimated `4.6.x` + `react-native-worklets` `0.12.x` (4.5.x 0.87 не поддерживает) + Gesture Handler `3.2.1`
- Screens `4.27.0` / Safe Area `5.9.1` — актуальные под RN `0.87`
- Navigation: `@react-navigation/drawer` `^7.13.9`, `native` `^7.3.17`, `native-stack` `^7.18.9` (линейка 7; восьмёрка — alpha, не берём)
- Sentry `@sentry/react-native` `8.23.0` (патч `7.13.0` снят)
- Firebase `@react-native-firebase/app` + `messaging` `26.3.2` (одна версия на оба)
- ESLint `10.x`; Babel `^7.29.7` (не 8; пресет RN 0.87 на семёрке); TypeScript `5.9.3` (не 6/7)
- Android: compileSdk/buildTools 37, targetSdk 36, NDK `29.0.14206865`, AGP 9 с `android.builtInKotlin=false` и `android.newDsl=false`
- iOS: `RCT_NEW_ARCH_ENABLED=1` и `RCTNewArchEnabled` в Info.plist; RN SwiftPM не включать; Firebase native — CocoaPods (`$RNFirebaseDisableSPM = true` + static `use_frameworks!`)

Рабочие версии после волны (debug Android/iOS собрались):

| Пакет | package.json |
| --- | --- |
| `react-native` | `0.87.0` |
| `react-native-reanimated` / `react-native-worklets` | `4.6.0` / `0.12.1` |
| `react-native-gesture-handler` | `3.2.1` |
| `react-native-screens` / `react-native-safe-area-context` | `4.27.0` / `5.9.1` |
| `nativewind` | `4.2.6` |
| `react-native-yamap-plus` | `6.11.0` |
| `@sentry/react-native` | `8.23.0` |
| `@appmetrica/react-native-analytics` | `4.2.0` |
| `@react-native-async-storage/async-storage` | `3.1.1` (default import = legacy v2 backend, токен не мигрируем) |
| `@react-native-community/datetimepicker` | `9.1.0` (peer `react-native-modal-datetime-picker`, прямой импорт в Calendar закомментирован) |
| `@fortawesome/react-native-fontawesome` | `1.0.0` (рендерер FA7; core/icons уже 7.x) |
| `lucide-react-native` | `1.34.0` (JS поверх `react-native-svg`; Copy / QrCode / RefreshCcw / Search). Metro: в `sourceExts` нужен `mjs` — пакет 1.x отдаёт ESM `.mjs`, native-сборку не трогаем |
| `@react-native-community/netinfo` | `12.0.1` (индикатор сети в AppProviders выключен) |
| `react-native-device-info` | `15.0.2` (`isLocationEnabled` в выключенном ConnectivityLocationIndicator; breaking 15 = compileSdk 34+, у нас 37) |
| `@react-native-firebase/app` + `messaging` | `26.3.2` |
| `@react-navigation/drawer` / `native` / `native-stack` | `^7.13.9` / `^7.3.17` / `^7.18.9` |
| `eslint` | `^10.9.1` |
| `@babel/core` | `^7.29.7` |
| `typescript` | `5.9.3` |

Костыли, которые остаются: shim `InteractionManager`; Strict TS `react-native-legacy-deep-imports` до RN 0.88; Metro `sourceExts` + `mjs` под lucide 1. Патч Sentry 7 снят.

Babel: `react-native-worklets/plugin`. Не использовать `react-native-reanimated/plugin` и `react-native-worklets-core`.

При bump убрать мёртвое:

- `react-native-worklets-core`
- `reanimated-bottom-sheet` (нет импортов в `src/`)
- старые патчи `reanimated+3.16.7`, `gesture-handler+2.29.1`, `community-cli-plugin+0.77.2`, `css-interop` под worklets-core
- Finder-дубликаты `* 2.patch`
- патч `react-native-svg+15.13.0`, если это мусор сборки

`edgeToEdgeEnabled` в первой волне не включать.

### Карты: New Arch пробуем на `react-native-yamap-plus`

В коде уже `react-native-yamap-plus@6.11.0`. Старая `react-native-yamap@4.8.3` снята. New Architecture проверяем на plus.

Почему так: оригинал `4.8.3` — последний релиз ноября 2024, New Arch там нет. Plus живой (линейка 6 = New Arch, 5 = Paper + New Arch). Это не «сейчас», а решение плана на этапы 1–2 и карточный smoke.

Что учесть при переходе (когда дойдём до кода):

- пакет другой: `react-native-yamap` → `react-native-yamap-plus`;
- init и часть props не drop-in (`YaMap.init` → `YamapInstance.init`, жесты `*Enabled` → `*Disabled`);
- старый патч `react-native-yamap+4.8.3` удалён; смысл фиксов переносить только если plus их ещё не закрыл;
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

Ориентир: Upgrade Helper `0.86.0 → 0.87.0` и требования RN `0.87`. Не копировать клиентские пины.

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

Контракт `__tests__/new-architecture.contract.test.ts` дополнительно держит: индикатор сети/GPS в `AppProviders` выключен; токен в `store.ts` на default import AsyncStorage (`getItem`/`setItem('token'`), не `createAsyncStorage`; shim `InteractionManager` в `index.js` до `App`.

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
2. **Геолокация** — `@react-native-community/geolocation` в [store.ts](../src/shared/store/store.ts). Библиотеку не менять, пока 0.87 её не сломает.
3. **Sentry** — `Sentry.wrap`, metro, [reanimatedGuard.ts](../src/shared/lib/reanimatedGuard.ts). На `8.23.0` iOS собирается без патча `RCTTextView.h` (патч `7.13.0` удалён).
3a. **Drawer / InteractionManager** — RN `0.87` удалил `InteractionManager`. Drawer `7.13.9` / `react-native-drawer-layout` 4.2.x на RN ≥ 0.82 сами не дергают handle, но shim [interactionManagerCompat.ts](../src/shared/lib/interactionManagerCompat.ts) оставляем: жест меню на устройстве без shim не снимали. Navigation 8 — alpha, не берём.
3b. **Firebase 26** — modular JS уже был (`getApp` / `getMessaging`). Native iOS: не SPM (статическая линковка), `$RNFirebaseDisableSPM = true`. Откат — парой `app`+`messaging`.
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

### Что не обновляли и почему

Не «забыли пакет». На линейке RN `0.87` дальше либо ещё нет стабильного релиза, либо это другой стек/проект, либо ломает текущие Gluestack / Metro / ESLint. Drop-in на latest там нет.

**Ещё нет или не стабильно**

- `react-native` `0.88` — не выпущен; latest stable = `0.87.0`. Strict TS opt-out `react-native-legacy-deep-imports` в tsconfig живёт до будущего 0.88.
- `@react-navigation/*` 8 (`@next`) — alpha. Последний stable drawer — семёрка (`^7.13.9`). Shim `InteractionManager` оставляем.
- `nativewind` 5 — npm `preview` (`5.0.0-preview.4`). Stable = `4.2.6`.

**Ломает текущий стек**

- `tailwindcss` 4 — другой движок. NativeWind 4 и Gluestack `className` заточены под Tailwind 3. `^3.4.19` = последний 3.x (npm `v3-lts`).
- `@babel/core` 8 — пресет `@react-native/babel-preset@0.87.0` на Babel 7 и плагинах семёрки. `^7.29.7` = последняя семёрка.
- `typescript` 7 — нативный Go-`tsc`, нет JS compiler API; `typescript-eslint@8` требует `>=4.8.4 <6.1.0` и на 7 падает. `5.9.3` = последняя пятёрка.
- `@expo/html-elements` 55+ — нумерация Expo SDK, не drop-in с `^0.13.8`. Gluestack (Heading / Table / Actionsheet) сидит на 0.13.
- Android `edgeToEdgeEnabled` / splash — не npm, флаг вёрстки; ломает системные инсеты (шапка, карта). С клиентского приложения не копировать.

**Можно по semver, но не эта волна**

- `typescript` `6.0.3` — `typescript-eslint` ещё ест (`<6.1.0`). Major `tsc`, риск жёлтого `typecheck`. К Fabric не привязан.

**Не пакеты этой волны**

- SwiftPM вместо CocoaPods — экспериментальная сборка iOS; Firebase/RN оставляем на pods (`$RNFirebaseDisableSPM = true`).
- усиление ESLint-правил (движок уже 10)
- e2e
- переписывание шитов «под клиентскую схему»

### UI-хвост

Когда будет отдельный план вёрстки, не эта ветка:

- `ScreenLayout`: `SafeAreaView` из `react-native` deprecated на 0.87; перевести на `react-native-safe-area-context` (`SafeAreaProvider` в `AppProviders`, в layout по умолчанию `edges` без `top` — шапка drawer уже съела статус-бар; на `Auth` / `ResetPwd` — с `top`)
- шапка: Android серый системный статус-бар, iOS красный `#c03` до верха — тема / `StatusBar`, не Fabric; на `main` в `styles.xml` `statusBarColor` тоже не было
- карта, низ экрана: при `night_map` карта тёмная, а приложение светлое (`GluestackUIProvider` `mode='light'`, `ScreenLayout` фон `#F5F5F5`). iOS — белая полоса home indicator (фон layout, не тема карты); Android — чёрный system navigation bar. Красить/тянуть карту под inset вместе с safe area и статус-баром
- настройки, блок «Карта»: чекбоксы (тёмная тема / ползунок масштаба / центрировать при взятии-отмене) после включения не отжимаются. Не задумано; было до этой миграции (`CheckboxGroup` с одним значением с апреля 2025). Бэкенд `0/1` уже умеет. Фикс: обычный `Checkbox` `isChecked` + `onChange(boolean)`, после save писать флаги в settings store. Тот же шаблон — «Уведомить о решении» в фидбеке.

RNGH `3.2.1`, screens `4.27.0`, yamap-plus `6.11.0`, safe-area `5.9.1`, AppMetrica `4.2.0`, async-storage `3.1.1`, datetimepicker `9.1.0`, netinfo `12.0.1`, device-info `15.0.2` в этой волне уже подняты (debug Android/iOS собрались). Fontawesome RN `1.0.0` и lucide `1.34.0` — JS-обёртки над `react-native-svg`, native-сборку не требуют.

### Отдельная задача, не этот переезд

Кнопка «Удалить аккаунт» для тестового аккаунта `79990000001` / `DemoDriver1!`.

Сейчас кнопки нет. Кнопка фейковая: бэкенд аккаунт не удаляет. По UX должна имитировать реальный сценарий. В Битрикс — отдельная задача, не пункт этой.

## 9. Definition of Done

Миграция закрыта, когда:

- ветка `new_architecture` живёт отдельно от `main`;
- Android и iOS debug стартуют на RN `0.87` + Fabric;
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
