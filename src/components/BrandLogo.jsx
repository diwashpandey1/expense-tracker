export function BrandMark({ onDark = false, className = '' }) {
  return <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${onDark ? 'bg-[#c5e96c] text-[#183425]' : 'bg-[#2b5941] text-[#c5e96c]'} ${className}`} aria-hidden="true">
    <svg viewBox="0 0 40 40" fill="none" className="h-6 w-6">
      <path d="M9 30.5 19.2 9.5 31 30.5M13 25h13" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m21 22 4.3-4.3 3.2 2.2 4.5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28.4 14.9H33v4.6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
}

export default function BrandLogo({ onDark = false, subtitle = false, markOnly = false, className = '', markClassName = '' }) {
  return <span className={`inline-flex items-center gap-3 ${className}`}>
    <BrandMark onDark={onDark} className={markClassName} />
    {!markOnly && <span className="min-w-0">
      <span className={`block font-sans text-[17px] font-extrabold leading-none tracking-[.16em] ${onDark ? 'text-white' : 'text-[#1d3327]'}`}>AVORA</span>
      {subtitle && <span className={`mt-1 block text-[9px] font-semibold uppercase tracking-[.18em] ${onDark ? 'text-[#a9c0b2]' : 'text-[#78877d]'}`}>Personal finance</span>}
    </span>}
  </span>
}
