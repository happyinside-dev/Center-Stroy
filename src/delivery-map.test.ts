import { describe, expect, it, vi } from 'vitest';
import { isDeliveryPoint, reverseDeliveryAddress } from './delivery-map';
import { quoteDelivery } from './delivery';
import { initialStore, placeOrder, setQuantity } from './model';

const yalta = { lat: 44.495, lng: 34.166 };
describe('Зона доставки', () => {
  it.each([
    ['Севастополь', 44.60, 33.53], ['Симферополь', 44.95, 34.10], ['Ялта', 44.495, 34.166],
    ['Керчь', 45.356, 36.468], ['Армянск', 46.109, 33.692], ['Евпатория', 45.20, 33.36],
  ])('разрешает %s', (_name, lat, lng) => expect(isDeliveryPoint({ lat, lng })).toBe(true));
  it.each([
    ['море внутри прямоугольника', 44.4, 35], ['Тамань', 45.218, 36.72], ['Херсон', 46.635, 32.617],
    ['море на западе', 45.0, 32.5], ['NaN', NaN, 34],
  ])('не разрешает %s', (_name, lat, lng) => expect(isDeliveryPoint({ lat, lng })).toBe(false));
  it('блокирует доставку за пределы Крыма в модели заказа', () => {
    let s = initialStore(); const p = s.products[0]; s = setQuantity(s, p.id, p.variants[0].id, 1);
    s.users = [{ id: 'buyer', name: 'Покупатель', phone: '+79001234567', email: 'buyer@example.com', hash: '', salt: '', newsletter: false }]; s.session = 'buyer';
    const details = { customer: s.users[0], method: 'delivery' as const, city: 'Крым', address: 'Улица, 1', distance: 100, shipping: 200, shippingSource: 'Условный расчёт', newsletter: false };
    for (const deliveryPoint of [undefined, { lat: 44.4, lng: 35 }]) {
      expect(() => placeOrder(s, { ...details, deliveryPoint })).toThrow(/карте Крыма/);
    }
    expect(s.orders).toHaveLength(0); expect(s.cart).toHaveLength(1);
  });
});

describe('Адрес выбранной точки', () => {
  it('подставляет улицу и дом, сохраняя точную выбранную координату', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [{ geometry: { coordinates: [34.1661, 44.4951] }, properties: { city: 'Ялта', street: 'Тестовая улица', housenumber: '12' } }] }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const result = await reverseDeliveryAddress(yalta, new AbortController().signal);
      expect(result).toEqual({ point: yalta, city: 'Ялта', address: 'Тестовая улица, 12' });
      await reverseDeliveryAddress(yalta, new AbortController().signal);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); }
  });
  it('не запрашивает адрес в море', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    try { await expect(reverseDeliveryAddress({ lat: 44.4, lng: 35 }, new AbortController().signal)).rejects.toThrow(/Крыма/); expect(fetchMock).not.toHaveBeenCalled(); }
    finally { vi.unstubAllGlobals(); }
  });
  it('не подставляет далёкий адрес от геокодера', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [{ geometry: { coordinates: [36.468, 45.356] }, properties: { city: 'Керчь', street: 'Другая улица' } }] }) }));
    try { await expect(reverseDeliveryAddress({ lat: 44.95, lng: 34.1 }, new AbortController().signal)).rejects.toThrow(/не найден/); }
    finally { vi.unstubAllGlobals(); }
  });
  it('передаёт выбранную точку маршрутизатору без повторного поиска адреса', async () => {
    vi.stubEnv('VITE_ORS_API_KEY', 'test');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [{ properties: { summary: { distance: 86000 } } }] }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      expect((await quoteDelivery('Ялта', 'Тестовая улица, 12', new AbortController().signal, yalta)).price).toBe(172);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('end')).toBe('34.166,44.495');
    } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs(); }
  });
});
