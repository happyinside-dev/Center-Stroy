import { useEffect, useState } from 'react';
import { useShop } from '../Shop';
import { money, setQuantity, type Product, type Variant } from '../model';
import { Empty, Icon, Photo, Stepper } from './UI';

export function Buy({ product, variant, onCart, onChoose, compact = false }: { product: Product; variant?: Variant; onCart: () => void; onChoose: () => void; compact?: boolean }) {
  const { store, mutate } = useShop();
  const lines = store.cart.filter(l => l.productId === product.id);
  const amount = variant ? lines.find(l => l.variantId === variant.id)?.quantity || 0 : lines.reduce((sum, l) => sum + l.quantity, 0);
  const stock = variant?.stock ?? product.variants.reduce((sum, v) => sum + v.stock, 0);
  const v = variant || (product.variants.length === 1 ? product.variants[0] : undefined);
  const add = () => { if (v) mutate(s => setQuantity(s, product.id, v.id, amount + 1)); else onChoose(); };
  return <div className={`buy ${compact ? 'buy-compact' : ''}`}>{amount ? <>{v ? <Stepper value={amount} max={v.stock} onChange={q => mutate(s => setQuantity(s, product.id, v.id, q))} /> : <button className="button button-outline added" onClick={onChoose}>В корзине: {amount} {product.unit}</button>}<button className="button cart-shortcut" aria-label="Открыть корзину" onClick={onCart}><Icon name="shopping-cart" size={21} /></button></> : <button className="button" disabled={!stock || product.archived} onClick={add}>{stock ? 'Добавить в корзину' : 'Нет в наличии'}{!compact && stock > 0 && <Icon name="plus" size={19} />}</button>}</div>;
}

export function ProductCard({ product, variants = product.variants, onOpen, onChoose, onCart }: { product: Product; variants?: Variant[]; onOpen: () => void; onChoose: () => void; onCart: () => void }) {
  const min = Math.min(...variants.map(v => v.price)); const v = variants.find(v => v.stock > 0) || variants[0];
  const stock = variants.reduce((s, v) => s + v.stock, 0);
  return <article className="product-card"><button className="product-photo" onClick={onOpen} aria-label={`Подробнее: ${product.name}`}><Photo src={v.thumbnail || v.image} alt={product.name} /><span className="photo-arrow"><Icon name="external-link" size={16} /></span></button><div className="card-body"><p className="product-brand">{product.brand}<span>{product.variants.length > 1 ? `${product.variants.length} варианта` : product.model}</span></p><button className="product-name" onClick={onOpen}>{product.name}</button><div className={`stock ${stock === 0 ? 'stock-none' : stock <= 3 ? 'stock-low' : ''}`}><span />{stock === 0 ? 'Нет в наличии' : stock <= 3 ? `Осталось ${stock} ${product.unit}` : 'В наличии'}</div><div className="product-price">{product.variants.length > 1 && <small>от </small>}{money(min)}<span> / {product.unit}</span></div><Buy product={product} compact onCart={onCart} onChoose={onChoose} /></div></article>;
}

export function VariantPicker({ product, onCart, onDetails }: { product: Product; onCart: () => void; onDetails: () => void }) {
  const { store, mutate } = useShop();
  return <div className="variant-picker"><div className="variant-intro"><Photo src={product.variants[0].thumbnail} alt={product.name} /><div><p className="muted">{product.brand}</p><h3>{product.name}</h3><button className="text-button" onClick={onDetails}>Подробнее о товаре <Icon name="chevron-right" size={16} /></button></div></div><p className="muted">Выберите вариант. Количество каждого можно изменить отдельно.</p><div className="variant-list">{product.variants.map(v => {
    const count = store.cart.find(l => l.productId === product.id && l.variantId === v.id)?.quantity || 0;
    return <div className="variant-row" key={v.id}><Photo src={v.thumbnail || v.image} alt={v.label} /><div><strong>{v.label}</strong><small>Арт. {v.sku} · {v.stock ? `${v.stock} ${product.unit} в наличии` : 'Нет в наличии'}</small><b>{money(v.price)}</b></div>{count ? <Stepper value={count} max={v.stock} onChange={q => mutate(s => setQuantity(s, product.id, v.id, q))} /> : <button className="button small-button" disabled={!v.stock} onClick={() => mutate(s => setQuantity(s, product.id, v.id, 1))}><Icon name="plus" size={18} /><span>Добавить</span></button>}</div>;
  })}</div><button className="button full-width" onClick={onCart}>Перейти в корзину <Icon name="shopping-cart" /></button></div>;
}

export function ProductDetails({ product, initialVariant, onCart }: { product: Product; initialVariant?: string; onCart: () => void }) {
  const [selected, setSelected] = useState(initialVariant || product.variants.find(v => v.stock > 0)?.id || product.variants[0].id);
  const variant = product.variants.find(v => v.id === selected) || product.variants[0];
  const [photo, setPhoto] = useState(variant.image);
  useEffect(() => setPhoto(variant.image), [variant.id, variant.image]);
  const gallery = Array.from(new Set([...product.variants.map(v => v.image), ...(product.gallery || [])]));
  if (product.archived) return <Empty title="Товар снят с продажи"><p>Посмотрите другие товары в каталоге.</p></Empty>;
  return <div className="product-details-shell"><div className="product-details"><div className="product-gallery"><Photo src={photo} alt={product.name + ', ' + variant.label} eager /><div className="gallery-thumbs">{gallery.map((image, i) => { const v = product.variants.find(v => v.image === image); return <button key={image} className={image === photo ? 'active' : ''} onClick={() => { if (v) setSelected(v.id); setPhoto(image); }} aria-label={v?.label || `Фотография ${i + 1}`}><Photo src={v?.thumbnail || image} alt={v?.label || product.name} /></button>; })}</div></div><div className="product-information"><p className="muted">{product.brand} · Артикул {variant.sku}</p><h3>{product.name}</h3><p className="product-description">{product.description}</p>{product.variants.length > 1 && <fieldset className="variant-options"><legend>Вариант</legend>{product.variants.map(v => <button key={v.id} aria-pressed={v.id === selected} className={v.id === selected ? 'selected' : ''} onClick={() => setSelected(v.id)}>{v.label}{!v.stock && <small>Нет в наличии</small>}</button>)}</fieldset>}<p className={`stock ${!variant.stock ? 'stock-none' : ''}`}><span />{variant.stock ? `${variant.stock} ${product.unit} в наличии` : 'Нет в наличии'}</p><details className="information-section" open><summary>Характеристики <Icon name="chevron-down" size={18} /></summary><dl className="specs">{variant.specs.map(([key, val], i) => <div key={key + i}><dt>{key}</dt><dd>{val}</dd></div>)}</dl></details><details className="information-section"><summary>Описание и применение <Icon name="chevron-down" size={18} /></summary><p>{product.description}</p><p>Проверьте выбранную комплектацию и совместимость перед заказом. Фотография соответствует указанному артикулу.</p></details>{product.warning && <details className="information-section"><summary>Важная информация <Icon name="triangle-alert" size={18} /></summary><p>{product.warning}</p><p className="muted">Цены и остатки демонстрационные. Характеристики импортированы из каталога производителя и могут требовать уточнения для конкретного применения.</p></details>}<div className="product-purchase"><div><strong>{money(variant.price)}</strong><span>за {product.unit}</span></div><Buy product={product} variant={variant} onCart={onCart} onChoose={() => {}} /></div></div></div><div className="mobile-product-purchase"><div><strong>{money(variant.price)}</strong><small>за {product.unit}</small></div><Buy product={product} variant={variant} onCart={onCart} onChoose={() => {}} /></div></div>;
}
