import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button, DemoPage, checkClass, inputClass } from './ui'

const dates = [
  { value: '16. října 2026 v 19:30', label: 'Pá 16. října · 19:30' },
  { value: '17. října 2026 v 19:30', label: 'So 17. října · 19:30' },
]
const pricing = { adult: 390, child: 190, tea: 40, capacity: 6 }
const money = (amount: number) =>
  new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 0,
  }).format(amount)

export const Booking = () => {
  const [date, setDate] = useState(dates[0].value)
  const [adults, setAdults] = useState(1)
  const [children, setChildren] = useState(0)
  const [tea, setTea] = useState(false)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState(false)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const childrenInput = useRef<HTMLSelectElement>(null)
  const dateInput = useRef<HTMLSelectElement>(null)
  const success = useRef<HTMLElement>(null)
  const people = adults + children
  const overCapacity = people > pricing.capacity
  const tickets = adults * pricing.adult + children * pricing.child
  const teaPrice = tea ? pricing.tea : 0
  const total = tickets + teaPrice

  useEffect(() => {
    if (confirmation) success.current?.focus()
  }, [confirmation])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setConfirmation(null)
    if (overCapacity) {
      childrenInput.current?.focus()
      return
    }
    if (!name.trim()) {
      setNameError(true)
      nameInput.current?.focus()
      return
    }
    setConfirmation(
      `${name.trim()}, váš termín je ${date}. Počet osob: ${people}. Celkem ${money(total)}. Toto je místní simulace; žádná rezervace nevznikla.`,
    )
  }

  return (
    <DemoPage fiction="Perseid je smyšlený projekt pro zkoušení Spectry. Termíny, kapacity i ceny jsou ukázkové. Nic se neodesílá, neukládá ani neplatí.">
      <h1 className="text-[1.8rem] tracking-[-0.035em] sm:text-[2.2rem]">
        Vezměte si večer volno.
        <br />
        Obloha má program.
      </h1>
      <p className="mt-3 mb-[26px] max-w-[60ch] text-muted">
        Vyberte si termín a místa na společné pozorování. O zbytek se postará průvodce u
        dalekohledu.
      </p>
      <div className="grid overflow-hidden rounded-xl border border-line bg-surface min-[661px]:grid-cols-[0.85fr_1.3fr]">
        <aside
          className="bg-ink p-5 text-white min-[361px]:p-6 min-[661px]:p-[30px]"
          aria-labelledby="event-title"
        >
          <p className="text-sm text-[oklch(0.8_0.03_247)]">Malá hvězdárna · venkovní terasa</p>
          <h2 id="event-title" className="my-3.5 text-[1.75rem]">
            Podzimní obloha
            <br />z první řady.
          </h2>
          <p className="text-[15px] text-[oklch(0.87_0.017_247)]">
            Měsíc, planety a vzdálené hvězdokupy. Malá skupina, velký dalekohled a prostor na
            všechny vaše otázky.
          </p>
          <span className="my-4 inline-block rounded bg-[oklch(0.36_0.038_247)] px-2.5 py-[5px] text-[13px] min-[661px]:mt-[22px] min-[661px]:mb-[34px]">
            90 minut · od 6 let · v češtině
          </span>
          <h3 className="text-base">Jak večer probíhá</h3>
          <ol className="mt-5 mb-5 min-[661px]:mb-8">
            {[
              { time: '+00 min', duration: 'PT0M', title: 'Seznámení s oblohou' },
              { time: '+15 min', duration: 'PT15M', title: 'Pozorování u dalekohledu' },
              { time: '+70 min', duration: 'PT70M', title: 'Otázky a hledání souhvězdí' },
            ].map((item) => (
              <li
                key={item.duration}
                className="grid grid-cols-[55px_1fr] gap-3 border-b border-[oklch(0.44_0.03_247)] py-3 text-sm"
              >
                <time dateTime={item.duration} className="text-[oklch(0.8_0.03_247)] tabular-nums">
                  {item.time}
                </time>
                <span>{item.title}</span>
              </li>
            ))}
          </ol>
          <p className="pt-1 text-[13px] text-[oklch(0.87_0.017_247)]">
            Vezměte si teplou vrstvu. Při zatažené obloze si vyberete nový termín nebo vrácení celé
            částky.
          </p>
        </aside>
        <form
          noValidate
          onSubmit={submit}
          onChange={() => setConfirmation(null)}
          aria-label="Ukázková rezervace"
          className="min-w-0 p-5 min-[361px]:p-6 min-[661px]:p-[30px]"
        >
          <fieldset className="mb-6 min-w-0">
            <legend className="mb-3 font-bold">Váš večer</legend>
            <label htmlFor="date" className="block text-sm font-semibold">
              Termín
            </label>
            <select
              ref={dateInput}
              id="date"
              name="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={inputClass}
            >
              {dates.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
              <option disabled value="full">
                So 24. října · obsazeno
              </option>
            </select>
            <small className="text-[13px] text-muted">
              Ukázková kapacita: nejvýše {pricing.capacity} osob na rezervaci.
            </small>
            <div className="mt-3.5 grid gap-3.5 min-[361px]:grid-cols-2">
              <label className="flex flex-col justify-between text-sm font-semibold">
                Dospělí · {money(pricing.adult)}
                <select
                  id="adults"
                  name="adults"
                  value={adults}
                  onChange={(event) => setAdults(Number(event.target.value))}
                  className={inputClass}
                  aria-invalid={overCapacity}
                  aria-describedby={overCapacity ? 'capacity-error' : undefined}
                >
                  {[1, 2, 3, 4, 5, 6].map((count) => (
                    <option key={count}>{count}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col justify-between text-sm font-semibold">
                Děti 6–15 let · {money(pricing.child)}
                <select
                  ref={childrenInput}
                  id="children"
                  name="children"
                  value={children}
                  onChange={(event) => setChildren(Number(event.target.value))}
                  className={inputClass}
                  aria-invalid={overCapacity}
                  aria-describedby={overCapacity ? 'capacity-error' : undefined}
                >
                  {[0, 1, 2, 3, 4, 5].map((count) => (
                    <option key={count}>{count}</option>
                  ))}
                </select>
              </label>
            </div>
            {overCapacity && (
              <p id="capacity-error" className="mt-2 text-sm text-danger" role="alert">
                Na jednu rezervaci se vejde nejvýše {pricing.capacity} osob. Upravte počet dospělých
                nebo dětí.
              </p>
            )}
            <div className="mt-4 flex items-start gap-2.5 text-sm">
              <input
                id="tea"
                name="tea"
                type="checkbox"
                checked={tea}
                onChange={(event) => setTea(event.target.checked)}
                className={`${checkClass} mt-[3px]`}
              />
              <label htmlFor="tea" className="cursor-pointer">
                <strong className="block font-semibold">
                  Termoska čaje pro skupinu · +{money(pricing.tea)}
                </strong>
                <small className="text-[13px] text-muted">
                  Jednou za rezervaci, bez ohledu na počet osob.
                </small>
              </label>
            </div>
          </fieldset>
          <fieldset className="mb-6 min-w-0">
            <legend className="mb-3 font-bold">Komu držíme místo?</legend>
            <label htmlFor="name" className="block text-sm font-semibold">
              Jméno pro rezervaci
            </label>
            <input
              ref={nameInput}
              id="name"
              name="name"
              autoComplete="off"
              required
              maxLength={60}
              placeholder="Třeba Alex"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                if (event.target.value.trim()) setNameError(false)
              }}
              aria-invalid={nameError || undefined}
              aria-describedby={`name-help${nameError ? ' name-error' : ''}`}
              className={inputClass}
            />
            <small id="name-help" className="text-[13px] text-muted">
              Pro demo stačí smyšlené jméno. E-mail ani kartu nepotřebujeme.
            </small>
            {nameError && (
              <p id="name-error" className="mt-2 text-sm text-danger" role="alert">
                Napište jméno, pod kterým rezervaci vyzkoušíte.
              </p>
            )}
          </fieldset>
          <div className="mt-[22px] border-t border-line pt-[18px]" aria-label="Cena rezervace">
            <div className="mb-2 flex justify-between gap-3 text-sm">
              <span>Vstupné · počet osob: {people}</span>
              <span>{money(tickets)}</span>
            </div>
            <div className="mb-2 flex justify-between gap-3 text-sm">
              <span>Čaj pro skupinu</span>
              <span>{money(teaPrice)}</span>
            </div>
            <div className="mt-4 mb-2 flex items-baseline justify-between gap-3 font-bold">
              <span>Celkem</span>
              <output
                aria-label="Celková cena"
                aria-live="polite"
                aria-atomic="true"
                className="text-[1.65rem] tracking-tight tabular-nums"
              >
                {money(total)}
              </output>
            </div>
            <small className="text-[13px] text-muted">
              Všechny ceny jsou konečné. Žádné další poplatky.
            </small>
          </div>
          <Button primary type="submit" className="mt-4 w-full">
            Vyzkoušet rezervaci <span aria-hidden="true">→</span>
          </Button>
          <small className="mt-2 block text-center text-[13px] text-muted">
            Pouze ukázka. Bez platby a bez odeslání údajů.
          </small>
          {confirmation && (
            <section
              ref={success}
              tabIndex={-1}
              className="mt-4 rounded-[7px] bg-tint p-4"
              aria-labelledby="success-title"
            >
              <h3 id="success-title" className="mb-2 text-base">
                Takto by vypadalo potvrzení
              </h3>
              <p className="text-sm">{confirmation}</p>
              <Button
                className="mt-3.5"
                onClick={() => {
                  setConfirmation(null)
                  dateInput.current?.focus()
                }}
              >
                Upravit údaje
              </Button>
            </section>
          )}
        </form>
      </div>
    </DemoPage>
  )
}
