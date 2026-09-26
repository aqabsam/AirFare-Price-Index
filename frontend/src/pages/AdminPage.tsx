import { useEffect, useMemo, useState } from 'react'
import { Activity, RefreshCw, ShieldCheck, TimerReset } from 'lucide-react'
import { fetchFareCollectionSnapshots, fetchFareCollectionStatus, fetchFareSourceHealth, runFareCollection } from '@/services/fareApi'
import { hideProviderBrand } from '@/services/displayText'
import type { FareCollectionStatus, FareSnapshot, FareSourceHealthResponse } from '@/types/fare'

type AdminPageProps = {
  theme: 'dark' | 'light'
}

function formatTime(value: string | null) {
  if (!value) {
    return 'Not run yet'
  }

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(value))
}

export function AdminPage({ theme }: AdminPageProps) {
  const [status, setStatus] = useState<FareCollectionStatus | null>(null)
  const [snapshots, setSnapshots] = useState<FareSnapshot[]>([])
  const [sourceHealth, setSourceHealth] = useState<FareSourceHealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  async function loadState() {
    setLoading(true)
    setError('')
    try {
      const [statusPayload, snapshotPayload, sourceHealthPayload] = await Promise.all([
        fetchFareCollectionStatus(),
        fetchFareCollectionSnapshots(),
        fetchFareSourceHealth(),
      ])
      setStatus(statusPayload.status)
      setSnapshots(snapshotPayload)
      setSourceHealth(sourceHealthPayload)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to load admin state.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadState()
  }, [])

  async function handleRunCollection() {
    setRunning(true)
    setError('')
    try {
      await runFareCollection()
      await loadState()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to run collection.')
    } finally {
      setRunning(false)
    }
  }

  const visibleSnapshots = useMemo(() => snapshots.slice(0, 10), [snapshots])
  const visibleSources = useMemo(() => sourceHealth?.sources.filter((source) => source.sourceType !== 'duffel' && !source.name.toLowerCase().includes('duffel') && !source.url.toLowerCase().includes('duffel')).slice(0, 8) ?? [], [sourceHealth])

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
                Admin
              </p>
              <h1 className={`mt-3 text-4xl font-bold sm:text-5xl ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                Collection control, snapshot health, and ingestion status.
              </h1>
              <p className={`mt-4 max-w-2xl text-base leading-8 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                Trigger the collector, review the latest run, and confirm that the stored fares powering search,
                analytics, and the airfare index are up to date.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { icon: Activity, label: 'Status', value: status?.status ?? 'idle' },
                  { icon: ShieldCheck, label: 'Trigger', value: status?.trigger ?? 'startup' },
                  { icon: TimerReset, label: 'Snapshots', value: String(status?.snapshotCount ?? snapshots.length) },
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
                <div className={`rounded-[28px] border p-5 ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                  <p className={`text-sm font-semibold tracking-[0.22em] uppercase ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
                    Last started
                  </p>
                  <p className={`mt-3 text-sm leading-7 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                    {formatTime(status?.startedAt ?? null)}
                  </p>
                </div>
                <div className={`rounded-[28px] border p-5 ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                  <p className={`text-sm font-semibold tracking-[0.22em] uppercase ${theme === 'dark' ? 'text-amber-200' : 'text-amber-700'}`}>
                    Last finished
                  </p>
                  <p className={`mt-3 text-sm leading-7 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                    {formatTime(status?.finishedAt ?? null)}
                  </p>
                </div>
              </div>
            </div>

            <div
              className={`rounded-[28px] border p-5 ${
                theme === 'dark' ? 'border-white/10 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-sm font-semibold tracking-[0.22em] uppercase ${theme === 'dark' ? 'text-amber-200' : 'text-amber-700'}`}>
                    Control
                  </p>
                  <h2 className={`mt-2 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                    Trigger fare collection
                  </h2>
                </div>
                <RefreshCw className={theme === 'dark' ? 'text-teal-200' : 'text-teal-700'} size={18} />
              </div>

              {error ? (
                <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {hideProviderBrand(error)}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleRunCollection}
                disabled={loading || running}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-300 to-amber-200 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-400/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <RefreshCw size={16} className={running ? 'animate-spin' : ''} />
                {running ? 'Collecting...' : 'Run collection now'}
              </button>

              <div className={`mt-5 rounded-[24px] border p-4 ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}>
                <p className={`text-sm font-semibold uppercase tracking-[0.18em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  Latest message
                </p>
                <p className={`mt-2 text-sm leading-7 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                  {status?.message ? hideProviderBrand(status.message) : 'No collection has been run yet.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`mt-6 rounded-[28px] border p-6 ${
            theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'
          }`}
        >
          <p className={`text-sm font-semibold tracking-[0.24em] uppercase ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
            Source health
          </p>
          <h3 className={`mt-3 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
            Configured airlines and OTAs
          </h3>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {loading ? (
              <div className={`rounded-2xl border px-4 py-6 text-sm ${theme === 'dark' ? 'border-white/10 bg-white/5 text-slate-300' : 'border-slate-200 bg-white text-slate-600'}`}>
                Loading source health...
              </div>
            ) : visibleSources.length ? (
              visibleSources.map((source) => (
                <div
                  key={source.id}
                  className={`rounded-2xl border p-4 ${theme === 'dark' ? 'border-white/10 bg-slate-950/50' : 'border-slate-200 bg-slate-50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{source.name}</p>
                      <p className={`mt-1 text-xs uppercase tracking-[0.18em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        {source.sourceType} • {source.kind}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                        source.status === 'live'
                          ? 'bg-emerald-500/15 text-emerald-600'
                          : source.status === 'stale'
                            ? 'bg-amber-500/15 text-amber-600'
                            : 'bg-slate-500/15 text-slate-600'
                      }`}
                    >
                      {source.status}
                    </span>
                  </div>
                  <p className={`mt-3 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                    {source.snapshotCount} live rows • {source.routeCount} configured routes
                  </p>
                  <p className={`mt-2 text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    Last collected {formatTime(source.lastCollectedAt)}
                  </p>
                  <p className={`mt-2 break-all text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                    {source.url}
                  </p>
                </div>
              ))
            ) : (
              <div className={`rounded-2xl border px-4 py-6 text-sm ${theme === 'dark' ? 'border-white/10 bg-white/5 text-slate-300' : 'border-slate-200 bg-white text-slate-600'}`}>
                No source health data available yet.
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div
            className={`rounded-[28px] border p-6 ${
              theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'
            }`}
          >
            <p className={`text-sm font-semibold tracking-[0.24em] uppercase ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
              Snapshot list
            </p>
            <h3 className={`mt-3 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
              Latest stored fares
            </h3>
            <div className="mt-5 space-y-3">
              {loading ? (
                <div className={`rounded-2xl border px-4 py-6 text-sm ${theme === 'dark' ? 'border-white/10 bg-white/5 text-slate-300' : 'border-slate-200 bg-white text-slate-600'}`}>
                  Loading snapshot data...
                </div>
              ) : visibleSnapshots.length ? (
                visibleSnapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className={`rounded-2xl border px-4 py-4 ${theme === 'dark' ? 'border-white/10 bg-slate-950/50' : 'border-slate-200 bg-slate-50'}`}
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-semibold">
                        {snapshot.origin} → {snapshot.destination}
                      </p>
                      <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
                        {snapshot.airline} {snapshot.flightNumber}
                      </p>
                    </div>
                    <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                      {snapshot.departureDate} at {snapshot.departureTime} • {snapshot.currency} {snapshot.price}
                    </p>
                    <p className={`mt-1 text-xs uppercase tracking-[0.18em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      {snapshot.seatsRemaining} seats • collected {new Intl.DateTimeFormat('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(snapshot.collectedAt))}
                    </p>
                  </div>
                ))
              ) : (
                <div className={`rounded-2xl border px-4 py-6 text-sm ${theme === 'dark' ? 'border-white/10 bg-white/5 text-slate-300' : 'border-slate-200 bg-white text-slate-600'}`}>
                  No snapshots available yet.
                </div>
              )}
            </div>
          </div>

          <div
            className={`rounded-[28px] border p-6 ${
              theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'
            }`}
          >
            <p className={`text-sm font-semibold tracking-[0.24em] uppercase ${theme === 'dark' ? 'text-amber-200' : 'text-amber-700'}`}>
              Run metadata
            </p>
            <h3 className={`mt-3 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
              Ingestion status
            </h3>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Sources', value: String(status?.sourceCount ?? 0) },
                { label: 'Snapshots', value: String(status?.snapshotCount ?? snapshots.length) },
                { label: 'Status', value: status?.status ?? 'idle' },
                { label: 'Trigger', value: status?.trigger ?? 'startup' },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`rounded-2xl border p-4 ${theme === 'dark' ? 'border-white/10 bg-slate-950/50' : 'border-slate-200 bg-slate-50'}`}
                >
                  <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    {item.label}
                  </p>
                  <p className={`mt-2 text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
