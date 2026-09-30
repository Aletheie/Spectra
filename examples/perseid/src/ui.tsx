import type { ButtonHTMLAttributes, ReactNode } from 'react'

const baseButtonClass =
  'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[7px] border px-[18px] py-2.5 font-semibold no-underline transition-colors duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none'
export const buttonClass = `${baseButtonClass} border-line bg-surface text-ink hover:border-accent hover:bg-tint`
export const primaryButtonClass = `${baseButtonClass} border-transparent bg-accent text-white hover:bg-ink`
export const inputClass =
  'mt-1.5 min-h-[46px] w-full rounded-md border border-line bg-surface px-3 py-2.5 font-normal text-ink placeholder:text-muted'
export const checkClass = 'size-[19px] shrink-0 accent-accent'

export const Button = ({
  primary = false,
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) => (
  <button
    type={type}
    className={`${primary ? primaryButtonClass : buttonClass} ${className}`}
    {...props}
  />
)

export const Brand = ({ launcher = false }: { launcher?: boolean }) => (
  <header
    className={`flex items-center justify-between gap-4 ${launcher ? 'border-b border-line pb-6' : 'mb-6'}`}
  >
    <a
      href="index.html"
      className="shrink-0 text-xl font-[750] tracking-[-0.035em]"
      aria-label="Perseid — rozcestník"
    >
      <span className="mr-2 text-accent" aria-hidden="true">
        ✳
      </span>
      perseid
    </a>
    {launcher ? (
      <p className="max-w-[20ch] text-right text-sm text-muted">Zkušební hřiště pro Spectru</p>
    ) : (
      <span className="rounded border border-line px-2 py-1 text-xs font-semibold">
        Interaktivní demo
      </span>
    )}
  </header>
)

export const DemoPage = ({
  children,
  fiction,
  night = false,
  width = 'max-w-[920px]',
}: {
  children: ReactNode
  fiction: string
  night?: boolean
  width?: string
}) => (
  <div
    className={`${night ? 'night' : ''} min-h-screen bg-page px-3.5 py-5 text-ink sm:px-5 sm:py-9`}
  >
    <main className={`mx-auto w-full ${width}`}>
      <Brand />
      {children}
      <p className="mt-5 max-w-[75ch] text-[13px] text-muted">{fiction}</p>
    </main>
  </div>
)
