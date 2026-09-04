export const laravelApiRoutes = {
  auth: {
    tokenLogin: '/api/v1/auth/token/login',
    ssoExchange: '/api/v1/auth/sso/exchange',
    passwordRecoverySendCode: '/api/v1/auth/password/recovery/send-code',
    passwordRecoveryConfirmCode: '/api/v1/auth/password/recovery/confirm-code',
    me: '/api/v1/auth/me',
    logout: '/api/v1/auth/logout',
  },
  settings: {
    get: '/api/v1/settings/get',
    avgTime: '/api/v1/settings/avg-time',
    points: '/api/v1/settings/points',
    pointPhones: '/api/v1/settings/get_point_phones',
    savePosition: '/api/v1/settings/save-position',
    save: '/api/v1/settings/save',
  },
  feedback: {
    getFeedbacks: '/api/v1/feedback/get_feedbacks',
    saveFeedbacks: '/api/v1/feedback/save_feedbacks',
  },
  orders: {
    getOrders: '/api/v1/orders/get_orders',
    actionOrder: '/api/v1/orders/action_order',
    checkFakeOrder: '/api/v1/orders/check_fake_order',
    getPayQr: '/api/v1/orders/get_pay_qr',
    checkPayOrder: '/api/v1/orders/check_pay_order',
    hideDeletedOrders: '/api/v1/orders/hide_del_orders',
  },
  graph: {
    root: '/api/v1/graph',
    orderAppeals: '/api/v1/graph/order-appeals',
    cameraAppeals: '/api/v1/graph/camera-appeals',
  },
  price: {
    between: '/api/v1/price/between',
  },
  statistics: {
    showData: '/api/v1/statistics/show-data',
  },
} as const
