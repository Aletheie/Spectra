/** Local advisory status only; never a host command or a claim that code is safe. */
export const previewDiagnostics = (id: string, nonce?: string) =>
  /^[\w-]{1,100}$/.test(id)
    ? `<script${nonce ? ` nonce="${nonce}"` : ''}>
(() => {
  let failed = false;
  const report = (kind) => parent.postMessage({ type: 'spectra-preview', id: '${id}', kind }, '*');
  const fail = () => { failed = true; report('script-error'); };
  addEventListener('error', fail);
  addEventListener('unhandledrejection', fail);
  const inspect = () => {
    if (failed || !document.body || document.documentElement.clientWidth === 0) return;
    const bodyStyle = getComputedStyle(document.body);
    const visibleText = bodyStyle.display !== 'none' && bodyStyle.visibility !== 'hidden' && Number(bodyStyle.opacity) > 0 && document.body.innerText.trim();
    const visible = visibleText || [...document.body.querySelectorAll('*')].slice(0, 2000).some((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return !['SCRIPT', 'STYLE'].includes(element.tagName) && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0 && ((element.innerText || '').trim() || ['SVG', 'CANVAS', 'IMG', 'INPUT', 'BUTTON'].includes(element.tagName));
    });
    report(visible ? 'ready' : 'empty');
  };
  addEventListener('load', () => setTimeout(inspect, 300));
  addEventListener('resize', inspect);
})();
</script>`
    : ''
