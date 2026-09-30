import type { SampleLayout, SampleRecipe, Variant } from './types'

export const samplePricing = {
  monthly: 30,
  yearlyMonthly: 24,
  yearlyTotal: 288,
  saving: 72,
  percent: 20,
  seats: 10,
  trialDays: 14,
}

const descriptions: Record<
  SampleLayout,
  { name: string; heading: string; hypothesis: string; changes: string[] }
> = {
  original: {
    name: 'Original',
    heading: 'One plan for your team',
    hypothesis:
      'Curated baseline: one Pro plan, yearly billing selected, features followed by a trial action.',
    changes: [],
  },
  clarity: {
    name: 'Billing at a glance',
    heading: 'Orbit Pro',
    hypothesis:
      'Move the billing switch into the plan and place the total next to the price, so the payment commitment is visible before the feature list.',
    changes: [
      'Shortened the introductory heading',
      'Grouped billing controls, price and total inside the plan',
      'Moved the trial action above the feature list',
    ],
  },
  trust: {
    name: 'Trial terms first',
    heading: 'Try Pro with your team',
    hypothesis:
      'Put the 14-day trial and no-card terms before the price, so users can assess the commitment without searching below the action.',
    changes: [
      'Moved trial terms ahead of the pricing decision',
      'Grouped the included features into a separate section',
      'Used a trial-specific action with visible billing terms',
    ],
  },
  value: {
    name: 'Compare annual cost',
    heading: 'Choose how you pay',
    hypothesis:
      'Show both annual totals together and calculate the $72 difference, so users can compare payment schedules without mental arithmetic.',
    changes: [
      'Added an explicit $360 vs $288 annual cost comparison',
      'Placed the savings explanation beside billing controls',
      'Kept the total and action synchronized with the chosen schedule',
    ],
  },
}
const ctas: Record<SampleLayout, string> = {
  original: 'Start free trial',
  clarity: 'Try Pro for 14 days',
  trust: 'Start a no-card trial',
  value: 'Try Pro with yearly billing',
}
const featureList = `
  <ul class="features">
    <li>Unlimited projects</li>
    <li>${samplePricing.seats} team members included</li>
    <li>Advanced analytics</li>
    <li>Priority support</li>
  </ul>`
const billingSwitch = `
  <div class="toggle" role="group" aria-label="Billing schedule">
    <button type="button" data-billing="monthly" aria-pressed="false">Monthly</button>
    <button type="button" data-billing="yearly" aria-pressed="true">Yearly · save ${samplePricing.percent}%</button>
  </div>`
const price = `
  <div class="price"><span data-price>$${samplePricing.yearlyMonthly}</span><span class="price-unit"> / month</span></div>
  <p class="billing-total" data-total>Billed yearly · $${samplePricing.yearlyTotal} total</p>`
const emphasisFor = (layout: SampleLayout) => {
  if (layout === 'trust')
    return `
    <aside class="emphasis trial-terms">
      <strong>${samplePricing.trialDays} days to try the full plan</strong>
      <p>No credit card required. Cancel anytime.</p>
      <p>Includes all ${samplePricing.seats} team members.</p>
    </aside>`
  if (layout === 'value')
    return `
    <aside class="emphasis cost-comparison">
      <strong>Same plan. Two payment schedules.</strong>
      <dl><div><dt>Monthly for 12 months</dt><dd>$${samplePricing.monthly * 12}</dd></div><div><dt>One yearly payment</dt><dd>$${samplePricing.yearlyTotal}</dd></div></dl>
      <p class="saving" data-saving>Yearly selected: save $${samplePricing.saving} (${samplePricing.percent}%) compared with 12 monthly payments.</p>
    </aside>`
  if (layout === 'clarity')
    return `
    <aside class="emphasis"><strong>${samplePricing.seats} seats, one team price</strong><p>This is the price for your team, not per person.</p></aside>`
  return ''
}
const sampleCSS = `
* { box-sizing: border-box; }
body { margin: 0; background: #ffffff; color: #20262d; font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
button { font: inherit; cursor: pointer; }
button:focus-visible { outline: 3px solid #005a9c; outline-offset: 3px; }
.page { padding: 24px; max-width: 760px; margin: auto; }
nav { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid #c9d0d8; padding-bottom: 16px; }
.brand { font-weight: 700; font-size: 18px; }
.nav-label { font-size: 12px; color: #4c5866; }
header { margin: 28px 0 22px; }
h1 { font-size: 28px; line-height: 1.2; letter-spacing: -.02em; margin: 0 0 10px; overflow-wrap: anywhere; }
h2 { font-size: 18px; line-height: 1.4; margin: 0 0 8px; }
p { margin: 6px 0; color: #4c5866; }
.plan { border: 1px solid #b9c3ce; border-radius: 6px; padding: 20px; }
.toggle { display: flex; gap: 4px; background: #edf1f5; padding: 4px; border-radius: 4px; margin: 16px 0; }
.toggle button { flex: 1; padding: 8px 6px; border: 1px solid transparent; border-radius: 2px; background: transparent; color: #364454; font-size: 12px; }
.toggle button[aria-pressed="true"] { background: #ffffff; border-color: #8997a7; color: #172534; font-weight: 600; }
.price { margin: 18px 0 0; font-size: 36px; font-weight: 650; line-height: 1.3; }
.price-unit { font-size: 14px; font-weight: 400; color: #4c5866; white-space: nowrap; }
.billing-total { font-size: 13px; color: #364454; }
.features { list-style: none; padding: 0; margin: 22px 0; display: grid; gap: 10px; }
.features li { padding-left: 20px; position: relative; }
.features li::before { content: '✓'; position: absolute; left: 0; color: #166442; }
.cta { display: block; width: 100%; padding: 12px; margin-top: 18px; background: #155bb0; color: #ffffff; border: 1px solid transparent; border-radius: 4px; font-weight: 600; }
.cta:hover { background: #104a91; }
.trial-note, .foot { font-size: 12px; }
.trial-note { margin-top: 10px; }
.foot { border-top: 1px solid #c9d0d8; margin-top: 24px; padding-top: 14px; }
.emphasis { margin: 16px 0; padding: 16px; background: #edf3fa; color: #203a55; border-radius: 4px; }
.emphasis p { color: #344d67; font-size: 13px; }
.emphasis strong { font-size: 14px; }
dl { margin: 12px 0; font-size: 13px; }
dl > div { display: flex; justify-content: space-between; gap: 16px; margin: 6px 0; }
dd { margin: 0; font-weight: 600; color: #203a55; }
.status { display: block; min-height: 24px; margin-top: 12px; font-size: 13px; color: #166442; }
.layout-clarity header { margin: 20px 0 14px; }
.layout-clarity .plan { border-radius: 2px; }
.layout-trust .trial-terms { margin-top: 0; }
.layout-trust .features-section { border-top: 1px solid #c9d0d8; margin-top: 22px; padding-top: 18px; }
.layout-value .plan { border-top: 3px solid #155bb0; }
.compact header p, .compact .nav-label { display: none; }
.page.compact { padding: 18px; }
.compact header { margin: 16px 0; }
.compact .plan, .compact .emphasis { padding: 14px; }
.compact .features { gap: 6px; margin-block: 14px; }
@media (max-width: 360px) {
  .page { padding: 16px; }
  .plan { padding: 16px; }
  h1 { font-size: 24px; }
  .toggle { flex-wrap: wrap; }
}
@media (min-width: 600px) {
  .layout-trust .plan { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
  .layout-trust .features-section { border-top: 0; margin-top: 0; padding-top: 0; }
}
`
const sampleInteraction = (recipe: SampleRecipe) => `
const pricing = ${JSON.stringify(samplePricing)};
const annualCTA = ${JSON.stringify(ctas[recipe.cta])};
const setBilling = (billing) => {
  const yearly = billing === 'yearly';
  for (const button of document.querySelectorAll('[data-billing]')) {
    button.setAttribute('aria-pressed', String(button.dataset.billing === billing));
  }
  document.querySelector('[data-price]').textContent = '$' + (yearly ? pricing.yearlyMonthly : pricing.monthly);
  document.querySelector('[data-total]').textContent = yearly
    ? 'Billed yearly · $' + pricing.yearlyTotal + ' total'
    : 'Billed monthly · $' + pricing.monthly + ' per month';
  const saving = document.querySelector('[data-saving]');
  if (saving) saving.textContent = yearly
    ? 'Yearly selected: save $' + pricing.saving + ' (' + pricing.percent + '%) compared with 12 monthly payments.'
    : 'Monthly selected: $' + (pricing.monthly * 12) + ' over 12 months. Switch to yearly to save $' + pricing.saving + ' (' + pricing.percent + '%).';
  const action = document.querySelector('.cta');
  action.textContent = ${recipe.cta === 'value'} && !yearly ? 'Try Pro with monthly billing' : annualCTA;
  document.querySelector('.status').textContent = '';
};
for (const button of document.querySelectorAll('[data-billing]')) {
  button.addEventListener('click', () => setBilling(button.dataset.billing));
}
document.querySelector('.cta').addEventListener('click', () => {
  document.querySelector('.status').textContent = 'Demo only — no trial or account was created.';
});
setBilling('yearly');
`
export const createSample = (recipe: SampleRecipe): Variant => {
  const description = descriptions[recipe.layout]
  const action = `<button type="button" class="cta">${ctas[recipe.cta]}</button><p class="trial-note">${samplePricing.trialDays}-day free trial · No credit card required</p>`
  const emphasis = emphasisFor(recipe.emphasis)
  const title = recipe.layout === 'clarity' ? '' : '<h2>Orbit Pro</h2>'
  const plan =
    recipe.layout === 'trust'
      ? `<div>${emphasis}${title}${billingSwitch}${price}${action}</div><section class="features-section"><h2>Included in Pro</h2>${featureList}</section>`
      : recipe.layout === 'clarity'
        ? `${title}${billingSwitch}${price}${action}${featureList}${emphasis}`
        : `${title}${recipe.layout === 'value' ? billingSwitch + emphasis : ''}${price}${featureList}${action}${recipe.layout === 'original' ? emphasis : ''}`
  return {
    id: recipe.layout === 'original' ? 'original' : recipe.layout,
    name: description.name,
    hypothesis: description.hypothesis,
    changes: description.changes,
    sample: recipe,
    html: `
<main class="page layout-${recipe.layout}${recipe.compact ? ' compact' : ''}">
  <nav aria-label="Sample product"><span class="brand">orbit</span><span class="nav-label">Team workspace · Pricing</span></nav>
  <header><h1>${description.heading}</h1><p>Projects, analytics and support for your team.</p></header>
  ${recipe.layout === 'original' ? billingSwitch : ''}
  <section class="plan" aria-label="Pro plan">${plan}</section>
  <output class="status" aria-live="polite"></output>
  <p class="foot">Curated product example · Demo interactions only</p>
</main>`,
    css: sampleCSS,
    js: sampleInteraction(recipe),
  }
}
