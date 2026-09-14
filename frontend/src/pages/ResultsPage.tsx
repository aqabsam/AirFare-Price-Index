import { Navigate, useLocation } from 'react-router-dom'

export function ResultsPage() {
  const location = useLocation()
  return <Navigate to={`/search${location.search}`} replace />
}
