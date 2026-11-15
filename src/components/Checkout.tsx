import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useShop } from '../Shop';
import { money, placeOrder, resolveLine, setQuantity, type Order } from '../model';
import { quoteDelivery, type Quote } from '../delivery';
const DeliveryMap = lazy(() => import('./DeliveryMap').then(module => ({ default: module.DeliveryMap })));
import type { DeliveryPoint } from '../delivery-map';
import { Empty, Icon, Photo, Stepper } from './UI';
import { Account } from './Account';

export function Cart({ onCheckout, onCatalog }: { onCheckout: () => void; onCatalog: () => void }) {
  const { store, mutate } = useShop();
  if (!store.cart.length) return <Empty icon="shopping-cart" title="Здесь пока пусто"><p>Найдите всё, что нужно для вашего ремонта.</p><button className="button" onClick={onCatalog}>Перейти в каталог <Icon name="arrow-down-right" /></button></Empty>;
  const sum = store.cart.reduce((t, l) => t + (resolveLine(store, l)?.variant.price || 0) * l.quantity, 0);
  const invalid = store.cart.some(l => { const found = resolveLine(store, l); return !found || found.product.archived || found.variant.stock < l.quantity; });
  return <div className="cart-layout"><div className="cart-lines">{store.cart.map(line => {
    const found = resolveLine(store, line);
    return <div className="cart-line" key={line.productId + line.variantId}>{found ? <><Photo src={found.variant.thumbnail || found.variant.image} alt={found.product.name} /><div className="cart-line-name"><h3>{found.product.name}</h3><p>{found.variant.label}</p><small>Арт. {found.variant.sku}</small>{(found.product.archived || found.variant.stock < line.quantity) && <p className="field-error">{found.product.archived ? 'Товар больше не продаётся. Удалите его из корзины.' : `Осталось ${found.variant.stock} ${found.product.unit}. Уменьшите количество.`}</p>}</div><Stepper value={line.quantity} max={found.variant.stock} onChange={q => mutate(s => setQuantity(s, line.productId, line.variantId, q))} /><div className="cart-line-price"><strong>{money(found.variant.price * line.quantity)}</strong><small>{money(found.variant.price)} / {found.product.unit}</small></div></> : <p>Товар больше недоступен</p>}<button className="icon-button delete-button" onClick={() => mutate(s => setQuantity(s, line.productId, line.variantId, 0))} aria-label="Удалить товар из корзины"><Icon name="trash-2" size={19} /></button></div>;
  })}</div><aside className="order-summary"><h3>Ваш заказ</h3><div><span>Товары, {store.cart.reduce((s, l) => s + l.quantity, 0)} шт.</span><strong>{money(sum)}</strong></div><div><span>Доставка</span><span>На следующем шаге</span></div><div className="summary-total"><span>Итого</span><strong>{money(sum)}</strong></div><button className="button full-width" disabled={invalid} onClick={onCheckout}>Оформить заказ <Icon name="chevron-right" size={18} /></button><p className="fine-print">Это демо: оплата имитируется, деньги не списываются.</p></aside></div>;
}

export function Checkout({ onSuccess }: { onSuccess: (o: Order) => void }) {
  const { store, mutate, notify } = useShop(); const user = store.users.find(u => u.id === store.session);
  const [other, setOther] = useState(false);
  const [name, setName] = useState(user?.name || ''); const [phone, setPhone] = useState(user?.phone || ''); const [email, setEmail] = useState(user?.email || '');
  const [method, setMethod] = useState<'pickup' | 'delivery'>('pickup'); const [city, setCity] = useState(''); const [address, setAddress] = useState('');
  const [deliveryPoint, setDeliveryPoint] = useState<DeliveryPoint | null>(null); const [locating, setLocating] = useState(false);
  const [newsletter, setNewsletter] = useState(false); const [quote, setQuote] = useState<Quote | null>(null); const [quoting, setQuoting] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null); const paying = useRef(false); const actualCity = city;
  const subtotal = store.cart.reduce((t, l) => t + (resolveLine(store, l)?.variant.price || 0) * l.quantity, 0);
  useEffect(() => { setQuote(null); controller.current?.abort(); setQuoting(false); }, [city, address, deliveryPoint]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { if (!other && user) { setName(user.name); setPhone(user.phone); setEmail(user.email); } }, [other, user?.id]);
  const calculate = async () => {
    if (!deliveryPoint) { setError('Выберите адрес на карте Крыма.'); return; }
    if (!address.trim() || !actualCity.trim()) { setError('Укажите населённый пункт, улицу и дом.'); return; }
    controller.current?.abort(); const ac = new AbortController(); controller.current = ac;
    const timeout = setTimeout(() => ac.abort(), 9000); setQuoting(true); setError('');
    try { const q = await quoteDelivery(actualCity, address, ac.signal, deliveryPoint); if (!ac.signal.aborted) setQuote(q); }
    catch { if (controller.current === ac) setError('Расчёт не завершён. Попробуйте ещё раз.'); }
    finally { clearTimeout(timeout); if (controller.current === ac) setQuoting(false); }
  };
  const pay = async (e: React.FormEvent) => {
    e.preventDefault(); if (paying.current) return;
    if (method === 'delivery' && !deliveryPoint) { setError('Выберите адрес на карте Крыма.'); return; }
    if (method === 'delivery' && (!quote || quote.addressKey !== actualCity + '|' + address.trim())) { setError('Рассчитайте доставку для указанного адреса.'); return; }
    paying.current = true; setBusy(true); setError('');
    await new Promise(resolve => setTimeout(resolve, 700));
    const execute = () => {
      let created: Order | undefined;
      const ok = mutate(s => { const result = placeOrder(s, { customer: { name: name.trim(), phone: phone.trim(), email: email.trim().toLowerCase() }, method, city: method === 'pickup' ? 'Севастополь' : actualCity, address: method === 'pickup' ? 'ул. Шабалина, 8' : address.trim(), distance: method === 'pickup' ? 0 : quote!.distance, shipping: method === 'pickup' ? 0 : quote!.price, shippingSource: method === 'pickup' ? 'Самовывоз' : quote!.source, newsletter, ...(method === 'delivery' && deliveryPoint ? { deliveryPoint } : {}) }); created = result.order; return result.store; });
      if (ok && created) onSuccess(created); else { setError('Заказ не оформлен. Проверьте корзину и остатки.'); setBusy(false); paying.current = false; }
    };
    try { if (navigator.locks) await navigator.locks.request('centr-stroy-order', execute); else execute(); }
    catch { notify('Не удалось оформить заказ. Попробуйте ещё раз.'); setBusy(false); paying.current = false; }
  };
  if (!user) return <Account forceRegister checkout onSignedIn={() => {}} onOrders={() => {}} />;
  return <form onSubmit={pay} className="checkout-layout"><fieldset className="checkout-fields" disabled={busy}><section><div className="section-heading"><h3>Получатель</h3></div>{user && <label className="check"><input type="checkbox" checked={other} onChange={e => { setOther(e.target.checked); if (e.target.checked) { setName(''); setPhone(''); setEmail(''); } }} />Заказ для другого получателя</label>}<div className="form-grid"><label className="field full">Имя<input required autoComplete="name" maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Как к вам обращаться" /></label><label className="field">Телефон<input required type="tel" inputMode="tel" autoComplete="tel" minLength={10} maxLength={24} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (___) ___-__-__" /></label><label className="field">Email<input required type="email" autoComplete="email" maxLength={160} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label></div></section><section><h3>Как получить заказ</h3><div className="delivery-options"><label className={method === 'pickup' ? 'selected' : ''}><input type="radio" name="delivery" checked={method === 'pickup'} onChange={() => setMethod('pickup')} /><Icon name="package" size={26} /><strong>Самовывоз</strong><small>ул. Шабалина, 8</small><b>Бесплатно</b></label><label className={method === 'delivery' ? 'selected' : ''}><input type="radio" name="delivery" checked={method === 'delivery'} onChange={() => setMethod('delivery')} /><Icon name="truck" size={26} /><strong>Доставка</strong><small>Севастополь и весь Крым</small><b>2 ₽ / км · демо</b></label></div>{method === 'delivery' ? <div className="delivery-address"><Suspense fallback={<p role="status">Загружаем карту…</p>}><DeliveryMap value={deliveryPoint} onBusy={setLocating} onChange={result => { setDeliveryPoint(result?.point || null); setCity(result?.city || ''); setAddress(result?.address || ''); setQuote(null); setError(''); }} /></Suspense><label className="field">Населённый пункт<input readOnly value={city} placeholder="Выберите точку на карте" /></label><label className="field">Адрес доставки<input required autoComplete="street-address" value={address} onChange={e => setAddress(e.target.value)} placeholder="Улица, дом, квартира или ориентир" maxLength={240} /></label><button type="button" className="button button-secondary" disabled={quoting || locating || !deliveryPoint} onClick={calculate}><Icon name="map-pin" size={18} />{quoting ? 'Считаем маршрут…' : 'Рассчитать доставку'}</button>{quote && <div className="delivery-quote"><strong>{quote.distance} км · {money(quote.price)}</strong><p>{quote.source === 'Условный расчёт' ? 'Условное расстояние до населённого пункта. Точный адрес не учитывается; тариф демонстрационный.' : 'Расстояние по маршруту OpenRouteService. Тариф 2 ₽/км — демонстрационный.'}</p>{quote.source !== 'Условный расчёт' && <small>© OpenStreetMap contributors · OpenRouteService / HeiGIT</small>}</div>}</div> : <p className="muted pickup-note"><Icon name="map-pin" size={18} />Севастополь, ул. Шабалина, 8. После оформления заказ появится в демо админке.</p>}</section><label className="check newsletter"><input type="checkbox" checked={newsletter} onChange={e => setNewsletter(e.target.checked)} />Хочу получать новости и предложения по email</label><p className="fine-print">Используйте вымышленные контакты. Это демонстрация: письма и SMS не отправляются.</p></fieldset><aside className="order-summary checkout-summary"><h3>Итого к оплате</h3><div><span>Товары</span><strong>{money(subtotal)}</strong></div><div><span>{method === 'pickup' ? 'Самовывоз' : 'Доставка'}</span><strong>{method === 'pickup' ? 'Бесплатно' : quote ? money(quote.price) : 'Нужен расчёт'}</strong></div><div className="summary-total"><span>Итого</span><strong>{money(subtotal + (method === 'delivery' ? quote?.price || 0 : 0))}</strong></div>{error && <p className="field-error" role="alert">{error}</p>}<button className="button full-width" type="submit" disabled={busy || quoting || locating || !store.cart.length || (method === 'delivery' && !deliveryPoint)}>{busy ? 'Оформляем заказ…' : 'Оплатить демо'}{!busy && <Icon name="chevron-right" size={19} />}</button><p className="fine-print">Ввод карты не требуется.<br />Деньги не списываются.</p></aside></form>;
}

export function OrderSuccess({ order, onOrders, onCatalog }: { order: Order; onOrders: () => void; onCatalog: () => void }) {
  return <div className="order-success"><div className="success-mark"><Icon name="check" size={40} /></div><h3>Всё готово.<br />Заказ {order.number} оформлен</h3><p className="muted">Демо оплата прошла успешно. Деньги не списывались.</p><div className="success-receipt"><div><span>Сумма</span><strong>{money(order.total)}</strong></div><div><span>Получение</span><strong>{order.method === 'pickup' ? 'Самовывоз' : 'Доставка'}</strong></div><div><span>Адрес</span><strong>{order.city}, {order.address}</strong></div><div><span>Получатель</span><strong>{order.customer.name}</strong></div></div><details className="information-section"><summary>Состав заказа <Icon name="chevron-down" size={18} /></summary>{order.lines.map(l => <p key={l.variantId}>{l.name} · {l.label} × {l.quantity} — {money(l.price * l.quantity)}</p>)}</details><button className="button full-width" onClick={onOrders}>Мои заказы</button><button className="text-button" onClick={onCatalog}>Продолжить покупки <Icon name="arrow-down-right" size={18} /></button></div>;
}
