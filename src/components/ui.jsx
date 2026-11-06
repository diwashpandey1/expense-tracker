import { LoaderCircle, Plus } from 'lucide-react'

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-[#173f31] text-white hover:bg-[#102f25] shadow-sm',
    secondary: 'bg-white text-[#263a2f] border border-[#e0e6de] hover:bg-[#f8faf6]',
    subtle: 'text-[#52645a] hover:bg-[#eef2ec]',
    danger: 'bg-rose-50 text-rose-700 hover:bg-rose-100',
    accent: 'bg-[#c5e96c] text-[#183425] hover:bg-[#b7dc5e]',
  }
  return <button className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#739a3a] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]} ${className}`} {...props}>{children}</button>
}

export function PageHeading({ eyebrow, title, description, action }) {
  return <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      {eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-[#799080]">{eyebrow}</p>}
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-[#1b3025] sm:text-[2.45rem]">{title}</h1>
      {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-[#748078]">{description}</p>}
    </div>
    {action}
  </div>
}

export function Card({ children, className = '' }) {
  return <section className={`rounded-2xl border border-[#e8ebe5] bg-white p-5 shadow-[0_8px_28px_rgba(26,53,38,.035)] sm:p-6 ${className}`}>{children}</section>
}

export function LoadingState({ label = 'Loading your finance data' }) {
  return <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-[#748078]" role="status">
    <LoaderCircle className="animate-spin text-[#628d51]" size={19} />{label}
  </div>
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return <div className="flex min-h-52 flex-col items-center justify-center px-6 py-9 text-center">
    {Icon && <div className="mb-4 rounded-2xl bg-[#f0f5eb] p-3 text-[#60804d]"><Icon size={23} /></div>}
    <h3 className="text-base font-semibold text-[#25392e]">{title}</h3>
    {description && <p className="mt-2 max-w-sm text-sm leading-6 text-[#818c84]">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
}

export function Field({ label, hint, error, className = '', ...props }) {
  return <label className={`block ${className}`}>
    <span className="mb-1.5 block text-sm font-medium text-[#34463b]">{label}</span>
    <input className="min-w-0 w-full rounded-xl border border-[#dfe5dd] bg-white px-3.5 py-2.5 text-sm text-[#24352b] outline-none transition placeholder:text-[#a1aaa3] focus:border-[#648d57] focus:ring-4 focus:ring-[#668d571a] disabled:bg-[#f5f6f2]" {...props} />
    {error && <span className="mt-1 block text-xs text-rose-700">{error}</span>}
    {hint && <span className="mt-1 block text-xs text-[#88948b]">{hint}</span>}
  </label>
}

export function SelectField({ label, className = '', children, ...props }) {
  return <label className={`block ${className}`}>
    <span className="mb-1.5 block text-sm font-medium text-[#34463b]">{label}</span>
    <select className="min-w-0 w-full rounded-xl border border-[#dfe5dd] bg-white px-3.5 py-2.5 text-sm text-[#24352b] outline-none transition focus:border-[#648d57] focus:ring-4 focus:ring-[#668d571a]" {...props}>{children}</select>
  </label>
}

export function Modal({ title, description, onClose, children, wide = false }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#12291f66] p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section role="dialog" aria-modal="true" aria-labelledby="modal-title" className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-[#fbfcfa] p-5 shadow-2xl sm:rounded-3xl sm:p-7 ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
      <div className="mb-5">
        <h2 id="modal-title" className="font-serif text-2xl font-semibold text-[#1b3025]">{title}</h2>
        {description && <p className="mt-1 text-sm leading-6 text-[#7c8880]">{description}</p>}
      </div>
      {children}
    </section>
  </div>
}

export function AddButton({ children = 'Add new', ...props }) {
  return <Button {...props}><Plus size={16} />{children}</Button>
}

export function InlineError({ children }) {
  if (!children) return null
  return <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{children}</p>
}
