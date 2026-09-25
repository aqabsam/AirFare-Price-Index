
import { ArrowRight, BarChart3, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { travelVisuals } from '@/data/visuals'

type SearchHeroProps = {
  theme: 'dark' | 'light'
}

export function SearchHero({ theme }: SearchHeroProps) {
  return (
    <section
      id="home"
      className={`relative min-h-screen overflow-hidden transition-colors duration-300 ${
        theme === 'dark'
          ? 'bg-[radial-gradient(circle_at_top,_rgba(8,15,30,0.3),_rgba(2,6,23,1)_60%)]'
          : 'bg-[linear-gradient(180deg,#f8fbff_0%,#edf4fb_100%)]'
      }`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${travelVisuals.hero})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      <div
        className={`absolute inset-0 ${
          theme === 'dark'
            ? 'bg-[radial-gradient(circle_at_top_right,_rgba(45,212,191,0.16),_transparent_28%),radial-gradient(circle_at_top_left,_rgba(251,191,36,0.14),_transparent_22%),linear-gradient(180deg,rgba(2,6,23,0.38),rgba(2,6,23,0.72))]'
            : 'bg-[radial-gradient(circle_at_top_right,_rgba(45,212,191,0.09),_transparent_30%),radial-gradient(circle_at_top_left,_rgba(251,191,36,0.11),_transparent_24%),linear-gradient(180deg,rgba(248,251,255,0.22),rgba(15,23,42,0.32))]'
        }`}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <h1 className="mt-2 max-w-4xl text-4xl font-black tracking-[-0.04em] text-white drop-shadow-[0_4px_30px_rgba(15,23,42,0.8)] sm:text-5xl lg:text-7xl">
            Real-Time Airfare Price Index for India
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-100/90 drop-shadow-[0_2px_20px_rgba(15,23,42,0.8)] sm:text-lg">
            Live fare tracking, route comparison, and airline pricing intelligence built from permitted airline and OTA sources for faster, smarter travel decisions.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/search"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-300 to-amber-200 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-400/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-teal-400/25"
            >
              <Search size={15} />
              Search Flights
            </Link>

            <Link
              to="/index"
              className={`inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                theme === 'dark' ? 'border-white/15 bg-slate-950/20 text-white hover:bg-slate-950/30' : 'border-white/30 bg-white/10 text-slate-50 hover:bg-white/15'
              }`}
            >
              Airfare Index
              <ArrowRight size={15} />
            </Link>

            <Link
              to="/analytics"
              className={`inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                theme === 'dark' ? 'border-white/15 bg-slate-950/20 text-white hover:bg-slate-950/30' : 'border-white/30 bg-white/10 text-slate-50 hover:bg-white/15'
              }`}
            >
              <BarChart3 size={15} />
              Analytics
            </Link>
          </div>

          <div className="mt-12 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-950/25 p-4 backdrop-blur-md">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200/75">Live routes</p>
              <p className="mt-2 text-2xl font-bold text-white">24+</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/25 p-4 backdrop-blur-md">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200/75">Airlines</p>
              <p className="mt-2 text-2xl font-bold text-white">7+</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/25 p-4 backdrop-blur-md">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200/75">Refresh</p>
              <p className="mt-2 text-2xl font-bold text-white">Realtime</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

