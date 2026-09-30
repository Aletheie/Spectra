import { useRef, useState } from 'react'
import { Brand, Button, buttonClass, primaryButtonClass } from './ui'

const scenarios = [
  {
    id: 'booking',
    kind: 'Začněte tady · formulář a souhrn ceny',
    title: 'Večer u dalekohledu',
    description:
      'Výběr termínu, počty návštěvníků, volitelný čaj a potvrzení. Ideální pro porovnání rozložení a počtu kroků.',
    source: 'examples/perseid/src/Booking.tsx',
    href: 'booking.html',
    action: 'Otevřít rezervační formulář',
    prompt:
      'Zjednoduš rezervaci večera u dalekohledu. Navrhni tři různé přístupy k rozložení, hierarchii a průchodu formulářem. Uživatel má rychle pochopit termín, počet míst a konečnou cenu. Zachovej češtinu, všechny ceny, limit 6 osob, dostupné termíny a viditelné označení dema. Rozdíly nesmějí být jen v barvách.',
  },
  {
    id: 'list',
    kind: 'Seznam · filtrování · tmavé prostředí',
    title: 'Pět zastávek na obloze',
    description:
      'Pozorovací seznam s hledáním, filtry a průběhem. Zkuste, jak se může změnit hustota informací a práce na mobilu.',
    source: 'examples/perseid/src/ObservationList.tsx',
    href: 'observation-list.html',
    action: 'Otevřít pozorovací seznam',
    prompt:
      'Zpřehledni pozorovací seznam pro telefon používaný venku večer. Navrhni tři rozdílné způsoby uspořádání objektů, filtrů a postupu. Zachovej tmavé pozadí, všech pět objektů, hledání, označení pozorovaných objektů, nulování a české texty. Časy i viditelnost dál označuj jako ilustrativní.',
  },
  {
    id: 'weather',
    kind: 'Malá komponenta · rozhodování · rozbalení',
    title: 'Plány mění počasí',
    description:
      'Klidné vysvětlení zrušeného termínu. Náhradní datum, vrácení částky a lokální potvrzení výběru.',
    source: 'examples/perseid/src/WeatherAlert.tsx',
    href: 'weather-alert.html',
    action: 'Otevřít upozornění',
    prompt:
      'Navrhni tři různá řešení upozornění na zrušené pozorování. Uživatel má hned pochopit, co se stalo a že může zvolit náhradní termín nebo vrácení celé částky. Zachovej 2 dospělé, cenu 780 Kč, oba náhradní termíny, český jazyk a označení simulace. Zůstaň u kompaktní komponenty bez další stránky či navigace.',
  },
]

const PromptCard = ({ scenario }: { scenario: (typeof scenarios)[number] }) => {
  const [status, setStatus] = useState('')
  const field = useRef<HTMLTextAreaElement>(null)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(scenario.prompt)
      setStatus('Zkopírováno.')
    } catch {
      field.current?.focus()
      field.current?.select()
      setStatus('Text je označený. Stiskněte ⌘C nebo Ctrl+C.')
    }
  }
  return (
    <article className="grid gap-6 border-line px-5 py-6 not-first:border-t min-[741px]:grid-cols-[0.9fr_1.3fr] min-[741px]:gap-10 min-[741px]:p-[30px]">
      <div className="min-w-0">
        <p className="mb-2.5 text-[13px] text-muted">{scenario.kind}</p>
        <h2 className="text-[1.4rem] tracking-tight">{scenario.title}</h2>
        <p className="mt-3 max-w-[45ch] text-sm text-muted">{scenario.description}</p>
        <code className="mt-3.5 mb-[18px] block text-[13px] [overflow-wrap:anywhere]">
          {scenario.source}
        </code>
        <a className={`${buttonClass} text-sm`} href={scenario.href}>
          {scenario.action} <span aria-hidden="true">↗</span>
        </a>
      </div>
      <div className="min-w-0">
        <label htmlFor={`${scenario.id}-prompt`} className="mb-2 block text-[13px] font-semibold">
          Zadání do Spectry
        </label>
        <textarea
          ref={field}
          id={`${scenario.id}-prompt`}
          readOnly
          spellCheck={false}
          value={scenario.prompt}
          className="min-h-[140px] w-full resize-y rounded-md border border-line bg-page p-3.5 text-sm leading-relaxed"
        />
        <div className="mt-2.5 flex flex-wrap items-center gap-3">
          <Button className="text-sm" onClick={copy}>
            Kopírovat zadání
          </Button>
          <output className="text-[13px] text-muted">{status}</output>
        </div>
      </div>
    </article>
  )
}

export const Launcher = () => (
  <main className="mx-auto max-w-[1144px] px-4 py-[22px] min-[741px]:p-8">
    <Brand launcher />
    <section
      className="grid items-end gap-6 py-[34px] min-[741px]:grid-cols-[1.2fr_1fr] min-[741px]:gap-[70px] min-[741px]:py-[54px]"
      aria-labelledby="title"
    >
      <h1
        id="title"
        className="max-w-[14ch] text-[2.4rem] tracking-[-0.035em] min-[741px]:text-[3.1rem]"
      >
        Jedna komponenta.
        <br />
        Tři jiné směry.
      </h1>
      <div>
        <p className="max-w-[47ch] text-muted">
          Vyzkoušejte Spectru na malém projektu o večerech pod hvězdami. Tři hotové React
          komponenty, skutečné místní interakce a zadání připravená ke zkopírování.
        </p>
        <a className={`${primaryButtonClass} mt-5 text-sm`} href="booking.html">
          Prohlédnout první demo <span aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
    <section className="border-y border-line bg-surface" aria-label="Komponenty k vyzkoušení">
      {scenarios.map((scenario) => (
        <PromptCard key={scenario.id} scenario={scenario} />
      ))}
    </section>
    <section
      className="grid gap-6 py-[38px] min-[741px]:grid-cols-[0.9fr_1.3fr] min-[741px]:gap-10"
      aria-labelledby="how-title"
    >
      <div className="min-w-0">
        <h2 id="how-title" className="text-[1.4rem] tracking-tight">
          Z prohlížeče do Spectry
        </h2>
        <p className="mt-3.5 max-w-[35ch] text-sm text-muted">
          Tyto stránky ukazují běžící React aplikaci s Tailwind CSS. Spectra pracuje se zdrojem
          otevřeným v Cursoru.
        </p>
        <p className="mt-3.5 max-w-[35ch] text-sm text-muted">
          Podrobný postup najdete v{' '}
          <code className="text-[13px] [overflow-wrap:anywhere]">examples/perseid/README.md</code>.
        </p>
      </div>
      <ol className="list-decimal space-y-3 pl-[22px] text-sm marker:text-muted">
        <li className="pl-1.5">
          V Cursoru otevřete <code>src/Booking.tsx</code> v této složce. Zrušte textový výběr, aby
          se zachytila celá komponenta.
        </li>
        <li className="pl-1.5">
          Spusťte <strong>Spectra: Explore Component</strong> a zkontrolujte zachycený zdroj.
          Importované styly a sdílené komponenty se automaticky nepřidávají.
        </li>
        <li className="pl-1.5">
          V <strong>AI providers</strong> připojte Cursor CLI nebo vlastní API klíč. Pro tyto
          soubory je potřeba živý poskytovatel.
        </li>
        <li className="pl-1.5">
          Vložte zadání, spusťte <strong>Generate 3 directions</strong> a potvrďte odeslání zdroje v
          editoru.
        </li>
        <li className="pl-1.5">
          Porovnejte návrhy, použijte <strong>Refine</strong> nebo <strong>Remix</strong> a vyberte{' '}
          <strong>Choose</strong>.
        </li>
        <li className="pl-1.5">
          <strong>Copy for Cursor</strong> připraví ruční předání pro úpravu React komponenty.{' '}
          <strong>Save HTML</strong> uloží samostatný HTML návrh.
        </li>
      </ol>
    </section>
    <footer className="border-t border-line pt-[22px] text-[13px] text-muted">
      <p className="max-w-[85ch]">
        Perseid je smyšlené demo v Reactu a Tailwind CSS. Nic se nerezervuje, neplatí ani neodesílá.
        Náhled Original ve Spectře je AI rekonstrukce zachyceného zdroje; skutečný originál vidíte
        tady v prohlížeči.
      </p>
    </footer>
  </main>
)
