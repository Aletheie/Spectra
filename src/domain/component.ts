import type { SourceContext } from './protocol'

export const componentProfiles = {
  unknown: {
    label: 'Component',
    instruction:
      'Improve this component’s hierarchy and usability. Preserve its scope, functionality, theme and transparency.',
    guidance:
      'Infer the role from the captured snippet and explicit intent. If unclear, keep the existing scope and acknowledge missing context; do not invent a page around it.',
  },
  control: {
    label: 'Button / control',
    instruction:
      'Improve this control’s label, emphasis and interaction states. Keep it a small component and preserve its background and transparency.',
    guidance:
      'Focus on label clarity, emphasis, focus, disabled and loading states where relevant. Do not add a card, heading, marketing copy or surrounding page.',
  },
  form: {
    label: 'Form',
    instruction:
      'Improve this form’s field grouping, labels, validation and feedback. Preserve the fields and simulate submission locally.',
    guidance:
      'Preserve field meanings and requirements. Explore grouping, labels, errors and recovery. Implement accessible local validation and feedback, never a real submission.',
  },
  navigation: {
    label: 'Navigation / menu',
    instruction:
      'Make this navigation easier to scan and use with a keyboard or narrow viewport. Preserve its destinations and active state.',
    guidance:
      'Focus on orientation, active state, grouping, keyboard access and narrow layouts. Preserve the existing destinations; demonstrate navigation with local feedback only.',
  },
  data: {
    label: 'Table / list',
    instruction:
      'Improve this table or list’s scannability, density and item actions. Preserve its data and handle narrow-view overflow.',
    guidance:
      'Preserve all supplied data, units and row actions. Explore density, hierarchy, alignment and overflow; do not reflexively replace a table with cards or invent records.',
  },
  overlay: {
    label: 'Dialog / popover',
    instruction:
      'Improve this dialog or popover’s hierarchy, actions and keyboard behavior. Preserve its purpose and keep interactions local.',
    guidance:
      'Keep the overlay scope. Demonstrate opening and closing locally with accessible focus handling. No browser alert, confirm or prompt calls, or external windows.',
  },
  section: {
    label: 'Section / page',
    instruction:
      'Improve this section’s layout, information hierarchy and path to the primary action. Preserve its content, theme and product facts.',
    guidance:
      'Explore structure, hierarchy and interaction across the supplied section or page. Preserve content, facts and scope; do not invent additional product sections.',
  },
  styles: {
    label: 'Styles only',
    instruction:
      'Explore improvements to these styles. Use minimal illustrative markup and clearly explain what cannot be reconstructed without the component.',
    guidance:
      'There is no captured markup. Use minimal illustrative markup tied to the supplied selectors and label it visibly as illustrative. The original hypothesis must explain that structure and behavior are unknown.',
  },
} as const

export type ComponentKind = keyof typeof componentProfiles

/** Advisory only: inspect this snapshot, never filenames, imports or the workspace. */
export const inferComponentKind = (
  source: Pick<SourceContext, 'code' | 'language'>,
): ComponentKind => {
  if (source.language === 'css' || source.language === 'scss') return 'styles'
  const code = source.code.replace(/<!--[\s\S]*?-->|\/\*[\s\S]*?\*\/|^\s*\/\/[^\n]*/gm, '')
  const tags = [...code.matchAll(/<([a-zA-Z][\w-]*)(?=[\s/>])/g)]
    .map((match) => match[1].toLowerCase())
    .filter((tag) => !['template', 'script', 'style'].includes(tag))
  const first = tags[0]
  if (!first) return 'unknown'
  const groups: [ComponentKind, string[]][] = [
    ['section', ['html', 'body', 'main', 'article', 'section', 'header', 'footer']],
    ['overlay', ['dialog', 'popover', 'alertdialog']],
    ['navigation', ['nav', 'menu', 'navigationmenu', 'menubar']],
    ['form', ['form']],
    ['data', ['table', 'datatable', 'ul', 'ol', 'list']],
    ['control', ['button', 'input', 'select', 'textarea', 'switch', 'checkbox', 'toggle']],
  ]
  const root = groups.find(([, names]) => names.includes(first))
  if (root) return root[0]
  // A generic wrapper may surround one known component. Mixed structures remain unknown.
  const candidates = groups.filter(
    ([kind, names]) => kind !== 'control' && tags.some((tag) => names.includes(tag)),
  )
  if (candidates.length === 1) return candidates[0][0]
  return 'unknown'
}

export const suggestedComponentPrompt = (source: Pick<SourceContext, 'code' | 'language'>) =>
  componentProfiles[inferComponentKind(source)].instruction

export const componentContextFor = (source: SourceContext | null) => {
  if (!source) return null
  const kind = inferComponentKind(source)
  return { kind, guidance: componentProfiles[kind].guidance, inferred: true }
}
