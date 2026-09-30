import { useEffect, useRef, useState } from 'react'
import { Button, DemoPage, checkClass } from './ui'

const resolutions = [
  {
    value: '17. října 2026 v 19:30',
    label: 'Sobota 17. října · 19:30',
    note: 'Stejný program, bez doplatku.',
  },
  {
    value: '30. října 2026 v 18:30',
    label: 'Pátek 30. října · 18:30',
    note: 'Stejný program, bez doplatku.',
  },
  { value: 'refund', label: 'Vrácení celé částky', note: '780 Kč za oba dospělé.' },
]
type Stage = 'intro' | 'options' | 'result'

export const WeatherAlert = () => {
  const [stage, setStage] = useState<Stage>('intro')
  const [choice, setChoice] = useState(resolutions[0].value)
  const trigger = useRef<HTMLButtonElement>(null)
  const options = useRef<HTMLDivElement>(null)
  const result = useRef<HTMLElement>(null)
  const interacted = useRef(false)

  const changeStage = (next: Stage) => {
    interacted.current = true
    setStage(next)
  }
  useEffect(() => {
    if (!interacted.current) return
    if (stage === 'intro') trigger.current?.focus()
    if (stage === 'options')
      options.current?.querySelector<HTMLInputElement>('input:checked')?.focus()
    if (stage === 'result') result.current?.focus()
  }, [stage])

  return (
    <DemoPage
      width="max-w-[580px]"
      fiction="Smyšlená událost i předpověď pro demo Spectry. Žádná rezervace se nemění a žádné peníze se neposílají."
    >
      <section
        className="rounded-xl border border-line bg-surface p-[22px] min-[421px]:p-[30px]"
        aria-labelledby="weather-title"
      >
        <p className="mb-4 flex items-center gap-2 text-[13px] font-semibold text-[oklch(0.4_0.085_65)]">
          <span
            className="size-[9px] shrink-0 rounded-full bg-[oklch(0.58_0.12_65)]"
            aria-hidden="true"
          />
          Změna programu · ukázkový scénář
        </p>
        <h1 id="weather-title" className="text-[1.8rem] tracking-[-0.035em]">
          Dnes mají přednost mraky.
        </h1>
        <p className="mt-3 mb-5 text-muted">
          Pozorování 16. října rušíme kvůli zatažené obloze. Vyberte si jiný večer, nebo vrácení
          celé částky.
        </p>
        <div className="my-[22px] flex flex-wrap justify-between gap-3 border-y border-line py-4 text-sm">
          <div>
            <strong className="block">Podzimní obloha</strong>
            <span>16. října 2026 · 19:30</span>
          </div>
          <div>
            <strong className="block">2 dospělí · 780 Kč</strong>
            <span>Ukázková rezervace P-1042</span>
          </div>
        </div>
        <details className="mb-6 text-sm">
          <summary className="min-h-11 cursor-pointer py-2.5 font-semibold">
            Co se stane s mojí rezervací?
          </summary>
          <p className="mt-2 text-muted">
            Přesun na náhradní termín je bez doplatku. Pokud vám termíny nevyhovují, můžete požádat
            o vrácení 780 Kč. V tomto demu se pouze zobrazí potvrzení vaší volby.
          </p>
        </details>
        {stage === 'intro' && (
          <button
            ref={trigger}
            type="button"
            aria-expanded={false}
            aria-controls="options"
            onClick={() => changeStage('options')}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[7px] bg-accent px-[18px] py-2.5 font-semibold text-white transition-colors hover:bg-ink motion-reduce:transition-none"
          >
            Vybrat řešení <span aria-hidden="true">→</span>
          </button>
        )}
        <div ref={options} id="options" hidden={stage !== 'options'}>
          <fieldset className="mb-5">
            <legend className="mb-2.5 font-bold">Jak chcete pokračovat?</legend>
            {resolutions.map((resolution, index) => (
              <div
                key={resolution.value}
                className="flex items-start gap-2.5 border-b border-line py-3.5 text-sm"
              >
                <input
                  id={`resolution-${index}`}
                  type="radio"
                  name="resolution"
                  value={resolution.value}
                  checked={choice === resolution.value}
                  onChange={() => setChoice(resolution.value)}
                  className={`${checkClass} mt-1`}
                />
                <label htmlFor={`resolution-${index}`} className="flex-1 cursor-pointer">
                  <strong className="block font-semibold">{resolution.label}</strong>
                  <small className="text-[13px] text-muted">{resolution.note}</small>
                </label>
              </div>
            ))}
          </fieldset>
          <div className="flex flex-wrap gap-2.5 max-[420px]:*:w-full">
            <Button primary onClick={() => changeStage('result')}>
              Potvrdit ukázkovou volbu
            </Button>
            <Button onClick={() => changeStage('intro')}>Rozhodnout později</Button>
          </div>
        </div>
        {stage === 'result' && (
          <section
            ref={result}
            tabIndex={-1}
            className="mt-5 rounded-md bg-tint p-[15px]"
            aria-label="Výsledek ukázkové volby"
          >
            <p className="mb-3">
              {choice === 'refund'
                ? 'Zvolili jste vrácení 780 Kč za oba dospělé. Jde pouze o ukázku, žádná platba neproběhla.'
                : `Zvolili jste ${choice} pro 2 dospělé. Cena zůstává 780 Kč, bez doplatku. Jde pouze o ukázku, termín se nikde nerezervoval.`}
            </p>
            <Button onClick={() => changeStage('options')}>Zkusit jinou možnost</Button>
          </section>
        )}
      </section>
    </DemoPage>
  )
}
