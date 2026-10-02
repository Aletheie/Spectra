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
    let visible = Boolean(visibleText);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    for (let count = 0; !visible && count < 2000; count++) {
      const element = walker.nextNode();
      if (!element) break;
      if (['SCRIPT', 'STYLE'].includes(element.tagName)) continue;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      visible = style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0 && Boolean((element.innerText || '').trim() || ['SVG', 'CANVAS', 'IMG', 'INPUT', 'BUTTON'].includes(element.tagName));
    }
    report(visible ? 'ready' : 'empty');
  };
  addEventListener('load', () => setTimeout(inspect, 300));
  let scheduled = false;
  addEventListener('resize', () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; inspect(); });
  });
})();
</script>`
    : ''
