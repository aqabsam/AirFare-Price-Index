import { ArrowRight, BarChart3, PlaneTakeoff, Route, ShieldCheck, Workflow } from 'lucide-react'
import terminalImg from '@/assets/airport-terminal.svg'
import routeImg from '@/assets/aircraft-route.svg'
import dashboardImg from '@/assets/data-dashboard.svg'
import { AirlineMark } from '@/components/AirlineMark'
import { airlineDirectory } from '@/data/airlines'

type ProjectBriefProps = {
  theme: 'dark' | 'light'
}

const flowCards = [
  {
    icon: PlaneTakeoff,
    title: 'Airport search',
    body: 'Users enter an airport name, city, or code and start from a guided search surface.',
  },
  {
    icon: Workflow,
    title: 'Price aggregation',
    body: 'The app ranks airline offers for the chosen route and highlights the cheapest fare first.',
  },
  {
    icon: BarChart3,
    title: 'CPI support',
    body: 'Fare history can support route-level movement analysis and pricing trends.',
  },
  {
    icon: ShieldCheck,
    title: 'API-ready design',
    body: 'An airline or OTA ingestion source can be swapped in without changing the layout.',
  },
]

const airlineOrder = ['IndiGo', 'Air India', 'Air India Express', 'Akasa Air', 'SpiceJet'] as const

export function ProjectBrief({ theme }: ProjectBriefProps) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
      <section
        id="overview"
        className={`overflow-hidden rounded-[32px] border shadow-[0_18px_60px_rgba(15,23,42,0.08)] transition-all duration-300 ${
          theme === 'dark'
            ? 'border-white/10 bg-slate-950 text-white shadow-slate-950/20'
            : 'border-slate-200/70 bg-white text-slate-950'
        }`}
      >
        <div className="grid gap-8 p-6 lg:grid-cols-[1.05fr_0.95fr] lg:p-8 xl:p-10">
          <div className="space-y-6">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                theme === 'dark'
                  ? 'border-teal-300/20 bg-teal-300/10 text-teal-100'
                  : 'border-teal-300/30 bg-teal-100/70 text-teal-800'
              }`}
            >
              <Route size={15} />
              Project overview
            </span>

            <div className="space-y-4">
              <p className={`text-sm font-semibold tracking-[0.24em] uppercase ${theme === 'dark' ? 'text-amber-200' : 'text-amber-700'}`}>
                Airfare Price Index
              </p>
              <h2 className={`max-w-xl text-4xl font-bold sm:text-5xl ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                A clean route-first interface for comparing fares across India.
              </h2>
              <p className={`max-w-2xl text-base leading-8 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                Search by airport name or code, compare airline fares, and surface the cheapest route quickly.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Search mode', value: 'Airport names and codes' },
                { label: 'Display style', value: 'Dark and light themes' },
                { label: 'Output', value: 'Cheapest airline first' },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`rounded-2xl border px-4 py-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                    theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    {item.label}
                  </p>
                  <p className={`mt-2 text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="#workflow"
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                  theme === 'dark'
                    ? 'bg-teal-300 text-slate-950 hover:shadow-teal-300/20'
                    : 'bg-slate-950 text-white hover:shadow-slate-400/20'
                }`}
              >
                Explore workflow
                <ArrowRight size={15} />
              </a>
              <a
                href="#airlines"
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                  theme === 'dark'
                    ? 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                    : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Route size={15} />
                View airlines
              </a>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <figure
                className={`overflow-hidden rounded-[26px] border p-3 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:col-span-2 ${
                  theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <img src={routeImg} alt="Air route illustration" className="h-56 w-full rounded-[20px] object-cover" />
              </figure>
              <figure
                className={`overflow-hidden rounded-[26px] border p-3 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                  theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <img src={terminalImg} alt="Airport terminal illustration" className="h-40 w-full rounded-[20px] object-cover" />
              </figure>
              <figure
                className={`overflow-hidden rounded-[26px] border p-3 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                  theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <img src={dashboardImg} alt="Data dashboard illustration" className="h-40 w-full rounded-[20px] object-cover" />
              </figure>
            </div>
            <div
              className={`rounded-[26px] border p-4 transition-all duration-300 ${
                theme === 'dark' ? 'border-white/10 bg-slate-900/70' : 'border-slate-200 bg-white'
              }`}
            >
              <p className={`text-sm font-semibold tracking-[0.22em] uppercase ${theme === 'dark' ? 'text-amber-200' : 'text-amber-700'}`}>
                Visual story
              </p>
              <p className={`mt-2 text-sm leading-7 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                The imagery reflects the three pillars of the app: airport search, route comparison, and pricing
                intelligence for CPI-style analysis.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="mt-6 grid gap-4 lg:grid-cols-2">
        <div
          className={`rounded-[28px] border p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] transition-all duration-300 ${
            theme === 'dark'
              ? 'border-white/10 bg-slate-950 text-white shadow-slate-950/20'
              : 'border-slate-200/70 bg-white text-slate-950'
          }`}
        >
          <p className={`text-sm font-semibold tracking-[0.24em] uppercase ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
            Workflow
          </p>
            <h3 className={`mt-3 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
            Search to booking handoff.
            </h3>
          <div className="mt-5 grid gap-3">
            {flowCards.map((item, index) => {
              const Icon = item.icon
              return (
                <div
                  key={item.title}
                  className={`flex gap-4 rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                    theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
                    theme === 'dark' ? 'bg-teal-300 text-slate-950' : 'bg-slate-950 text-white'
                  }`}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      Step 0{index + 1}
                    </p>
                    <h4 className={`mt-1 text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                      {item.title}
                    </h4>
                    <p className={`mt-2 text-sm leading-7 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                      {item.body}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div
          className={`rounded-[28px] border p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] transition-all duration-300 ${
            theme === 'dark'
              ? 'border-white/10 bg-slate-950 text-white shadow-slate-950/20'
              : 'border-slate-200/70 bg-white text-slate-950'
          }`}
        >
          <p className={`text-sm font-semibold tracking-[0.24em] uppercase ${theme === 'dark' ? 'text-amber-200' : 'text-amber-700'}`}>
            Airlines
          </p>
            <h3 className={`mt-3 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
            Major Indian carriers with current branding.
            </h3>
          <div className="mt-5 grid gap-3">
            {airlineOrder.map((airline) => (
              <AirlineMark
                key={airline}
                airline={airline}
                code={airlineDirectory[airline].code}
                logoUrl={airlineDirectory[airline].logoUrl}
              />
            ))}
          </div>
          <div
            className={`mt-5 rounded-[24px] border p-4 ${
              theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <p className={`text-sm font-semibold tracking-[0.2em] uppercase ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
              Project benefit
            </p>
              <p className={`mt-2 text-sm leading-7 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
              Compare airlines from one screen, then click through to the carrier's official route page.
            </p>
          </div>
        </div>
      </section>

      <section id="data" className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div
          className={`overflow-hidden rounded-[28px] border shadow-[0_18px_60px_rgba(15,23,42,0.08)] transition-all duration-300 ${
            theme === 'dark'
              ? 'border-white/10 bg-slate-950 text-white shadow-slate-950/20'
              : 'border-slate-200/70 bg-white text-slate-950'
          }`}
        >
          <div className="p-6">
            <p className={`text-sm font-semibold tracking-[0.24em] uppercase ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
              Data and CPI support
            </p>
            <h3 className={`mt-3 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
              Designed for fare tracking, comparison, and inflation analysis.
            </h3>
              <p className={`mt-4 text-sm leading-7 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
              The project can sit on top of a live airline API or scraper output and present the cheapest route in
              a consistent layout.
            </p>
          </div>
          <img src={dashboardImg} alt="Analytics dashboard" className="h-72 w-full object-cover" />
        </div>

        <div className="grid gap-4">
          <div
            className={`rounded-[28px] border p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] transition-all duration-300 ${
              theme === 'dark'
                ? 'border-white/10 bg-slate-950 text-white shadow-slate-950/20'
                : 'border-slate-200/70 bg-white text-slate-950'
            }`}
          >
            <p className={`text-sm font-semibold tracking-[0.24em] uppercase ${theme === 'dark' ? 'text-amber-200' : 'text-amber-700'}`}>
              What users see
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { label: 'From airport', detail: 'Full airport name with route icon' },
                { label: 'To airport', detail: 'Landing icon and friendly label' },
                { label: 'Travel date', detail: 'Calendar-based selection' },
                { label: 'Search results', detail: 'Cheapest fare highlighted first' },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`rounded-2xl border p-4 ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}
                >
                  <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>{item.label}</p>
                  <p className={`mt-1 text-sm leading-6 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div
            className={`rounded-[28px] border p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] transition-all duration-300 ${
              theme === 'dark'
                ? 'border-white/10 bg-slate-950 text-white shadow-slate-950/20'
                : 'border-slate-200/70 bg-white text-slate-950'
            }`}
          >
            <p className={`text-sm font-semibold tracking-[0.24em] uppercase ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
              Images in the flow
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[terminalImg, routeImg, dashboardImg].map((src, index) => (
                <div
                  key={src}
                  className={`overflow-hidden rounded-2xl border ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}
                >
                  <img src={src} alt={`Project visual ${index + 1}`} className="h-28 w-full object-cover" />
                </div>
              ))}
            </div>
            <p className={`mt-4 text-sm leading-7 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
              These visuals keep the UI engaging without drifting away from the core project: aviation search,
              comparison, and price intelligence.
            </p>
          </div>
        </div>
      </section>

    </main>
  )
}
