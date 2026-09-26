import { ArrowRight, BarChart3, BadgeIndianRupee, Database, Home, PlaneTakeoff, Search, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

type FooterProps = {
  theme: 'dark' | 'light'
}

export function Footer({ theme }: FooterProps) {
  return (
    <footer
      id="footer"
      className={`mt-8 border-t transition-colors duration-300 ${
        theme === 'dark'
          ? 'border-white/10 bg-[radial-gradient(circle_at_top,_rgba(45,212,191,0.12),_transparent_35%),linear-gradient(180deg,#020617_0%,#07111f_100%)] text-white'
          : 'border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] text-slate-950'
      }`}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="md:hidden">
          <div
            className={`overflow-hidden rounded-[28px] border shadow-[0_20px_70px_rgba(15,23,42,0.12)] ${
              theme === 'dark' ? 'border-white/10 bg-white/5 shadow-slate-950/30' : 'border-slate-200 bg-white shadow-slate-200/60'
            }`}
          >
            <div className="p-5">
              <div
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                  theme === 'dark'
                    ? 'border-white/10 bg-slate-950/50 text-teal-200'
                    : 'border-slate-200 bg-slate-50 text-teal-700'
                }`}
              >
                <ShieldCheck size={13} />
                Trusted route comparison
              </div>
              <h2 className={`mt-4 text-2xl font-bold leading-tight ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                Search flights with a clean mobile-first flow.
              </h2>
              <p className={`mt-3 text-sm leading-6 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                Compare fares, review stored snapshots, and move from search to results without extra clutter.
              </p>

              <div className="mt-5 grid gap-3">
                {[
                  { icon: PlaneTakeoff, label: 'Routes', value: 'Search by city or airport' },
                  { icon: BadgeIndianRupee, label: 'Fare', value: 'Cheapest fare first' },
                  { icon: ArrowRight, label: 'Flow', value: 'Search to results' },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <div
                      key={item.label}
                      className={`rounded-2xl border p-4 ${
                        theme === 'dark' ? 'border-white/10 bg-slate-950/40' : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl ${
                            theme === 'dark' ? 'bg-teal-300 text-slate-950' : 'bg-slate-950 text-white'
                          }`}
                        >
                          <Icon size={15} />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                            {item.label}
                          </p>
                          <p className={`mt-1 text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                            {item.value}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  { to: '/', label: 'Home', icon: Home },
                  { to: '/search', label: 'Search', icon: Search },
                  { to: '/index', label: 'Airfare Index', icon: PlaneTakeoff },
                  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
                  { to: '/data-explorer', label: 'Data Explorer', icon: Database },
                ].map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`rounded-2xl border px-4 py-4 text-center text-sm font-medium transition active:scale-[0.99] ${
                      theme === 'dark'
                        ? 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <item.icon size={14} />
                      {item.label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div
              className={`border-t px-5 py-4 text-xs leading-6 ${
                theme === 'dark' ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'
              }`}
            >
                <p>© 2026 Airfare Price Index</p>
                <p className="mt-1">Designed for airline comparison and quick decisions.</p>
              </div>
            </div>
        </div>

        <div
          className={`hidden overflow-hidden rounded-[32px] border shadow-[0_20px_70px_rgba(15,23,42,0.12)] md:block ${
            theme === 'dark' ? 'border-white/10 bg-white/5 shadow-slate-950/30' : 'border-slate-200 bg-white shadow-slate-200/60'
          }`}
        >
          <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="p-6 sm:p-8 lg:p-10">
              <div className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-teal-700 dark:text-teal-200">
                <ShieldCheck size={14} />
                Trusted route comparison
              </div>
              <h2 className={`mt-4 max-w-xl text-3xl font-bold sm:text-4xl ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                Professional airfare search, comparison, and handoff in one product.
              </h2>
              <p className={`mt-4 max-w-xl text-sm leading-7 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                Built for fast route lookup with live backend pricing when available, plus clean navigation for
                home, search, results, and analytics pages.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { icon: PlaneTakeoff, label: 'Routes', value: 'Search by city or airport' },
                  { icon: BadgeIndianRupee, label: 'Fare', value: 'Cheapest fare first' },
                  { icon: ArrowRight, label: 'Flow', value: 'Search to booking' },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <div
                      key={item.label}
                      className={`rounded-2xl border p-4 ${
                        theme === 'dark' ? 'border-white/10 bg-slate-950/40' : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`grid h-9 w-9 place-items-center rounded-2xl ${
                            theme === 'dark' ? 'bg-teal-300 text-slate-950' : 'bg-slate-950 text-white'
                          }`}
                        >
                          <Icon size={15} />
                        </div>
                        <div>
                          <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                            {item.label}
                          </p>
                          <p className={`mt-1 text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                            {item.value}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className={`border-t lg:border-l lg:border-t-0 ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
              <div className="grid gap-4 p-6 sm:p-8 lg:p-10">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Link
                    to="/"
                    className={`rounded-2xl border px-4 py-4 text-sm font-medium transition hover:-translate-y-0.5 ${
                      theme === 'dark'
                        ? 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                    }`}
                  >
                    Home
                  </Link>
                  <Link
                    to="/search"
                    className={`rounded-2xl border px-4 py-4 text-sm font-medium transition hover:-translate-y-0.5 ${
                      theme === 'dark'
                        ? 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                    }`}
                  >
                    Search
                  </Link>
                  <Link
                    to="/index"
                    className={`rounded-2xl border px-4 py-4 text-sm font-medium transition hover:-translate-y-0.5 ${
                      theme === 'dark'
                        ? 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                    }`}
                  >
                    Airfare Index
                  </Link>
                  <Link
                    to="/analytics"
                    className={`rounded-2xl border px-4 py-4 text-sm font-medium transition hover:-translate-y-0.5 ${
                      theme === 'dark'
                        ? 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                    }`}
                  >
                    Analytics
                  </Link>
                  <Link
                    to="/data-explorer"
                    className={`rounded-2xl border px-4 py-4 text-sm font-medium transition hover:-translate-y-0.5 ${
                      theme === 'dark'
                        ? 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                    }`}
                  >
                    Data Explorer
                  </Link>
                </div>

                <div className={`rounded-[28px] border p-4 ${theme === 'dark' ? 'border-white/10 bg-slate-950/50' : 'border-slate-200 bg-slate-50'}`}>
                  <p className={`text-sm font-semibold tracking-[0.2em] uppercase ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
                    Footer details
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[
                      { label: 'Search', value: 'Open the route form' },
                      { label: 'Results', value: 'View live fare cards' },
                      { label: 'Index', value: 'Track live route movement' },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className={`rounded-2xl border px-4 py-4 ${
                          theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                          {item.label}
                        </p>
                        <p className={`mt-2 text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className={`flex flex-col gap-3 border-t px-6 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8 ${
              theme === 'dark' ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'
            }`}
          >
            <p>© 2026 Airfare Price Index</p>
            <p>Designed for airline comparison, search clarity, and faster decisions.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
