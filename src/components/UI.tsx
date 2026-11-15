import { useEffect, useRef, useState, type ReactNode } from 'react';
import { asset } from '../model';
import { readImage } from '../storage';

export function Icon({ name, size = 22 }: { name: string; size?: number }) { return <svg width={size} height={size} aria-hidden="true" fill="none"><use href={asset(`media/icons/sprite.svg#${name}`)} /></svg>; }

export function Photo({ src, alt, className = '', eager = false }: { src: string; alt: string; className?: string; eager?: boolean }) {
  const [blob, setBlob] = useState<string | null>(null); const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false); setBlob(null); let url: string | undefined; let alive = true;
    if (src.startsWith('idb:')) readImage(src).then(value => { if (!alive) return; if (value) { url = URL.createObjectURL(value); setBlob(url); } else setFailed(true); }).catch(() => alive && setFailed(true));
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [src]);
  if (failed) return <div className={`photo-missing ${className}`}><Icon name="package" size={36} /><span>Фото недоступно</span></div>;
  if (src.startsWith('idb:') && !blob) return <div className={`photo-missing ${className}`} aria-label="Загрузка фотографии"><Icon name="image-plus" /></div>;
  return <img className={className} src={blob || asset(src)} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} />;
}

export function Modal({ children, title, onClose, onBack, wide = false, className = '' }: { children: ReactNode; title: string; onClose: () => void; onBack?: () => void; wide?: boolean; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!; const previous = document.activeElement as HTMLElement | null;
    const y = window.scrollY; const original = { position: document.body.style.position, top: document.body.style.top, width: document.body.style.width, overflow: document.body.style.overflow };
    dialog.showModal(); document.body.style.position = 'fixed'; document.body.style.top = `-${y}px`; document.body.style.width = '100%'; document.body.style.overflow = 'hidden';
    return () => { dialog.close(); Object.assign(document.body.style, original); window.scrollTo({ top: y, behavior: 'instant' }); previous?.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => { ref.current?.querySelector('.modal-content')?.scrollTo({ top: 0, behavior: 'instant' }); }, [title]);
  return <dialog ref={ref} className={`modal ${wide ? 'modal-wide' : ''} ${className}`} aria-label={title} onCancel={e => { e.preventDefault(); onBack ? onBack() : onClose(); }} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }}>
    <div className="modal-head">{onBack && <button className="icon-button back-button" onClick={onBack} aria-label="Назад"><Icon name="chevron-left" /></button>}<h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Закрыть окно"><Icon name="x" /></button></div>
    <div className="modal-content">{children}</div>
  </dialog>;
}

export function Stepper({ value, max, onChange, disabled = false }: { value: number; max: number; onChange: (value: number) => void; disabled?: boolean }) {
  return <div className="stepper"><button disabled={disabled || value <= 0} aria-label="Уменьшить количество" onClick={() => onChange(Math.max(0, Math.min(value - 1, max)))}><Icon name="minus" size={18} /></button><span aria-live="polite">{value}</span><button disabled={disabled || value >= max} aria-label="Увеличить количество" onClick={() => onChange(value + 1)}><Icon name="plus" size={18} /></button></div>;
}
export function Empty({ icon = 'package', title, children }: { icon?: string; title: string; children: ReactNode }) { return <div className="empty"><Icon name={icon} size={48} /><h3>{title}</h3>{children}</div>; }
