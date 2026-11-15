import area from './data/delivery-area.json';

export type DeliveryPoint = { lat: number; lng: number };
export const deliveryArea = area;
export const deliveryBounds: [[number, number], [number, number]] = [[44.3, 32.4], [46.3, 36.7]];

function insideRing(point: DeliveryPoint, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    // Include points directly on a boundary segment.
    const cross = (point.lng - xi) * (yj - yi) - (point.lat - yi) * (xj - xi);
    if (Math.abs(cross) < 1e-10 && point.lng >= Math.min(xi, xj) && point.lng <= Math.max(xi, xj) && point.lat >= Math.min(yi, yj) && point.lat <= Math.max(yi, yj)) return true;
    if ((yi > point.lat) !== (yj > point.lat) && point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function isDeliveryPoint(point: DeliveryPoint): boolean {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return false;
  return area.features.some(feature => {
    const geometry = feature.geometry;
    const polygons = (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates) as number[][][][];
    return polygons.some(rings => insideRing(point, rings[0]) && !rings.slice(1).some(ring => insideRing(point, ring)));
  });
}

type AddressResult = { city: string; address: string; point: DeliveryPoint };
const cache = new Map<string, AddressResult>();
export async function reverseDeliveryAddress(point: DeliveryPoint, signal: AbortSignal): Promise<AddressResult> {
  if (!isDeliveryPoint(point)) throw new Error('Выберите точку на территории Крыма.');
  const key = `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
  const cached = cache.get(key); if (cached) return { ...cached, point };
  const url = new URL('reverse', (import.meta.env.VITE_PHOTON_BASE_URL || 'https://photon.komoot.io').replace(/\/$/, '') + '/');
  url.searchParams.set('lat', String(point.lat)); url.searchParams.set('lon', String(point.lng)); url.searchParams.set('lang', 'default');
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Не удалось определить адрес. Попробуйте выбрать точку ещё раз.');
  const data = await response.json();
  const feature = data.features?.find((f: { geometry?: { coordinates?: number[] } }) => {
    const coordinates = f.geometry?.coordinates;
    if (!coordinates) return false;
    const candidate = { lat: coordinates[1], lng: coordinates[0] };
    // Reject geocoder results outside the region or far from the actual click.
    return isDeliveryPoint(candidate) && Math.hypot(candidate.lat - point.lat, (candidate.lng - point.lng) * .71) < .025;
  });
  const a = feature?.properties;
  const city = a?.city || a?.town || a?.village || a?.locality;
  const street = a?.street || a?.name;
  if (!city || !street) throw new Error('Рядом с этой точкой адрес не найден. Выберите улицу или дом.');
  const result = { city, address: [street, a.housenumber].filter(Boolean).join(', '), point };
  cache.set(key, result);
  return result;
}
