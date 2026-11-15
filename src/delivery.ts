// Illustrative road distances, never represented as live routing results.
export const cities = [
  { name: 'Севастополь', km: 12 }, { name: 'Симферополь', km: 84 }, { name: 'Ялта', km: 86 }, { name: 'Евпатория', km: 119 },
  { name: 'Бахчисарай', km: 48 }, { name: 'Алушта', km: 119 }, { name: 'Саки', km: 100 }, { name: 'Феодосия', km: 206 },
  { name: 'Керчь', km: 291 }, { name: 'Судак', km: 173 }, { name: 'Джанкой', km: 181 }, { name: 'Белогорск', km: 128 },
  { name: 'Форос', km: 49 }, { name: 'Алупка', km: 69 }, { name: 'Гурзуф', km: 102 }, { name: 'Инкерман', km: 16 },
  { name: 'Балаклава', km: 18 }, { name: 'Красноперекопск', km: 214 }, { name: 'Армянск', km: 236 }, { name: 'Черноморское', km: 191 },
  { name: 'Раздольное', km: 173 }, { name: 'Коктебель', km: 189 }, { name: 'Новый Свет', km: 179 }, { name: 'Щёлкино', km: 259 },
  { name: 'Другой населённый пункт Крыма', km: 120 }
];
export type Quote = { distance: number; price: number; source: 'Условный расчёт' | 'Маршрут OpenRouteService'; addressKey: string };
export async function quoteDelivery(city: string, address: string, signal: AbortSignal): Promise<Quote> {
  const apiKey = import.meta.env.VITE_ORS_API_KEY as string | undefined;
  const addressKey = city + '|' + address.trim();
  const fallback = () => { const distance = cities.find(c => c.name === city)?.km || 120; return { distance, price: Math.ceil(distance * 2), source: 'Условный расчёт' as const, addressKey }; };
  if (!apiKey) return fallback();
  try {
    const base = (import.meta.env.VITE_ORS_BASE_URL || 'https://api.heigit.org').replace(/\/$/, '');
    const geo = new URL(base + '/pelias/v1/search');
    geo.searchParams.set('api_key', apiKey); geo.searchParams.set('text', `${city}, ${address}`);
    geo.searchParams.set('boundary.rect.min_lon', '32.4'); geo.searchParams.set('boundary.rect.max_lon', '36.7');
    geo.searchParams.set('boundary.rect.min_lat', '44.3'); geo.searchParams.set('boundary.rect.max_lat', '46.3'); geo.searchParams.set('size', '1');
    const response = await fetch(geo, { signal }); if (!response.ok) throw new Error('geocoding');
    const data = await response.json(); const target = data.features?.[0]?.geometry?.coordinates;
    if (!target || target[0] < 32.4 || target[0] > 36.7 || target[1] < 44.3 || target[1] > 46.3) throw new Error('address');
    const route = new URL(base + '/openrouteservice/v2/directions/driving-car');
    route.searchParams.set('api_key', apiKey); route.searchParams.set('start', '33.498483,44.569836'); route.searchParams.set('end', target.join(','));
    const result = await fetch(route, { signal }); if (!result.ok) throw new Error('routing');
    const json = await result.json(); const meters = json.features?.[0]?.properties?.summary?.distance;
    if (!Number.isFinite(meters) || meters <= 0 || meters > 700000) throw new Error('distance');
    const distance = Math.ceil(meters / 1000); return { distance, price: Math.ceil(distance * 2), source: 'Маршрут OpenRouteService', addressKey };
  } catch (e) { if (signal.aborted) throw e; return fallback(); }
}
