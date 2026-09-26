export async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const bodyText = await response.text();
  let body;

  if (bodyText) {
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = bodyText;
    }
  }

  if (!response.ok) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body);
    throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}: ${detail}`);
  }

  return body;
}

export async function requestStrictJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...options.headers,
    },
  });
  const contentType = response.headers.get('content-type') || '';
  const bodyText = await response.text();
  let body;

  try {
    body = bodyText ? JSON.parse(bodyText) : undefined;
  } catch {
    const looksLikeHtml = /<!doctype html|<html[\s>]/i.test(bodyText);
    const hint = looksLikeHtml
      ? ' Received HTML instead of JSON. Check that MAGENTO_BASE_URL points to /rest/default, not the Magento admin URL.'
      : '';
    throw new Error(`Expected JSON from ${url} but got ${contentType || 'unknown content-type'}.${hint}`);
  }

  if (!response.ok) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body);
    throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}: ${detail}`);
  }

  return body;
}
