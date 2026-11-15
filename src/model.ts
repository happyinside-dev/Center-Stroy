import catalog from './data/catalog.json';
import { isDeliveryPoint, type DeliveryPoint } from './delivery-map';

export type Variant = { id: string; sku: string; label: string; price: number; stock: number; image: string; thumbnail: string; specs: string[][] };
export type Product = { id: string; name: string; brand: string; model: string; category: string; description: string; warning: string; source: string; originalName: string; gallery?: string[]; variants: Variant[]; archived: boolean; featured: boolean; unit: string };
export type CartLine = { productId: string; variantId: string; quantity: number };
export type User = { id: string; name: string; phone: string; email: string; hash: string; salt: string; newsletter: boolean };
export type Status = 'new' | 'assembling' | 'ready' | 'delivery' | 'complete' | 'cancelled';
export type OrderLine = CartLine & { name: string; label: string; sku: string; image: string; price: number; unit: string };
export type Order = { id: string; number: string; date: string; userId: string | null; customer: { name: string; phone: string; email: string }; method: 'pickup' | 'delivery'; deliveryPoint?: DeliveryPoint; address: string; city: string; distance: number; shipping: number; shippingSource: string; newsletter: boolean; lines: OrderLine[]; status: Status; total: number };
export type Store = { version: 1; products: Product[]; cart: CartLine[]; users: User[]; session: string | null; orders: Order[] };
export const categories = catalog.categories;
export const STORE_KEY = 'centr-stroy-demo-v1';
export const statuses: Record<Status, string> = { new: 'Новый', assembling: 'Собирается', ready: 'Готов к выдаче', delivery: 'Передан в доставку', complete: 'Завершён', cancelled: 'Отменён' };
export const money = (value: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value);
export const asset = (path: string) => /^(https?:|blob:|data:)/.test(path) ? path : `${import.meta.env.BASE_URL}${path}`;
export const initialStore = (): Store => ({ version: 1, products: structuredClone(catalog.products) as Product[], cart: [], users: [], session: null, orders: [] });

export function readStore(): Store {
  const data = localStorage.getItem(STORE_KEY);
  if (!data) return initialStore();
  try {
    const s = JSON.parse(data);
    if (s.version !== 1 || !Array.isArray(s.products) || !Array.isArray(s.cart) || !Array.isArray(s.users) || !Array.isArray(s.orders)) throw new Error('version');
    return s;
  } catch { throw new Error('Не удалось прочитать сохранённые данные. Можно скачать их копию и сбросить демо.'); }
}

export function resolveLine(s: Store, line: CartLine) {
  const product = s.products.find(p => p.id === line.productId);
  const variant = product?.variants.find(v => v.id === line.variantId);
  return product && variant ? { product, variant } : null;
}

export function setQuantity(s: Store, productId: string, variantId: string, quantity: number): Store {
  if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error('Количество должно быть целым положительным числом.');
  const line = { productId, variantId, quantity };
  const found = resolveLine(s, line);
  if (quantity && (!found || found.product.archived)) throw new Error('Этот товар больше не продаётся. Уберите его из корзины.');
  if (quantity && quantity > found!.variant.stock) throw new Error(`В наличии только ${found!.variant.stock} ${found!.product.unit}`);
  const cart = s.cart.filter(l => l.productId !== productId || l.variantId !== variantId);
  if (quantity) cart.push(line);
  return { ...s, cart };
}

export function placeOrder(s: Store, details: Omit<Order, 'id' | 'number' | 'date' | 'userId' | 'lines' | 'status' | 'total'>): { store: Store; order: Order } {
  const user = s.users.find(u => u.id === s.session);
  if (!user) throw new Error('Для оформления заказа войдите или зарегистрируйтесь.');
  if (!s.cart.length) throw new Error('Корзина пуста.');
  if (!details.customer.name.trim() || details.customer.phone.replace(/\D/g, '').length < 10 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.customer.email)) throw new Error('Проверьте имя, телефон и email.');
  if (details.method === 'delivery' && (!details.deliveryPoint || !isDeliveryPoint(details.deliveryPoint))) throw new Error('Выберите адрес на карте Крыма.');
  if (details.method === 'delivery' && (!details.city || !details.address.trim() || !Number.isFinite(details.distance) || details.distance < 0 || details.shipping !== Math.ceil(details.distance * 2))) throw new Error('Укажите адрес и пересчитайте доставку.');
  const seen = new Set<string>();
  const lines = s.cart.map(line => {
    const key = line.productId + ':' + line.variantId;
    if (seen.has(key)) throw new Error('В корзине обнаружен дубль. Обновите её.');
    seen.add(key);
    const found = resolveLine(s, line);
    if (!found || found.product.archived) throw new Error('Один из товаров больше не продаётся. Обновите корзину.');
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0 || found.variant.stock < line.quantity) throw new Error(`Остаток «${found.product.name}» изменился. Проверьте количество.`);
    if (!Number.isFinite(found.variant.price) || found.variant.price < 0) throw new Error('Некорректная цена товара.');
    return { ...line, name: found.product.name, label: found.variant.label, sku: found.variant.sku, image: found.variant.image, price: found.variant.price, unit: found.product.unit };
  });
  const shipping = details.method === 'pickup' ? 0 : details.shipping;
  const order: Order = { ...details, shipping, id: crypto.randomUUID(), number: `ЦС-${String(s.orders.length + 1).padStart(5, '0')}`, date: new Date().toISOString(), userId: user.id, lines, status: 'new', total: lines.reduce((total, l) => total + l.price * l.quantity, shipping) };
  const products = s.products.map(p => ({ ...p, variants: p.variants.map(v => ({ ...v, stock: v.stock - (lines.find(l => l.productId === p.id && l.variantId === v.id)?.quantity || 0) })) }));
  return { store: { ...s, products, cart: [], orders: [order, ...s.orders] }, order };
}

export function changeStatus(s: Store, id: string, status: Status): Store {
  const order = s.orders.find(o => o.id === id);
  if (!order) throw new Error('Заказ не найден.');
  if (order.status === status) return s;
  if (order.status === 'cancelled' || order.status === 'complete') throw new Error('Завершённый или отменённый заказ нельзя менять.');
  if (status === 'ready' && order.method === 'delivery' || status === 'delivery' && order.method === 'pickup') throw new Error('Статус не соответствует способу получения.');
  const products = status !== 'cancelled' ? s.products : s.products.map(p => ({ ...p, variants: p.variants.map(v => ({ ...v, stock: v.stock + (order.lines.find(l => l.productId === p.id && l.variantId === v.id)?.quantity || 0) })) }));
  return { ...s, products, orders: s.orders.map(o => o.id === id ? { ...o, status } : o) };
}

export async function passwordHash(password: string, salt: string) {
  const bytes = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', bytes.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: bytes.encode(salt), iterations: 100000 }, key, 256);
  return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, '0')).join('');
}
