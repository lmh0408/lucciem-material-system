const ALLOWED_HOSTS = new Set(['script.google.com', 'script.googleusercontent.com']);

export function assertAllowedGoogleScriptUrl(webAppUrl) {
  let parsed;
  try {
    parsed = new URL(webAppUrl);
  } catch {
    throw new Error('Invalid web app URL');
  }
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error('Web app URL must be a Google Apps Script https URL');
  }
  return parsed.toString();
}

/** GAS 웹앱: POST 후 302 → echo URL은 GET으로만 응답 본문을 받을 수 있음 */
export async function postToGoogleAppsScript(webAppUrl, bodyString) {
  const url = assertAllowedGoogleScriptUrl(webAppUrl);

  let response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: bodyString,
    redirect: 'manual',
  });

  if ([302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('Location');
    if (!location) {
      throw new Error('Google Apps Script redirect without Location header');
    }
    assertAllowedGoogleScriptUrl(location);
    response = await fetch(location, { method: 'GET', redirect: 'follow' });
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Google Apps Script HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
  return text;
}

export function handleGoogleLedgerProxy(request, response) {
  if (request.method !== 'POST') {
    response.status(405).setHeader('Allow', 'POST').end();
    return;
  }

  let raw = '';
  request.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > 50 * 1024 * 1024) {
      response.status(413).json({ success: false, message: 'Payload too large' });
      request.destroy();
    }
  });

  request.on('end', async () => {
    try {
      const parsed = JSON.parse(raw || '{}');
      const webAppUrl = parsed.webAppUrl;
      const payload = parsed.payload;
      if (typeof webAppUrl !== 'string' || payload === undefined) {
        response.status(400).json({ success: false, message: 'webAppUrl and payload are required' });
        return;
      }
      const text = await postToGoogleAppsScript(webAppUrl, JSON.stringify(payload));
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.status(200).send(text);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      response.status(502).json({ success: false, message });
    }
  });
}
