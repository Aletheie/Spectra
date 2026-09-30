const escapeAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const createWebviewHtml = (
  scriptUri: string,
  styleUri: string,
  cspSource: string,
  nonce: string,
) => {
  const policy = [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    `style-src ${cspSource} 'unsafe-inline'`,
    'img-src data:',
    'font-src data:',
    "frame-src 'self' about:",
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ')
  return `<!doctype html>
<html lang="en" data-script-nonce="${escapeAttribute(nonce)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${escapeAttribute(policy)}">
<link rel="stylesheet" href="${escapeAttribute(styleUri)}">
<title>Spectra</title>
</head>
<body>
<div id="root"></div>
<script type="module" nonce="${escapeAttribute(nonce)}" src="${escapeAttribute(scriptUri)}"></script>
</body>
</html>`
}
