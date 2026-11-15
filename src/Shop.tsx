import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { initialStore, readStore, STORE_KEY, type Store } from './model';
type Context = { store: Store; mutate: (fn: (s: Store) => Store) => boolean; notify: (message: string) => void; storageError: string; reset: () => void };
const ShopContext = createContext<Context>(null!);
export const useShop = () => useContext(ShopContext);
export function ShopProvider({ children }: { children: ReactNode }) {
  const [storageError, setStorageError] = useState('');
  const [store, setStore] = useState<Store>(() => { try { return readStore(); } catch { return initialStore(); } });
  const [toast, setToast] = useState('');
  const toastRef = useRef<HTMLDivElement>(null);
  useEffect(() => { try { readStore(); } catch (e) { setStorageError((e as Error).message); } }, []);
  useEffect(() => {
    const sync = (e: StorageEvent) => { if (e.key === STORE_KEY) { try { setStore(readStore()); } catch (e) { setStorageError((e as Error).message); } } };
    window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync);
  }, []);
  useEffect(() => { if (!toast) return; toastRef.current?.showPopover?.(); const timer = setTimeout(() => setToast(''), 5000); return () => clearTimeout(timer); }, [toast]);
  const mutate = (fn: (s: Store) => Store) => {
    try { const current = readStore(); const next = fn(current); localStorage.setItem(STORE_KEY, JSON.stringify(next)); setStore(next); return true; }
    catch (e) { setToast(e instanceof Error ? e.message : 'Не удалось сохранить изменения.'); return false; }
  };
  const reset = () => { try { const next = initialStore(); localStorage.setItem(STORE_KEY, JSON.stringify(next)); setStore(next); setStorageError(''); setToast('Демонстрационные данные восстановлены.'); } catch { setToast('Браузер не разрешает сохранять данные.'); } };
  return <ShopContext.Provider value={{ store, mutate, notify: setToast, storageError, reset }}>{children}{toast && <div ref={toastRef} popover="manual" className="toast" role="status">{toast}<button onClick={() => setToast('')} aria-label="Скрыть уведомление">×</button></div>}</ShopContext.Provider>;
}
