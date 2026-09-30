import { useEffect, useRef, useState } from 'react'
import { Button, DemoPage, checkClass, inputClass } from './ui'

const targets = [
  {
    id: 'moon',
    name: 'Měsíc',
    description: 'Krátery podél hranice světla a stínu.',
    category: 'Přirozený satelit',
    time: '19:45–20:10',
    equipment: 'Snadný cíl',
  },
  {
    id: 'saturn',
    name: 'Saturn',
    description: 'Prstence a drobný světelný bod měsíce Titan.',
    category: 'Planeta',
    time: '20:00–20:25',
    equipment: 'Dalekohled',
  },
  {
    id: 'andromeda',
    name: 'Galaxie v Andromedě',
    description: 'Vzdálená galaxie jako jemný obláček světla.',
    category: 'Galaxie · M31',
    time: '20:15–20:40',
    equipment: 'Tmavá obloha',
  },
  {
    id: 'hercules',
    name: 'Hvězdokupa v Herkulovi',
    description: 'Stovky hvězd zdánlivě těsně vedle sebe.',
    category: 'Kulová hvězdokupa · M13',
    time: '19:50–20:20',
    equipment: 'Dalekohled',
  },
  {
    id: 'albireo',
    name: 'Albireo',
    description: 'Dvojice hvězd se zlatým a modrým odstínem.',
    category: 'Dvojhvězda',
    time: '20:10–20:35',
    equipment: 'Snadný cíl',
  },
]
const filters = [
  { id: 'all', label: 'Všechny' },
  { id: 'remaining', label: 'Zbývá' },
  { id: 'done', label: 'Hotovo' },
] as const
type Filter = (typeof filters)[number]['id']
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('cs')

export const ObservationList = () => {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [observed, setObserved] = useState<string[]>([])
  const search = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const filterGroup = useRef<HTMLFieldSetElement>(null)
  const restoreListFocus = useRef(false)
  const visible = targets.filter((target) => {
    const done = observed.includes(target.id)
    return (
      (filter === 'all' || (filter === 'done' ? done : !done)) &&
      normalize(`${target.name} ${target.category}`).includes(normalize(query.trim()))
    )
  })

  useEffect(() => {
    if (!restoreListFocus.current) return
    restoreListFocus.current = false
    const next = list.current?.querySelector<HTMLInputElement>('input')
    const activeFilter =
      filterGroup.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
    ;(next ?? activeFilter)?.focus()
  }, [observed])

  const toggle = (id: string) => {
    // A filtered-out checkbox must hand focus to the next result or active filter.
    restoreListFocus.current = filter !== 'all'
    setObserved((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
    )
  }
  const clearFilters = () => {
    setQuery('')
    setFilter('all')
    search.current?.focus()
  }

  return (
    <DemoPage
      night
      width="max-w-[780px]"
      fiction="Smyšlený pozorovací plán pro demo Spectry. Časy a viditelnost objektů jsou ilustrativní, nejde o astronomickou předpověď. Zaškrtnutí zůstává jen do obnovení stránky."
    >
      <div className="mb-7 flex items-start justify-between gap-6 sm:items-end">
        <div className="min-w-0">
          <p className="text-muted">Pozorovací zápisník · 16. října 2026</p>
          <h1 className="mt-2.5 text-[1.8rem] tracking-[-0.035em] sm:text-[2.2rem]">
            Dnes se díváme nahoru.
          </h1>
        </div>
        <div className="shrink-0 text-right">
          <strong className="text-[1.8rem] tracking-[-0.04em] tabular-nums">
            {observed.length} / {targets.length}
          </strong>
          <small className="block text-[13px] text-muted">pozorováno</small>
        </div>
      </div>
      <progress
        value={observed.length}
        max={targets.length}
        aria-label="Počet pozorovaných objektů"
        className="mb-7 block h-[5px] w-full accent-accent"
      />
      <div className="mb-5 flex flex-col gap-3.5 min-[561px]:flex-row min-[561px]:items-end min-[561px]:justify-between min-[561px]:gap-5">
        <label className="flex-1 text-sm font-semibold min-[561px]:max-w-[280px]">
          Najít objekt
          <input
            ref={search}
            type="search"
            placeholder="Například Saturn"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={inputClass}
          />
        </label>
        <fieldset
          ref={filterGroup}
          className="flex min-w-0 gap-1 rounded-lg border border-line p-1"
        >
          <legend className="sr-only">Filtrovat pozorovací seznam</legend>
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
              className="min-h-11 flex-1 cursor-pointer rounded-md border border-transparent px-3 py-2 text-sm font-semibold hover:border-accent aria-pressed:bg-tint min-[561px]:flex-none"
            >
              {item.label}
            </button>
          ))}
        </fieldset>
      </div>
      <ul ref={list} className="border-t border-line" aria-label="Objekty k pozorování">
        {visible.map((target) => {
          const done = observed.includes(target.id)
          return (
            <li
              key={target.id}
              className="grid grid-cols-[30px_minmax(0,1fr)] items-center gap-3 border-b border-line px-1 py-[22px] min-[561px]:grid-cols-[42px_minmax(0,1fr)_auto] min-[561px]:gap-[15px]"
            >
              <label className="flex min-h-11 cursor-pointer items-center justify-center">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => toggle(target.id)}
                  aria-label={`Označit ${target.name} jako pozorované`}
                  className={checkClass}
                />
              </label>
              <div>
                <h2 className={`text-lg ${done ? 'text-muted line-through decoration-1' : ''}`}>
                  {target.name}
                </h2>
                <p className="mt-[5px] text-sm text-muted">{target.description}</p>
                <span className="mt-[5px] block text-[13px] text-muted">{target.category}</span>
              </div>
              <div className="col-start-2 text-sm tabular-nums min-[561px]:col-start-auto min-[561px]:text-right">
                {target.time}
                <span className="mt-[5px] block text-[13px] text-muted">{target.equipment}</span>
              </div>
            </li>
          )
        })}
      </ul>
      {visible.length === 0 && (
        <div className="py-8 text-center">
          <p className="mb-4">Tomuto filtru neodpovídá žádný objekt.</p>
          <Button onClick={clearFilters}>Zobrazit všechny objekty</Button>
        </div>
      )}
      <div className="mt-[22px] flex flex-col items-start justify-between gap-3.5 min-[561px]:flex-row min-[561px]:items-center">
        <output className="block max-w-[40ch] text-sm">
          {observed.length === targets.length
            ? 'Celý plán je hotový. Dnes jste viděli všech pět objektů.'
            : `Pozorováno ${observed.length} z ${targets.length}. Aktuálně zobrazeno: ${visible.length}.`}
        </output>
        <Button
          className="text-sm"
          disabled={observed.length === 0}
          onClick={() => {
            setObserved([])
            setFilter('all')
            setQuery('')
            filterGroup.current?.querySelector<HTMLButtonElement>('button')?.focus()
          }}
        >
          Vynulovat pozorování
        </Button>
      </div>
    </DemoPage>
  )
}
