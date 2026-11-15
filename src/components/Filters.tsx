import { categories, type Product } from '../model';
import { Icon } from './UI';
export type Filters = { categories: string[]; brands: string[]; min: string; max: string; available: boolean; variant: string };
export const emptyFilters = (): Filters => ({ categories: [], brands: [], min: '', max: '', available: false, variant: '' });
export const filterCount = (f: Filters) => f.categories.length + f.brands.length + Number(!!f.min || !!f.max) + Number(f.available) + Number(!!f.variant);
export function matchingVariants(p: Product, query: string, f: Filters) {
  const terms = query.toLocaleLowerCase('ru').trim().split(/\s+/).filter(Boolean);
  return p.variants.filter(v => {
    const text = [p.name, p.description, p.brand, p.model, v.label, v.sku, ...v.specs.flat()].join(' ').toLocaleLowerCase('ru');
    return terms.every(t => text.includes(t)) && (!f.available || v.stock > 0) && (!f.min || v.price >= Number(f.min)) && (!f.max || v.price <= Number(f.max)) && (!f.variant || v.label.startsWith(f.variant));
  });
}
export function filterProducts(products: Product[], query: string, f: Filters) {
  return products.filter(p => !p.archived && (!f.categories.length || f.categories.includes(p.category)) && (!f.brands.length || f.brands.includes(p.brand)) && matchingVariants(p, query, f).length > 0);
}
export function FiltersPanel({ products, value, onChange, sort, onSort }: { products: Product[]; value: Filters; onChange: (f: Filters) => void; sort?: string; onSort?: (s: string) => void }) {
  const toggle = (field: 'categories' | 'brands', key: string) => onChange({ ...value, [field]: value[field].includes(key) ? value[field].filter(c => c !== key) : [...value[field], key] });
  return <div className="filters-content">
    {onSort && <label className="field">Сортировка<select value={sort} onChange={e => onSort(e.target.value)}><SortOptions /></select></label>}
    <fieldset><legend>Категории</legend>{categories.map(c => <label className={`filter-category ${value.categories.includes(c.id) ? 'selected' : ''}`} key={c.id}><input type="checkbox" checked={value.categories.includes(c.id)} onChange={() => toggle('categories', c.id)} /><span>{c.label}</span><small>{products.filter(p => !p.archived && p.category === c.id).length}</small></label>)}</fieldset>
    <fieldset><legend>Цена, ₽</legend><div className="price-inputs"><label><span>От</span><input aria-label="Цена от" type="number" min="0" value={value.min} placeholder="0" onChange={e => onChange({ ...value, min: e.target.value })} /></label><label><span>До</span><input aria-label="Цена до" type="number" min="0" value={value.max} placeholder="Любая" onChange={e => onChange({ ...value, max: e.target.value })} /></label></div>{value.min && value.max && +value.min > +value.max && <p className="field-error">Цена «от» больше цены «до».</p>}</fieldset>
    <fieldset><legend>Производитель</legend>{Array.from(new Set(products.filter(p => !p.archived).map(p => p.brand))).sort().map(b => <label className="check" key={b}><input type="checkbox" checked={value.brands.includes(b)} onChange={() => toggle('brands', b)} />{b}</label>)}</fieldset>
    <label className="check availability"><input type="checkbox" checked={value.available} onChange={e => onChange({ ...value, available: e.target.checked })} />Только в наличии</label>
    <details className="filter-details"><summary>Комплектация <Icon name="chevron-down" size={17} /></summary><select aria-label="Фильтр по комплектации" value={value.variant} onChange={e => onChange({ ...value, variant: e.target.value })}><option value="">Любая</option><option>С аккумулятором и зарядкой</option><option>Без аккумулятора и зарядки</option></select></details>
  </div>;
}
export function SortOptions() { return <><option value="popular">Сначала популярные</option><option value="price-asc">Сначала дешевле</option><option value="price-desc">Сначала дороже</option><option value="name">По названию</option><option value="stock">Сначала в наличии</option></>; }
