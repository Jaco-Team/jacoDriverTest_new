import { getOrderAddress } from '@/entities/CardOrder/model/getOrderAddress'

test.each([
  [{ addr: null, street: ' Улица ', home: ' 10 ' }, 'Улица, 10'],
  [{ street: 'Улица', home: 0 }, 'Улица, 0'],
  [{ street: null, home: '10' }, '10'],
  [{ street: 'Улица', home: null }, 'Улица'],
  [{ addr: '', street: null, home: null }, ''],
  [{ addr: ' Готовый адрес ', street: 'Улица', home: '10' }, 'Готовый адрес'],
])('адрес %p отображается как %p', (order, expected) => {
  expect(getOrderAddress(order)).toBe(expected)
})
