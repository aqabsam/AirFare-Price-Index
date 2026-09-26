import { Link } from 'react-router-dom'
import { ArrowRight, PlaneTakeoff, Search } from 'lucide-react'

type EmptyFareStateProps = {
  theme: 'dark' | 'light'
}

export function EmptyFareState({ theme }: EmptyFareStateProps) {
  return (
    <section className={`grid min-h-[60vh] place-items-center px-4 py-12 sm:px-6 ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-950'}`}>
      <div className={`w-full max-w-2xl rounded-3xl border px-6 py-10 text-center shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:px-10 sm:py-12 ${theme === 'dark' ? 'border-white/10 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
        <div className={`mx-auto grid h-16 w-16 place-items-center rounded-2xl ${theme === 'dark' ? 'bg-teal-300/15 text-teal-200' : 'bg-teal-50 text-teal-700'}`}>
          <div className="relative">
            <PlaneTakeoff size={29} strokeWidth={1.8} />
            <Search className="absolute -bottom-2 -right-3 rounded-full bg-inherit" size={16} strokeWidth={2.2} />
          </div>
        </div>
        <h1 className="mt-6 text-3xl font-bold sm:text-4xl">No Fare Data Yet</h1>
        <h2 className={`mt-3 text-lg font-semibold ${theme === 'dark' ? 'text-teal-200' : 'text-teal-800'}`}>
          Search for a flight first
        </h2>
        <p className={`mx-auto mt-3 max-w-lg text-sm leading-7 sm:text-base ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
          Perform a flight search to see your verified fare data, price trends, and flight records here. Your results will automatically appear after your search.
        </p>
        <Link
          to="/search#search"
          className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
        >
          <Search size={17} />
          Search Flights
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  )
}