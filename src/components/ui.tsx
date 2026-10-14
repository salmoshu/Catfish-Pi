import { ChevronDown, X } from 'lucide-react'
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode, type RefObject, type SelectHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  size?: 'small' | 'regular'
}

export function IconButton({ label, size = 'regular', className = '', children, ...props }: IconButtonProps) {
  return (
    <button type="button" className={`icon-button icon-button--${size} ${className}`} aria-label={label} title={label} {...props}>
      {children}
    </button>
  )
}

export function BrowserGlobe({ size = 18 }: { size?: number }) {
  return (
    <svg
      className="browser-globe"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="3.65" ry="9" />
      <path d="M3 12h18" />
    </svg>
  )
}

interface SelectControlProps extends SelectHTMLAttributes<HTMLSelectElement> {
  icon?: ReactNode
  compact?: boolean
  label: string
}

export function SelectControl({ icon, compact, className = '', label, children, ...props }: SelectControlProps) {
  return (
    <label className={`select-control ${compact ? 'select-control--compact' : ''} ${className}`} title={label}>
      <span className="select-control__icon" aria-hidden="true">{icon}</span>
      <span className="sr-only">{label}</span>
      <select aria-label={label} {...props}>{children}</select>
      <ChevronDown className="select-control__chevron" size={12} aria-hidden="true" />
    </label>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange(value: T): void
  label: string
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={value === option.value ? 'is-active' : ''}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      {icon ? <div className="empty-state__icon">{icon}</div> : null}
      <h2>{title}</h2>
      <p>{children}</p>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  )
}

const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useFocusTrap<T extends HTMLElement>(active: boolean, onEscape?: () => void): RefObject<T | null> {
  const containerRef = useRef<T>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const escapeRef = useRef(onEscape)
  escapeRef.current = onEscape
  useEffect(() => {
    if (!active || !containerRef.current) return
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const container = containerRef.current
    const focusInitial = () => {
      const preferred = container.querySelector<HTMLElement>('[autofocus]')
      const first = preferred ?? container.querySelector<HTMLElement>(focusableSelector)
      first?.focus()
    }
    const frame = requestAnimationFrame(focusInitial)
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.target instanceof Node) || !container.contains(event.target)) return
      if (event.key === 'Escape' && escapeRef.current) { event.preventDefault(); escapeRef.current(); return }
      if (event.key !== 'Tab') return
      const items = [...container.querySelectorAll<HTMLElement>(focusableSelector)].filter((item) => !item.hidden && item.getClientRects().length > 0)
      if (!items.length) { event.preventDefault(); container.focus(); return }
      const first = items[0]; const last = items.at(-1)!
      if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown, true)
      const restore = previousFocus.current
      requestAnimationFrame(() => { if (restore?.isConnected) restore.focus() })
    }
  }, [active])
  return containerRef
}

// Overlays (modals, the command palette) share one refcount so stacked or
// sibling overlays only toggle the app shell's inert state on 0<->1 transitions.
let appShellOverlayCount = 0

export function useAppShellOverlay(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const shell = document.querySelector<HTMLElement>('.app-shell')
    if (!shell) return
    appShellOverlayCount += 1
    if (appShellOverlayCount === 1) { shell.inert = true; shell.setAttribute('aria-hidden', 'true') }
    return () => {
      appShellOverlayCount -= 1
      if (appShellOverlayCount === 0) { shell.inert = false; shell.removeAttribute('aria-hidden') }
    }
  }, [active])
}

export function Modal({ title, children, onClose, footer }: { title: string; children: ReactNode; onClose(): void; footer?: ReactNode }) {
  const titleId = useId()
  const modalRef = useFocusTrap<HTMLElement>(true, onClose)
  useAppShellOverlay(true)
  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={modalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="modal__header"><h2 id={titleId}>{title}</h2><IconButton label="Close" onClick={onClose}><X size={16} /></IconButton></div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__footer">{footer}</div> : null}
      </section>
    </div>, document.body
  )
}

export function OmpMark({ size = 24 }: { size?: number }) {
  // The prong slots are cut out with a mask so the tile background shows
  // through, matching assets/brand/omp-icon.svg. useId keeps mask references
  // unique when several marks render at once (brand button plus its menu).
  const maskId = `omp-mark-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <span className="omp-mark" style={{ width: size, height: size }} role="img" aria-label="OMP">
      <svg viewBox="0 0 120 90" fill="none" focusable="false" aria-hidden="true">
        <mask id={maskId} maskUnits="userSpaceOnUse">
          <rect x="0" y="0" width="120" height="90" fill="#fff" />
          <rect x="76" y="59" width="3" height="8" rx="1" fill="#000" />
          <rect x="82" y="59" width="3" height="8" rx="1" fill="#000" />
        </mask>
        <g mask={`url(#${maskId})`}>
          <rect x="10" y="8" width="100" height="12" rx="2" fill="currentColor" />
          <rect x="25" y="20" width="12" height="62" rx="2" fill="currentColor" />
          <rect x="75" y="20" width="12" height="45" rx="2" fill="currentColor" />
          <rect x="71" y="55" width="20" height="16" rx="3" fill="#f97316" />
        </g>
        <circle cx="18" cy="14" r="2" fill="#f97316" opacity="0.8" />
        <circle cx="102" cy="14" r="2" fill="#f97316" opacity="0.8" />
      </svg>
    </span>
  )
}

export function PiMark({ size = 24 }: { size?: number }) {
  // A plain geometric π: overhanging crossbar with two inset legs, drawn in
  // currentColor so the tile styling matches the other harness marks.
  return (
    <span className="pi-mark" style={{ width: size, height: size }} role="img" aria-label="Pi">
      <svg viewBox="0 0 120 90" fill="none" focusable="false" aria-hidden="true">
        <rect x="12" y="12" width="96" height="13" rx="2.5" fill="currentColor" />
        <rect x="31" y="25" width="13" height="53" rx="2.5" fill="currentColor" />
        <rect x="76" y="25" width="13" height="43" rx="2.5" fill="currentColor" />
        <path d="M76 68 h13 v4 a6 6 0 0 1 -6 6 h-1 a6 6 0 0 1 -6 -6 z" fill="currentColor" />
      </svg>
    </span>
  )
}

export function CatfishPiMark({ size = 24 }: { size?: number }) {
  return (
    <span className="catfishpi-mark" style={{ width: size, height: size }} role="img" aria-label="Catfish-Pi">
      <img src="/catfishpi-mascot.png" alt="" aria-hidden="true" />
    </span>
  )
}
