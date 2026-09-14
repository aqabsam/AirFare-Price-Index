
import { ArrowRight, Database, PlaneTakeoff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { travelVisuals } from '@/data/visuals'

type SearchHeroProps = {
  theme: 'dark' | 'light'
}

export function SearchHero({ theme }: SearchHeroProps) {
  return (
    <section
      id="home"
      className={`relative overflow-hidden transition-colors duration-300 ${
        theme === 'dark'
          ? 'bg-[radial-gradient(circle_at_top,_rgba(8,15,30,0.3),_rgba(2,6,23,1)_60%)]'
          : 'bg-[linear-gradient(180deg,#f8fbff_0%,#edf4fb_100%)]'
      }`}
    >
      <div
        className={`absolute inset-0 ${
          theme === 'dark'
            ? 'bg-[radial-gradient(circle_at_top_right,_rgba(45,212,191,0.16),_transparent_28%),radial-gradient(circle_at_top_left,_rgba(251,191,36,0.14),_transparent_22%)]'
            : 'bg-[radial-gradient(circle_at_top_right,_rgba(45,212,191,0.09),_transparent_30%),radial-gradient(circle_at_top_left,_rgba(251,191,36,0.11),_transparent_24%)]'
        }`}
      />

      <div className="relative mx-auto grid w-full max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:py-16">

        {/* LEFT SIDE */}
        <div className="flex flex-col justify-center">
          <div className="max-w-3xl">

            {/* Badge */}
            <span
              className={`inline-flex items-center gap-3 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                theme === 'dark'
                  ? 'border-white/10 bg-white/5 text-white shadow-lg shadow-slate-950/20'
                  : 'border-slate-200 bg-white/85 text-slate-700 shadow-lg shadow-slate-200/50'
              }`}
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#30d8d1] via-[#66e7d8] to-[#f7c84d] text-slate-950">
                <PlaneTakeoff size={14} />
              </span>

              <span>Airfare Price Index</span>
            </span>

            {/* Heading */}
            <h1
              className={`mt-6 max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl ${
                theme === 'dark' ? 'text-white' : 'text-slate-950'
              }`}
            >
              A dashboard-first UI for airfare tracking, analysis, and explorer views.
            </h1>

            {/* Description */}
            <p
              className={`mt-5 max-w-2xl text-base leading-8 sm:text-lg ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
              }`}
            >
              Start here for the overview, then move through Search, Airfare Index,
              Analytics, Data Explorer, and About in a clean left-to-right workflow.
            </p>

            {/* Buttons */}
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/index"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-300 to-amber-200 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-400/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-teal-400/25"
              >
                Open Airfare Index
                <ArrowRight size={15} />
              </Link>

              <Link
                to="/explorer"
                className={`inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                  theme === 'dark'
                    ? 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                    : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Database size={15} />
                Open Data Explorer
              </Link>
            </div>

          </div>
        </div>

        {/* RIGHT SIDE BOX */}
        <aside
          className={`overflow-hidden rounded-[32px] border p-4 shadow-[0_24px_80px_rgba(15,23,42,0.12)] transition-all duration-300 hover:-translate-y-1 lg:p-5 ${
            theme === 'dark'
              ? 'border-white/10 bg-white/5 shadow-slate-950/30'
              : 'border-slate-200 bg-white shadow-slate-200/60'
          }`}
        >

          {/* IMAGE */}
          <div className="relative overflow-hidden rounded-[24px] border border-white/10">

            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${travelVisuals.hero})`,
              }}
              aria-hidden="true"
            />

            <div
              className={`absolute inset-0 ${
                theme === 'dark'
                  ? 'bg-[linear-gradient(180deg,rgba(2,6,23,0.08)_0%,rgba(2,6,23,0.72)_100%)]'
                  : 'bg-[linear-gradient(180deg,rgba(248,251,255,0.04)_0%,rgba(15,23,42,0.58)_100%)]'
              }`}
              aria-hidden="true"
            />

            <div className="relative flex h-60 flex-col justify-end p-5">

              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-md">
                Live route view
              </div>

              <p className="mt-3 max-w-sm text-sm leading-6 text-slate-100">
                Realistic airport and route imagery gives the home panel a grounded
                aviation feel.
              </p>

            </div>
          </div>

          {/* WEBSITE OVERVIEW */}
          <div className="mt-5">

            <p
              className={`text-sm font-semibold uppercase tracking-[0.22em] ${
                theme === 'dark'
                  ? 'text-teal-200'
                  : 'text-teal-700'
              }`}
            >
              Website overview
            </p>

            <h2
              className={`mt-2 text-2xl font-bold ${
                theme === 'dark'
                  ? 'text-white'
                  : 'text-slate-950'
              }`}
            >
              Built for route search, index tracking, and fare analysis.
            </h2>

            <p
              className={`mt-2 text-sm leading-7 ${
                theme === 'dark'
                  ? 'text-slate-300'
                  : 'text-slate-600'
              }`}
            >
              Use the navigation below to move from overview to live flight search,
              fare index, analytics, raw data, and project details.
            </p>

          </div>

        </aside>
      </div>
    </section>
  )
}

