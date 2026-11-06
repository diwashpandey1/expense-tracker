import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDownLeft, BarChart3, ChevronDown, Command, LayoutDashboard, LogOut, Menu, Tags, Target, WalletCards, Landmark, CalendarClock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { usePreferences } from '../context/PreferencesContext'
import { processDueSchedules } from '../services/recurringService'
import BrandLogo from './BrandLogo'

const links = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/transactions', label: 'Transactions', icon: ArrowDownLeft },
  { to: '/app/accounts', label: 'Accounts', icon: Landmark },
  { to: '/app/recurring', label: 'Recurring', icon: CalendarClock },
  { to: '/app/budgets', label: 'Budgets', icon: WalletCards },
  { to: '/app/categories', label: 'Categories', icon: Tags },
  { to: '/app/goals', label: 'Savings goals', icon: Target },
  { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
]

function InitialAvatar({ name }) {
  const initials = (name || 'U').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#dcecc9] text-sm font-bold text-[#365a3b]">{initials || 'U'}</span>
}

export default function AppLayout() {
  const { user, profile, logout } = useAuth()
  const { preferences, displayCurrency } = usePreferences()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const collapsed = preferences.appearance.sidebarCollapsed && !menuOpen
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => { if (user?.uid && profile?.currencyCode) processDueSchedules(user.uid, profile.currencyCode).catch(() => {}) }, [user?.uid, profile?.currencyCode])

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const sidebar = <div className="flex h-full flex-col">
    <div className={`flex items-center gap-3 py-7 ${collapsed ? 'justify-center px-3' : 'px-6'}`}>
      {collapsed ? <BrandLogo onDark markOnly markClassName="rounded-2xl" /> : <BrandLogo onDark subtitle className="gap-3" markClassName="h-10 w-10 rounded-2xl" />}
    </div>
    {!collapsed && <p className="px-6 pb-3 text-[10px] font-bold uppercase tracking-[.18em] text-[#739083]">Workspace</p>}
    <nav className={`flex-1 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`} aria-label="Main navigation">
      {links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} title={collapsed ? label : undefined} aria-label={label} onClick={() => setMenuOpen(false)} className={({ isActive }) => `group flex items-center rounded-xl py-3 text-sm font-medium transition ${collapsed ? 'justify-center px-2' : 'gap-3 px-3.5'} ${isActive ? 'bg-[#38664d] text-white shadow-sm' : 'text-[#b9c9bf] hover:bg-[#315d46] hover:text-white'}`}>
        {({ isActive }) => <><Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />{!collapsed && <span>{label}</span>}{isActive && <span className={`${collapsed ? 'absolute right-2' : 'ml-auto'} h-1.5 w-1.5 rounded-full bg-[#c5e96c]`} />}</>}
      </NavLink>)}
    </nav>
    <button onClick={() => navigate('/app/settings')} title={collapsed ? profile?.displayName : undefined} aria-label="Open settings" className={`flex items-center border-t border-white/10 py-4 text-left hover:bg-white/5 ${collapsed ? 'justify-center px-3' : 'gap-3 px-5'}`}>
      <InitialAvatar name={profile?.displayName} />
      {!collapsed && <><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-white">{profile?.displayName || 'Your account'}</span><span className="mt-0.5 block truncate text-xs text-[#95aa9b]">{profile?.email}</span></span><ChevronDown size={16} className="text-[#8ea696]" /></>}
    </button>
  </div>

  return <div className="min-h-screen bg-[#f7f8f5] lg:flex">
    <aside className={`fixed inset-y-0 left-0 z-40 hidden flex-col bg-[#2b5941] lg:flex ${collapsed ? 'w-[76px]' : 'w-[250px]'}`}>{sidebar}</aside>
    <AnimatePresence>
      {menuOpen && <><motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/40 lg:hidden" aria-label="Close navigation" onClick={() => setMenuOpen(false)} /><motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: 'tween', duration: .2 }} className="fixed inset-y-0 left-0 z-50 w-[270px] bg-[#2b5941] lg:hidden">{sidebar}</motion.aside></>}
    </AnimatePresence>
    <div className={`min-w-0 flex-1 ${collapsed ? 'lg:pl-[76px]' : 'lg:pl-[250px]'}`}>
      <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#e8ebe5] bg-[#f8f9f6]/95 px-4 backdrop-blur-md sm:px-7 lg:px-10">
        <button onClick={() => setMenuOpen(true)} className="rounded-xl p-2 text-[#40584a] hover:bg-[#e9eee6] lg:hidden" aria-label="Open navigation"><Menu size={21} /></button>
        <div className="hidden items-center gap-2 text-xs text-[#86938a] sm:flex"><Command size={14} /><span>Money, made clearer</span></div>
        <div className="ml-auto flex items-center gap-3">
          <span title={`Display currency · account currency ${profile?.currencyCode || 'USD'}`} className="hidden rounded-lg bg-[#eef3e9] px-2.5 py-1.5 text-xs font-semibold text-[#4c6b4d] sm:inline-flex">{displayCurrency || profile?.currencyCode || 'USD'}</span>
          <div className="relative">
            <button onClick={() => setUserMenuOpen((open) => !open)} className="flex items-center gap-2 rounded-full p-1 pr-2 hover:bg-[#edf0ea]" aria-expanded={userMenuOpen} aria-label="Account menu"><InitialAvatar name={profile?.displayName} /><ChevronDown size={14} className="text-[#718077]" /></button>
            {userMenuOpen && <div className="absolute right-0 top-12 w-48 rounded-xl border border-[#e5e9e2] bg-white p-1.5 shadow-xl"><button onClick={() => { navigate('/app/settings'); setUserMenuOpen(false) }} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[#f3f6f0]">Settings</button><button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"><LogOut size={15} />Sign out</button></div>}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] px-4 pb-28 pt-7 sm:px-7 sm:pt-9 lg:px-10 lg:pb-12">
        <div key={location.pathname} className="page-enter"><Outlet /></div>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-7 border-t border-[#e3e8e0] bg-white/95 px-1 pb-[max(env(safe-area-inset-bottom),.4rem)] pt-2 backdrop-blur-xl lg:hidden" aria-label="Mobile navigation">
        {[links[0], links[1], links[2], links[4], links[5], links[6], links[7]].map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex flex-col items-center gap-1 rounded-lg py-1.5 text-[9px] font-semibold ${isActive ? 'text-[#256345]' : 'text-[#88948c]'}`}><Icon size={18} /><span>{label === 'Transactions' ? 'Activity' : label === 'Savings goals' ? 'Goals' : label === 'Overview' ? 'Home' : label}</span></NavLink>)}
      </nav>
    </div>
  </div>
}
