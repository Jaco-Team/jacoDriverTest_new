import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  OrderConfirmModal,
  type OrderConfirmType,
} from '@/entities/CardOrder/ui/ModalConfirm'
import { CardOrder } from '@/entities/CardOrder/ui/CardOrder'
import { ModalErrCam } from '@/features/schedule/ui/ModalErrCam'
import { ModalErrOrder } from '@/features/schedule/ui/ModalErrOrder'
import { appPalette } from '@/shared/styles/appPalette'
import { OFFLINE_ORDER_ACTION_MESSAGE } from '@/shared/lib/offlineOrderAction'
import { useGlobalStore } from '@/shared/store/store'
import { useAppTheme } from '@/shared/theme/AppThemeProvider'
import type { Order } from '@/shared/store/OrdersStoreType'
import type { GraphErrCam, GraphErrOrder } from '@/shared/store/StatStoreType'

interface PreviewOrder {
  title: string
  description: string
  order: Order
}

interface PreviewConfirmState {
  isOpen: boolean
  type: OrderConfirmType
  orderId: number
}

const CLOSED_CONFIRM_STATE: PreviewConfirmState = {
  isOpen: false,
  type: '',
  orderId: 0,
}

const PREVIEW_ORDER_ERROR: GraphErrOrder = {
  answer: '',
  answer_date: '',
  date_close: '',
  date_time_close: '',
  date_time_order: '30.08.2026 10:45',
  err_id: 7001,
  full_user_name: 'Тестовый курьер',
  id: 7001,
  imgs: [],
  is_delete: 0,
  is_edit: 1,
  is_mentor: 0,
  item_id: 501,
  item_name: 'Роллы',
  item_price: 850,
  my_price: 300,
  need_row: 1,
  new_order_id: 0,
  new_status: 0,
  new_text_1: '',
  new_text_2: '',
  order_desc: 'Нарушено время доставки заказа',
  order_id: 910001,
  pr_id: 12,
  pr_name: 'Опоздание курьера',
  row_id: 8001,
  stage_id: 4,
  stage_name: 'Доставка',
  user_id: 77,
  user_name: 'Тестовый курьер',
  win_id: 0,
  win_name: '',
}

const PREVIEW_CAMERA_ERROR: GraphErrCam = {
  date_time_close: '',
  date_time_fine: '30.08.2026 11:10',
  fine_name: 'Не выполнена обязательная фотография',
  id: 7002,
  imgs: [],
  is_delete: false,
  is_edit: 1,
  point_id: 15,
  price: 250,
  status: 0,
  text_one: '',
  text_two: '',
}

function createOrder(overrides: Partial<Order>): Order {
  return {
    id: 910001,
    id_text: '#910001 В очереди 0%',
    is_get: 0,
    is_my: 0,
    is_delete: 0,
    is_pred: 0,
    is_ready: 0,
    status_order: 0,
    online_pay: 0,
    addr: 'Пугачёвская улица, 40',
    pd: '1',
    et: '2',
    kv: '15',
    need_time: '17:00 - 17:30',
    time_start_order: '16:05',
    close_date_time_order: '',
    to_time: '01:15',
    count_other: 1,
    count_pasta: 0,
    count_pizza: 0,
    count_drink: 0,
    drink_list: [],
    comment: '',
    delete_reason: '',
    sdacha: 0,
    sum_sdacha: 0,
    sum_order: 1850,
    number: '79990000000',
    driver_id: null,
    driver_name: '',
    driver_login: '',
    fake_dom: 1,
    give_data_time: '',
    plus_time_pred: 0,
    point_color: '',
    point_text: '',
    status: '',
    color: '',
    close_time_: 0,
    time: '',
    time_dev_order: 0,
    time_start_mini: '',
    to_time_sec: 0,
    to_time_sec_min: 0,
    unix_date_time_preorder: 0,
    unix_time: 0,
    unix_time_to_client: 0,
    unix_time_to_client_test: '',
    xy: {
      latitude: 53.1959,
      longitude: 50.1002,
      lat: 53.1959,
      lon: 50.1002,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    },
    ...overrides,
  }
}

function getPreviewOrders(): PreviewOrder[] {
  return [
    {
      title: 'Свободный предзаказ',
      description: 'Телефон, «Взять» и строка «Начнут готовить».',
      order: createOrder({
        id: 910001,
        id_text: '#910001 Предзаказ 0%',
        is_pred: 1,
        status_order: '1' as unknown as number,
        count_pasta: 1,
        count_pizza: 2,
        count_drink: 2,
        drink_list: [
          { names: 'Морс клюквенный' },
          { names: 'Лимонад' },
        ],
      }),
    },
    {
      title: 'Мой заказ — наличные',
      description: 'Все действия, QR, сдача и длинный комментарий.',
      order: createOrder({
        id: 910002,
        id_text: '#910002 Готовится 40%',
        is_get: 1,
        is_my: 1,
        status_order: 2,
        fake_dom: 0,
        comment:
          'Позвоните по номеру +7 999 222-33-44 или +7 999 555-66-77, когда будете у подъезда.',
        sdacha: 5000,
        sum_sdacha: 3150,
      }),
    },
    {
      title: 'Мой заказ — оплачен',
      description: 'Без блока сдачи, сумма заменена на «Оплачено».',
      order: createOrder({
        id: 910003,
        id_text: '#910003 В пути 70%',
        is_get: '1' as unknown as number,
        is_my: '1' as unknown as number,
        online_pay: '1' as unknown as number,
        status_order: 4,
        pd: '0',
        et: '0',
        kv: '0',
      }),
    },
    {
      title: 'Завершённый заказ',
      description: 'Строка «Отдали», без незавершённых действий.',
      order: createOrder({
        id: 910004,
        id_text: '#910004 Завершён 100%',
        is_get: 1,
        is_my: 1,
        status_order: '6' as unknown as number,
        close_date_time_order: '17:24',
      }),
    },
    {
      title: 'Отменённый заказ',
      description: 'Красная поверхность и причина удаления.',
      order: createOrder({
        id: 910005,
        id_text: '#910005 Отменён',
        is_get: 1,
        is_my: 1,
        is_delete: '1' as unknown as number,
        delete_reason: 'Клиент отменил заказ',
      }),
    },
    {
      title: 'У другого курьера',
      description: 'Имя водителя и его контакт.',
      order: createOrder({
        id: 910006,
        id_text: '#910006 У другого курьера',
        is_get: 1,
        is_my: 0,
        driver_id: 77,
        driver_name: 'Иван Петров',
        driver_login: '79998887766',
      }),
    },
  ]
}

export function OrdersUiPreviewScreen(): React.JSX.Element {
  const globalFontSize = useGlobalStore((state) => state.globalFontSize)
  const showModalText = useGlobalStore((state) => state.showModalText)
  const { colors, resolvedScheme, setPreviewPreference, clearPreviewPreference } = useAppTheme()
  const previewOrders = useMemo(getPreviewOrders, [])
  const [confirm, setConfirm] = useState<PreviewConfirmState>(
    CLOSED_CONFIRM_STATE,
  )
  const [graphErrorPreview, setGraphErrorPreview] = useState<
    'order' | 'camera' | null
  >(null)

  useEffect(() => () => clearPreviewPreference(), [clearPreviewPreference])

  function showSafeAction(message: string): void {
    Alert.alert('UI-предпросмотр', `${message}\nЗапрос не отправлен.`)
  }

  function setActiveConfirm(
    active: boolean,
    orderId = 0,
    type: OrderConfirmType = '',
    _isDeleted = false,
  ): void {
    setConfirm(
      active
        ? { isOpen: true, type, orderId }
        : CLOSED_CONFIRM_STATE,
    )
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]} testID="orders-ui-preview">
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.notice, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
          <Text style={[styles.noticeTitle, { color: colors.text }]}>DEV: тестовые заказы</Text>
          <Text style={[styles.noticeText, { color: colors.textMuted }]}>
            Это локальные данные. Кнопки не вызывают API, GPS и телефон.
          </Text>
        </View>

        <View style={[styles.modalPreview, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Сообщение об офлайне</Text>
          <Text style={[styles.sectionDescription, { color: colors.textMuted }]}>
            Без заказа, сети и API. Выберите тему и откройте настоящую панель ошибки.
          </Text>
          <View style={styles.graphPreviewActions}>
            <View style={styles.themeActions}>
              {(['light', 'dark'] as const).map(theme => (
                <Pressable
                  key={theme}
                  accessibilityRole="button"
                  style={[styles.themeButton, {
                    borderColor: colors.border,
                    backgroundColor: resolvedScheme === theme ? colors.brandSoft : colors.surfaceAlt,
                  }]}
                  testID={`preview-error-theme-${theme}`}
                  onPress={() => setPreviewPreference(theme)}
                >
                  <Text style={[styles.themeButtonText, { color: colors.text }]}>
                    {theme === 'light' ? 'Светлая' : 'Тёмная'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              style={[styles.previewButton, { backgroundColor: colors.brand }]}
              testID="preview-offline-error"
              onPress={() => showModalText(true, OFFLINE_ORDER_ACTION_MESSAGE)}
            >
              <Text style={styles.previewButtonText}>Показать ошибку офлайн</Text>
            </Pressable>
          </View>
        </View>

        {previewOrders.map(({ title, description, order }) => (
          <View key={order.id} testID={`preview-order-${order.id}`}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.sectionDescription, { color: colors.textMuted }]}>{description}</Text>
            <CardOrder
              FormatPrice={(price) => String(price)}
              actionButtonOrder={(_type, orderId) =>
                showSafeAction(`Действие «Взять» для заказа ${orderId}.`)
              }
              dialCall={(phone) => showSafeAction(`Звонок: ${phone}.`)}
              globalFontSize={globalFontSize}
              item={order}
              setActiveConfirm={setActiveConfirm}
              showAlertText={(_isOpen, text) =>
                showSafeAction(text || 'Действие с комментарием.')
              }
            />
          </View>
        ))}

        <View style={styles.graphPreview}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Модалки графика</Text>
          <Text style={[styles.sectionDescription, { color: colors.textMuted }]}>
            Настоящие шторки на локальных данных. Обжалование не вызывает API.
          </Text>
          <View style={styles.graphPreviewActions}>
            <Pressable
              accessibilityRole="button"
              style={[styles.previewButton, { backgroundColor: colors.brand }]}
              testID="preview-graph-order-error"
              onPress={() => setGraphErrorPreview('order')}
            >
              <Text style={styles.previewButtonText}>Ошибка по заказу</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={[styles.previewButton, { backgroundColor: colors.brand }]}
              testID="preview-graph-camera-error"
              onPress={() => setGraphErrorPreview('camera')}
            >
              <Text style={styles.previewButtonText}>Ошибка по камере</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.graphPreview}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Системное окно</Text>
          <Text style={[styles.sectionDescription, { color: colors.textMuted }]}>
            Обычное окно Android или iOS. Действий и запросов нет.
          </Text>
          <View style={styles.graphPreviewActions}>
            <Pressable
              accessibilityRole="button"
              style={[styles.previewButton, { backgroundColor: colors.brand }]}
              testID="preview-system-alert"
              onPress={() =>
                Alert.alert(
                  'Проверка системного окна',
                  'Это тестовое сообщение. Никаких действий не выполнено.',
                  [{ text: 'Понятно' }],
                )
              }
            >
              <Text style={styles.previewButtonText}>Показать системное окно</Text>
            </Pressable>
          </View>
        </View>

        <SafeAreaView edges={['bottom']} />
      </ScrollView>

      <OrderConfirmModal
        globalFontSize={globalFontSize}
        isOpen={confirm.isOpen}
        orderId={confirm.orderId}
        typeConfirm={confirm.type}
        onClose={() => setConfirm(CLOSED_CONFIRM_STATE)}
        onConfirm={() => {
          const orderId = confirm.orderId
          setConfirm(CLOSED_CONFIRM_STATE)
          showSafeAction(`Подтверждение для заказа ${orderId}.`)
        }}
      />

      <ModalErrOrder
        preview={{
          data: PREVIEW_ORDER_ERROR,
          isOpen: graphErrorPreview === 'order',
          onClose: () => setGraphErrorPreview(null),
          onSubmit: () => {
            setGraphErrorPreview(null)
            showSafeAction('Обжалование ошибки по заказу.')
          },
        }}
      />
      <ModalErrCam
        preview={{
          data: PREVIEW_CAMERA_ERROR,
          isOpen: graphErrorPreview === 'camera',
          onClose: () => setGraphErrorPreview(null),
          onSubmit: () => {
            setGraphErrorPreview(null)
            showSafeAction('Обжалование ошибки по камере.')
          },
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: appPalette.surface,
  },
  content: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  notice: {
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1C56B',
    borderRadius: 14,
    backgroundColor: '#FFF7DE',
  },
  noticeTitle: {
    marginBottom: 4,
    color: appPalette.text,
    fontFamily: 'Roboto-Bold',
    fontSize: 16,
    lineHeight: 22,
  },
  noticeText: {
    color: appPalette.textMuted,
    fontFamily: 'Roboto-Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    marginHorizontal: 20,
    marginTop: 18,
    color: appPalette.text,
    fontFamily: 'Roboto-Bold',
    fontSize: 17,
    lineHeight: 23,
  },
  sectionDescription: {
    marginHorizontal: 20,
    marginTop: 3,
    color: appPalette.textMuted,
    fontFamily: 'Roboto-Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  graphPreview: {
    marginTop: 12,
  },
  modalPreview: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderRadius: 16,
  },
  themeActions: { flexDirection: 'row', gap: 8 },
  themeButton: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeButtonText: { fontFamily: 'Roboto-Bold', fontSize: 14 },
  graphPreviewActions: {
    gap: 10,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  previewButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: appPalette.brand,
  },
  previewButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Roboto-Bold',
    fontSize: 15,
  },
})
