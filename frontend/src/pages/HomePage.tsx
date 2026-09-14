import { SearchHero } from '@/components/SearchHero'

type HomePageProps = {
  theme: 'dark' | 'light'
}

export function HomePage({ theme }: HomePageProps) {
  return <SearchHero theme={theme} />
}
