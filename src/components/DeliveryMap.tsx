import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { GeoJsonObject } from 'geojson';
import 'leaflet/dist/leaflet.css';
import { deliveryArea, deliveryBounds, isDeliveryPoint, reverseDeliveryAddress, type DeliveryPoint } from '../delivery-map';

export function DeliveryMap({ value, onChange, onBusy }: {
  value: DeliveryPoint | null;
  onChange: (value: { point: DeliveryPoint; city: string; address: string } | null) => void;
  onBusy: (busy: boolean) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onChange, onBusy }); callbacks.current = { onChange, onBusy };
  const initialValue = useRef(value);
  const [message, setMessage] = useState('Приблизьте карту и нажмите на нужный дом. С клавиатуры: стрелки — перемещение, Enter — выбрать центр карты.');
  const [error, setError] = useState('');
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, { maxBounds: deliveryBounds, maxBoundsViscosity: 1, minZoom: 6, maxZoom: 19, zoomSnap: .25, scrollWheelZoom: false, doubleClickZoom: false });
    map.fitBounds(deliveryBounds, { padding: [8, 8] });
    const tiles = L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://www.naturalearthdata.com">Natural Earth</a>',
      noWrap: true, maxZoom: 19,
    }).addTo(map);
    tiles.on('tileerror', () => setTileError(true));
    tiles.on('tileload', () => setTileError(false));
    L.geoJSON(deliveryArea as GeoJsonObject, { interactive: false, style: { color: '#b94c00', weight: 2, fillOpacity: .035 } }).addTo(map);
    let marker: L.CircleMarker | undefined;
    const mark = (point: DeliveryPoint) => {
      if (marker) marker.setLatLng(point);
      else marker = L.circleMarker(point, { radius: 9, color: '#fff', weight: 3, fillColor: '#b94c00', fillOpacity: 1 }).addTo(map);
    };
    if (initialValue.current) { mark(initialValue.current); map.setView(initialValue.current, 15); }
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    map.on('click', (event: L.LeafletMouseEvent) => {
      const point = { lat: event.latlng.lat, lng: event.latlng.lng };
      controller?.abort(); controller = undefined; clearTimeout(timer);
      callbacks.current.onBusy(false);
      if (!isDeliveryPoint(point)) {
        setMessage('Выберите улицу или дом на карте.');
        setError('Доставка доступна только по Крыму. Выберите точку внутри выделенного контура.');
        return;
      }
      callbacks.current.onChange(null); mark(point); setError('');
      setMessage('Определяем адрес…'); callbacks.current.onBusy(true);
      controller = new AbortController(); const request = controller;
      // Debounce repeated clicks; cancelled responses cannot replace the latest address.
      timer = setTimeout(async () => {
        const timeout = setTimeout(() => request.abort(), 10000);
        try {
          const result = await reverseDeliveryAddress(point, request.signal);
          if (!disposed && controller === request && !request.signal.aborted) {
            callbacks.current.onChange(result); setMessage('Адрес выбран. При необходимости уточните дом и квартиру ниже.');
          }
        } catch (e) {
          if (!disposed && controller === request) {
            setError(request.signal.aborted ? 'Адрес не загрузился. Нажмите на карту, чтобы повторить.' : (e as Error).message);
            setMessage('Выберите улицу или дом на карте.');
          }
        } finally {
          clearTimeout(timeout);
          if (!disposed && controller === request) callbacks.current.onBusy(false);
        }
      }, 450);
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && event.target === container.current) { event.preventDefault(); map.fire('click', { latlng: map.getCenter() }); }
    };
    container.current.addEventListener('keydown', onKey);
    const element = container.current;
    const observer = new ResizeObserver(() => map.invalidateSize()); observer.observe(container.current);
    return () => { disposed = true; controller?.abort(); clearTimeout(timer); observer.disconnect(); element.removeEventListener('keydown', onKey); map.remove(); callbacks.current.onBusy(false); };
  }, []);
  return <div className="delivery-map-section"><p className="delivery-map-help" id="delivery-map-help">Выберите адрес на карте. Доставляем по Крыму, включая Севастополь.</p><div className="delivery-map" ref={container} role="region" aria-label="Карта выбора адреса доставки по Крыму" aria-describedby="delivery-map-help" tabIndex={0} /><p className="delivery-map-status" role="status">{message}</p>{tileError && <p className="field-error" role="alert">Карта загружается с ошибкой. Проверьте подключение к интернету.</p>}{error && <p className="field-error" role="alert">{error}</p>}</div>;
}
