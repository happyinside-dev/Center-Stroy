import { describe, expect, it, vi } from 'vitest';
import { changeStatus, initialStore, passwordHash, placeOrder, setQuantity, type Store } from './model';
import { emptyFilters, filterProducts, matchingVariants } from './components/Filters';
import { quoteDelivery } from './delivery';

const details = { customer: { name: 'Тестовый покупатель', phone: '+7 900 123-45-67', email: 'test@example.com' }, method: 'pickup' as const, city: 'Севастополь', address: 'ул. Шабалина, 8', distance: 0, shipping: 0, shippingSource: 'Самовывоз', newsletter: false };
function basket(): Store { const s = initialStore(); s.users.push({ id: 'buyer', ...details.customer, hash: '', salt: '', newsletter: false }); s.session = 'buyer'; const p = s.products[0]; return setQuantity(s, p.id, p.variants[0].id, 2); }

describe('Корзина и остатки', () => {
  it('не разрешает дробное, отрицательное количество и превышение остатка', () => {
    const s = initialStore(); const p = s.products[0]; const v = p.variants[0];
    for (const n of [-1, .5, Infinity, v.stock + 1]) expect(() => setQuantity(s, p.id, v.id, n)).toThrow();
  });
  it('удаляет строку при нуле и не создаёт дубли при изменении', () => {
    const s = basket(); const l = s.cart[0]; const next = setQuantity(s, l.productId, l.variantId, 1);
    expect(next.cart).toHaveLength(1); expect(next.cart[0].quantity).toBe(1);
    expect(setQuantity(next, l.productId, l.variantId, 0).cart).toHaveLength(0);
  });
  it('сохраняет независимые количества разных вариантов', () => {
    const s = initialStore(); const p = s.products.find(p => p.variants.length > 1)!;
    const result = setQuantity(setQuantity(s, p.id, p.variants[0].id, 1), p.id, p.variants[1].id, 2);
    expect(result.cart.map(l => l.quantity)).toEqual([1, 2]);
  });
});

describe('Оформление и отмена заказа', () => {
  it.each([null, 'missing-user'])('не оформляет заказ без действующего аккаунта (%s)', session => {
    const s = basket(); s.session = session;
    const before = structuredClone(s);
    expect(() => placeOrder(s, details)).toThrow(/войдите или зарегистрируйтесь/);
    expect(s).toEqual(before);
  });
  it('привязывает заказ к аккаунту даже при другом получателе', () => {
    const s = basket();
    const { order } = placeOrder(s, { ...details, customer: { ...details.customer, email: 'recipient@example.com' } });
    expect(order.userId).toBe(s.session);
    expect(order.customer.email).toBe('recipient@example.com');
  });
  it('списывает остаток, очищает корзину и сохраняет неизменяемый снимок', () => {
    const s = basket(); const stock = s.products[0].variants[0].stock;
    const { store, order } = placeOrder(s, details);
    expect(store.cart).toHaveLength(0); expect(store.products[0].variants[0].stock).toBe(stock - 2);
    expect(s.products[0].variants[0].stock).toBe(stock); expect(order.total).toBe(order.lines[0].price * 2);
    store.products[0].name = 'Другое название'; store.products[0].variants[0].price = 1;
    expect(order.lines[0].name).not.toBe('Другое название'); expect(order.lines[0].price).not.toBe(1);
  });
  it('проверяет изменившиеся остатки до оформления без частичного списания', () => {
    const s = basket(); s.products[0].variants[0].stock = 1;
    expect(() => placeOrder(s, details)).toThrow(/Остаток/); expect(s.orders).toHaveLength(0); expect(s.products[0].variants[0].stock).toBe(1);
  });
  it('не оформляет архивный товар и не принимает повторную пустую корзину', () => {
    const s = basket(); s.products[0].archived = true; expect(() => placeOrder(s, details)).toThrow();
    const { store } = placeOrder(basket(), details); expect(() => placeOrder(store, details)).toThrow(/пуста/);
  });
  it('возвращает остатки только один раз и не возобновляет отменённый заказ', () => {
    const s = basket(); const initial = s.products[0].variants[0].stock; const { store, order } = placeOrder(s, details);
    const cancelled = changeStatus(store, order.id, 'cancelled');
    expect(cancelled.products[0].variants[0].stock).toBe(initial);
    expect(changeStatus(cancelled, order.id, 'cancelled').products[0].variants[0].stock).toBe(initial);
    expect(() => changeStatus(cancelled, order.id, 'new')).toThrow();
  });
  it('учитывает доставку и отказывает при неверном тарифе', () => {
    const d = { ...details, method: 'delivery' as const, city: 'Ялта', address: 'Тестовый адрес, 1', distance: 86, shipping: 172, deliveryPoint: { lat: 44.495, lng: 34.166 } };
    expect(placeOrder(basket(), d).order.total).toBe(placeOrder(basket(), details).order.total + 172);
    expect(() => placeOrder(basket(), { ...d, shipping: -1 })).toThrow();
  });
  it('не позволяет назначить выдачу заказу с доставкой', () => {
    const { store, order } = placeOrder(basket(), details);
    expect(() => changeStatus(store, order.id, 'delivery')).toThrow();
  });
});

describe('Поиск и варианты', () => {
  it('применяет цену, наличие и запрос к одной комбинации, а не разным вариантам', () => {
    const s = initialStore(); const p = structuredClone(s.products[0]);
    p.variants = [{ ...p.variants[0], label: 'Белый 2 л', price: 100, stock: 0, specs: [['Цвет', 'Белый']] }, { ...p.variants[0], id: 'other', label: 'Синий 5 л', price: 500, stock: 10, specs: [['Цвет', 'Синий']] }];
    expect(filterProducts([p], 'Белый', { ...emptyFilters(), available: true })).toHaveLength(0);
    expect(filterProducts([p], 'Синий', { ...emptyFilters(), max: '200' })).toHaveLength(0);
    expect(matchingVariants(p, 'Синий', { ...emptyFilters(), available: true })[0].price).toBe(500);
  });
  it('находит артикул без учёта регистра и исключает архив', () => {
    const s = initialStore(); const p = s.products[0];
    expect(filterProducts(s.products, p.variants[0].sku.toLowerCase(), emptyFilters())).toContain(p);
    p.archived = true; expect(filterProducts(s.products, p.variants[0].sku, emptyFilters())).not.toContain(p);
  });
});

it('хеширует тестовый пароль с солью, а не хранит его текстом', async () => {
  const hash = await passwordHash('demo-password', 'salt-one');
  expect(hash).toHaveLength(64); expect(hash).toBe(await passwordHash('demo-password', 'salt-one'));
  expect(hash).not.toBe(await passwordHash('demo-password', 'salt-two'));
});

it('позволяет рассчитать демонстрационную доставку без API-ключа и бэкенда', async () => {
  vi.stubEnv('VITE_ORS_API_KEY', '');
  try { const q = await quoteDelivery('Ялта', 'Тестовая улица, 1', new AbortController().signal);
    expect(q.source).toBe('Условный расчёт'); expect(q.price).toBe(q.distance * 2); expect(q.addressKey).toContain('Ялта');
  } finally { vi.unstubAllEnvs(); }
});

it('использует новые конечные точки HeiGIT и расстояние по автомобильному маршруту', async () => {
  vi.stubEnv('VITE_ORS_API_KEY', 'test-key'); vi.stubEnv('VITE_ORS_BASE_URL', 'https://api.heigit.org');
  const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ features: [{ geometry: { coordinates: [34.16, 44.49] } }] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ features: [{ properties: { summary: { distance: 86123 } } }] }) });
  vi.stubGlobal('fetch', fetchMock);
  try {
    const q = await quoteDelivery('Ялта', 'Тестовая улица, 1', new AbortController().signal);
    expect(String(fetchMock.mock.calls[0][0])).toContain('api.heigit.org/pelias/v1/search');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/openrouteservice/v2/directions/driving-car');
    expect(q).toMatchObject({ source: 'Маршрут OpenRouteService', distance: 87, price: 174 });
  } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs(); }
});

it('при недоступном API явно возвращает условный расчёт', async () => {
  vi.stubEnv('VITE_ORS_API_KEY', 'test-key'); vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
  try { expect((await quoteDelivery('Ялта', 'Тестовый адрес', new AbortController().signal)).source).toBe('Условный расчёт'); }
  finally { vi.unstubAllGlobals(); vi.unstubAllEnvs(); }
});
