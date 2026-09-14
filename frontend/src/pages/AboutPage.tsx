import { BadgeIndianRupee, Database, Info, ShieldCheck } from 'lucide-react'
import { travelVisuals } from '@/data/visuals'

type AboutPageProps = {
  theme: 'dark' | 'light'
}

export function AboutPage({ theme }: AboutPageProps) {
  return (
    <section className={`py-10 ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className={`rounded-[32px] border shadow-[0_18px_60px_rgba(15,23,42,0.08)] ${
            theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'
          }`}
        >
          <div className="grid gap-8 p-6 lg:grid-cols-[1.02fr_0.98fr] lg:p-8 xl:p-10">
            <div>
              <p className={`text-sm font-semibold tracking-[0.24em] uppercase ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
                About
              </p>
              <h1 className={`mt-3 text-4xl font-bold sm:text-5xl ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                Project, methodology, data sources, and index calculation.
              </h1>
              <p className={`mt-4 max-w-2xl text-base leading-8 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                This page explains what the project is, where the numbers come from, and how the airfare index is
                assembled so the analytics screens stay transparent.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { icon: Info, label: 'Project', value: 'Airfare Price Index' },
                  { icon: Database, label: 'Data source', value: 'Stored snapshots + samples' },
                  { icon: ShieldCheck, label: 'Method', value: 'Route-level comparison' },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <div
                      key={item.label}
                      className={`rounded-3xl border p-4 ${
                        theme === 'dark' ? 'border-white/10 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`grid h-10 w-10 place-items-center rounded-2xl ${theme === 'dark' ? 'bg-teal-300 text-slate-950' : 'bg-slate-950 text-white'}`}>
                          <Icon size={16} />
                        </div>
                        <div>
                          <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
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

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div
                  className={`rounded-[28px] border p-5 ${
                    theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <p className={`text-sm font-semibold tracking-[0.22em] uppercase ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
                    Methodology
                  </p>
                  <p className={`mt-3 text-sm leading-7 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                    Compare route fares, normalize the sample to one base period, and track the movement of the lower
                    fare band over time.
                  </p>
                </div>
                <div
                  className={`rounded-[28px] border p-5 ${
                    theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <p className={`text-sm font-semibold tracking-[0.22em] uppercase ${theme === 'dark' ? 'text-amber-200' : 'text-amber-700'}`}>
                    Index logic
                  </p>
                  <p className={`mt-3 text-sm leading-7 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                    Base period equals 100.0, and later periods are scaled against it to show whether airfares are
                    rising or easing.
                  </p>
                </div>
              </div>
            </div>

            <div
              className={`relative overflow-hidden rounded-[28px] border p-5 ${
                theme === 'dark' ? 'border-white/10 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div
                className="absolute inset-0 bg-cover bg-center opacity-20"
                style={{ backgroundImage: `url(${travelVisuals.about})` }}
                aria-hidden="true"
              />
              <div
                className={`absolute inset-0 ${
                  theme === 'dark'
                    ? 'bg-[linear-gradient(180deg,rgba(2,6,23,0.18)_0%,rgba(2,6,23,0.84)_100%)]'
                    : 'bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(248,250,252,0.9)_100%)]'
                }`}
                aria-hidden="true"
              />
              <div className="relative z-10">
              <p className={`text-sm font-semibold tracking-[0.24em] uppercase ${theme === 'dark' ? 'text-amber-200' : 'text-amber-700'}`}>
                Data sources
              </p>
              <h2 className={`mt-3 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                Transparent inputs for every screen.
              </h2>
              <div className="mt-5 space-y-3">
                {[
                  ['Backend fare search', 'REST lookups for the Search view'],
                  ['Airport directory', 'City and airport normalization for routes'],
                  ['Stored snapshots', 'Index and explorer views can render from saved samples'],
                  ['Download exports', 'CSV and JSON for downstream analysis'],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className={`rounded-2xl border px-4 py-4 ${
                      theme === 'dark' ? 'border-white/10 bg-slate-950/50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>{label}</p>
                    <p className={`mt-1 text-sm leading-6 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{value}</p>
                  </div>
                ))}
              </div>

              <div className={`mt-5 rounded-[24px] border p-4 ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center gap-3">
                  <BadgeIndianRupee className={theme === 'dark' ? 'text-teal-200' : 'text-teal-700'} size={18} />
                  <p className={`text-sm font-semibold tracking-[0.2em] uppercase ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    Why it matters
                  </p>
                </div>
                <p className={`mt-3 text-sm leading-7 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                  The goal is a simple UI that still explains how the fare index and analytics are built, so the
                  interface stays useful for both quick checks and deeper review.
                </p>
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
