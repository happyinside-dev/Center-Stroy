import { useState } from 'react';
import { useShop } from '../Shop';
import { money, passwordHash, statuses, type Order, type User } from '../model';
import { Empty, Icon, Photo } from './UI';

export function Account({ onOrders, onSignedIn, guestOrder, forceRegister = false }: { onOrders: () => void; onSignedIn: () => void; guestOrder?: Order; forceRegister?: boolean }) {
  const { store, mutate, notify } = useShop(); const user = store.users.find(u => u.id === store.session);
  const [register, setRegister] = useState(forceRegister); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [show, setShow] = useState(false);
  const [name, setName] = useState(user?.name || guestOrder?.customer.name || ''); const [phone, setPhone] = useState(user?.phone || guestOrder?.customer.phone || ''); const [email, setEmail] = useState(user?.email || guestOrder?.customer.email || ''); const [password, setPassword] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const normalized = email.trim().toLowerCase();
      if (user) {
        if (phone.replace(/\D/g, '').length < 10) throw new Error('Введите телефон с кодом города или оператора.');
        const ok = mutate(s => { if (s.users.some(u => u.email === normalized && u.id !== user.id)) throw new Error('Этот email уже занят.'); return { ...s, users: s.users.map(u => u.id === user.id ? { ...u, name: name.trim(), phone: phone.trim(), email: normalized } : u) }; });
        if (ok) notify('Контакты сохранены.'); return;
      }
      if (register) {
        if (name.trim().length < 2 || phone.replace(/\D/g, '').length < 10) throw new Error('Укажите имя и корректный телефон.');
        if (password.length < 8) throw new Error('Тестовый пароль должен содержать не менее 8 символов.');
        const salt = crypto.randomUUID(); const hash = await passwordHash(password, salt);
        const account: User = { id: crypto.randomUUID(), name: name.trim(), phone: phone.trim(), email: normalized, salt, hash, newsletter: false };
        if (mutate(s => { if (s.users.some(u => u.email === normalized)) throw new Error('Аккаунт с таким email уже есть. Перейдите ко входу.'); return { ...s, users: [...s.users, account], session: account.id, orders: s.orders.map(o => guestOrder && o.id === guestOrder.id && !o.userId && o.customer.email === normalized ? { ...o, userId: account.id } : o) }; })) onSignedIn();
      } else {
        const account = store.users.find(u => u.email === normalized);
        if (!account || await passwordHash(password, account.salt) !== account.hash) throw new Error('Неверный email или пароль.');
        if (mutate(s => ({ ...s, session: account.id }))) onSignedIn();
      }
    } catch (e) { setError((e as Error).message || 'Вход не удался. Для локальных аккаунтов нужен localhost или HTTPS.'); }
    finally { setBusy(false); }
  };
  return <div className="account-panel">{user ? <><div className="profile-intro"><div className="profile-avatar">{user.name.slice(0, 1).toUpperCase()}</div><div><h3>{user.name}</h3><p className="muted">Ваш аккаунт в этом браузере</p></div></div><button className="button button-secondary full-width" onClick={onOrders}><Icon name="package" />Мои заказы <Icon name="chevron-right" size={18} /></button></> : <><div className="auth-tabs"><button className={!register ? 'active' : ''} onClick={() => { setRegister(false); setError(''); }}>Войти</button><button className={register ? 'active' : ''} onClick={() => { setRegister(true); setError(''); }}>Зарегистрироваться</button></div><h3>{register ? 'Соберём всё для ремонта' : 'С возвращением'}</h3><p className="muted">{register ? 'Сохраним контакты и историю ваших заказов.' : 'Войдите, чтобы увидеть заказы и оформить покупку быстрее.'}</p></>}<form onSubmit={submit}><fieldset disabled={busy}>{(register || user) && <><label className="field">Имя<input required minLength={2} maxLength={80} autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Ваше имя" /></label><label className="field">Телефон<input required type="tel" minLength={10} maxLength={24} autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (___) ___-__-__" /></label></>}<label className="field">Email<input required type="email" maxLength={160} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>{!user && <label className="field">Тестовый пароль<div className="password-field"><input required minLength={register ? 8 : 1} maxLength={120} type={show ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={register ? 'Не менее 8 символов' : 'Ваш тестовый пароль'} /><button type="button" className="icon-button" aria-label={show ? 'Скрыть пароль' : 'Показать пароль'} onClick={() => setShow(!show)}><Icon name={show ? 'eye-off' : 'eye'} size={19} /></button></div></label>}{error && <p className="field-error" role="alert">{error}</p>}<button className="button full-width" type="submit" disabled={busy}>{busy ? 'Подождите…' : user ? 'Сохранить контакты' : register ? 'Создать аккаунт' : 'Войти'}<Icon name="chevron-right" size={18} /></button></fieldset></form>{user && <button className="text-button sign-out" onClick={() => { mutate(s => ({ ...s, session: null })); onSignedIn(); }}><Icon name="log-out" size={18} />Выйти из аккаунта</button>}<p className="fine-print">Демо аккаунты хранятся только в этом браузере. Используйте вымышленные контакты и пароль, который не используете на других сайтах.</p></div>;
}

export function Orders({ onLogin, onCatalog }: { onLogin: () => void; onCatalog: () => void }) {
  const { store } = useShop();
  if (!store.session) return <Empty icon="user-round" title="Войдите, чтобы увидеть заказы"><p>История покупок хранится в вашем локальном аккаунте.</p><button className="button" onClick={onLogin}>Войти или зарегистрироваться</button></Empty>;
  const orders = store.orders.filter(o => o.userId === store.session);
  if (!orders.length) return <Empty title="Пока ни одного заказа"><p>Самое время выбрать всё для вашего следующего проекта.</p><button className="button" onClick={onCatalog}>Перейти в каталог</button></Empty>;
  return <div className="orders-list"><p className="muted">История доступна в этом браузере. Статусы меняются в демо админке.</p>{orders.map(o => <OrderDetails key={o.id} order={o} />)}</div>;
}
export function OrderDetails({ order, children }: { order: Order; children?: React.ReactNode }) {
  return <details className="order-card"><summary><div><strong>{order.number}</strong><small>{new Date(order.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</small></div><span className={`status status-${order.status}`}>{statuses[order.status]}</span><b>{money(order.total)}</b><Icon name="chevron-down" size={18} /></summary><div className="order-card-body">{order.lines.map(l => <div className="order-item" key={l.productId + l.variantId}><Photo src={l.image} alt={l.name} /><div><strong>{l.name}</strong><small>{l.label} · {l.quantity} {l.unit}</small></div><b>{money(l.price * l.quantity)}</b></div>)}<dl className="specs"><div><dt>Получатель</dt><dd>{order.customer.name}</dd></div><div><dt>Телефон</dt><dd>{order.customer.phone}</dd></div><div><dt>Email</dt><dd>{order.customer.email}</dd></div><div><dt>Получение</dt><dd>{order.method === 'pickup' ? 'Самовывоз' : 'Доставка'} · {order.city}, {order.address}</dd></div><div><dt>Стоимость доставки</dt><dd>{money(order.shipping)} · {order.shippingSource}</dd></div><div><dt>Оплата</dt><dd>Демо оплата · деньги не списаны</dd></div></dl>{children}</div></details>;
}
