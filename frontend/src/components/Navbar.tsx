import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { BarChart3, Database, Home, Info, Menu, MoonStar, PlaneTakeoff, Search, ShieldCheck, SunMedium, X } from 'lucide-react'

type NavbarProps = {
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}

export function Navbar({ theme, onToggleTheme }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/search', label: 'Search', icon: Search },
    { href: '/index', label: 'Airfare Index', icon: PlaneTakeoff },
    { href: '/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/explorer', label: 'Data Explorer', icon: Database },
    { href: '/admin', label: 'Admin', icon: ShieldCheck },
    { href: '/about', label: 'About', icon: Info },
  ]

  return (
    <header
      className={`sticky top-0 z-20 border-b backdrop-blur-xl transition-colors duration-300 ${
        theme === 'dark'
          ? 'border-white/10 bg-slate-950/85'
          : 'border-slate-200/80 bg-white/85'
      }`}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#30d8d1] via-[#66e7d8] to-[#f7c84d] text-slate-950 shadow-lg shadow-teal-400/20 transition-transform duration-300 hover:scale-105">
            <PlaneTakeoff size={18} />
          </div>
          <div>
            <p
              className={`text-sm font-semibold tracking-[0.24em] uppercase ${
                theme === 'dark' ? 'text-teal-200' : 'text-teal-700'
              }`}
            >
              Airfare Price Index
            </p>
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
              Real-time pricing intelligence for India
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <nav className="hidden items-center gap-2 xl:flex">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.href === '/'}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                      isActive
                        ? theme === 'dark'
                          ? 'border-teal-300/40 bg-teal-300/10 text-white'
                          : 'border-teal-300 bg-teal-50 text-slate-950'
                        : theme === 'dark'
                          ? 'border-white/10 bg-white/5 text-slate-200 hover:border-teal-300/40 hover:bg-white/10 hover:text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50 hover:text-slate-950'
                    }`
                  }
                >
                  <Icon size={14} />
                  {item.label}
                </NavLink>
              )
            })}
          </nav>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 font-semibold shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg sm:px-4 ${
              theme === 'dark'
                ? 'border-white/10 bg-white/5 text-white hover:border-teal-300/40 hover:bg-white/10'
                : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-teal-300 hover:bg-white'
            }`}
          >
            {theme === 'dark' ? <SunMedium size={15} /> : <MoonStar size={15} />}
            <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
            className={`relative z-30 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg md:hidden ${
              theme === 'dark'
                ? 'border-white/10 bg-white/5 text-white'
                : 'border-slate-200 bg-slate-50 text-slate-900'
            }`}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      <div
        className={`md:hidden overflow-hidden border-t transition-all duration-300 ${
          menuOpen ? 'max-h-96 border-white/10' : 'max-h-0 border-transparent'
        } ${theme === 'dark' ? 'bg-slate-950/95' : 'bg-white/95'}`}
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-4 py-3 font-medium transition ${
                    isActive
                      ? theme === 'dark'
                        ? 'bg-teal-300/10 text-white'
                        : 'bg-teal-50 text-slate-950'
                      : theme === 'dark'
                        ? 'bg-white/5 text-white hover:bg-white/10'
                        : 'bg-slate-50 text-slate-900 hover:bg-slate-100'
                  }`
                }
                onClick={() => setMenuOpen(false)}
              >
                <span
                  className={`grid h-9 w-9 place-items-center rounded-2xl ${
                    theme === 'dark' ? 'bg-white/10 text-teal-200' : 'bg-white text-teal-700'
                  }`}
                >
                  <Icon size={15} />
                </span>
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      </div>
    </header>
  )
}
