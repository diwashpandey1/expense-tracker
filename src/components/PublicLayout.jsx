import { Link } from 'react-router-dom'
import { ArrowRight, CircleDollarSign } from 'lucide-react'

export default function PublicLayout({ children }) {
  return <div className="min-h-screen bg-[#f7f8f4] text-[#24372b]">
    <header className="sticky top-0 z-30 border-b border-[#e8ebe5] bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#173f31] text-[#c5e96c]"><CircleDollarSign size={22}/></span><span className="font-serif text-xl font-semibold">Pennywise</span></Link>
        <nav aria-label="Public navigation" className="flex items-center gap-1 sm:gap-3"><Link to="/" className="hidden rounded-lg px-2 py-2 text-sm font-medium text-[#68776c] hover:bg-[#f1f4ee] sm:inline-flex">Home</Link><Link to="/about" className="hidden rounded-lg px-2 py-2 text-sm font-medium text-[#68776c] hover:bg-[#f1f4ee] md:inline-flex">About</Link><Link to="/tools" className="rounded-lg px-2 py-2 text-sm font-medium text-[#68776c] hover:bg-[#f1f4ee]">Tools</Link><Link to="/blog" className="hidden rounded-lg px-2 py-2 text-sm font-medium text-[#68776c] hover:bg-[#f1f4ee] sm:inline-flex">Blog</Link><Link to="/contact" className="hidden rounded-lg px-2 py-2 text-sm font-medium text-[#68776c] hover:bg-[#f1f4ee] lg:inline-flex">Contact</Link><Link to="/login" className="hidden rounded-lg px-2 py-2 text-sm font-semibold text-[#516257] sm:inline-flex">Sign in</Link><Link to="/signup" className="inline-flex items-center gap-2 rounded-xl bg-[#173f31] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#102f25]">Get started <ArrowRight size={15}/></Link></nav>
      </div>
    </header>
    {children}
    <footer className="border-t border-[#e7ebe4] bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-xs text-[#849087] sm:flex-row sm:items-center sm:justify-between sm:px-8"><span>© {new Date().getFullYear()} Pennywise · Personal finance, made clearer.</span><div className="flex gap-4"><Link to="/about">About</Link><Link to="/tools">Tools</Link><Link to="/blog">Blog</Link><Link to="/contact">Contact</Link><Link to="/login">Sign in</Link></div></div></footer>
  </div>
}
