(() => {
  if (location.origin !== 'https://aihub.eastmoney.com' || window.top !== window) return;
  const keys = ['x-dong-auth', 'x-dong-user', 'x-dong-client'];
  let pending = '';
  function capture(url, headers) {
    try {
      const target = new URL(url, location.href);
      if (target.origin !== location.origin || !target.pathname.startsWith('/ai-cloud-hub/')) return;
      const h = new Headers(headers), candidate = {};
      for (const key of keys) { const value = h.get(key); if (!value || /[\r\n]/.test(value)) return; candidate[key] = value; }
      const fingerprint = JSON.stringify(candidate);
      if (pending === fingerprint) return;
      pending = fingerprint;
      window.__TAURI_INTERNALS__.invoke('auth_candidate', { candidate }).catch(() => { pending = ''; });
    } catch { /* Incomplete headers are never stored or logged. */ }
  }
  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((v,k) => headers.set(k,v));
    capture(input instanceof Request ? input.url : String(input), headers);
    return originalFetch.apply(this, arguments);
  };
  const open = XMLHttpRequest.prototype.open, set = XMLHttpRequest.prototype.setRequestHeader, send = XMLHttpRequest.prototype.send;
  const requests = new WeakMap();
  XMLHttpRequest.prototype.open = function(method, url) { requests.set(this, {url, headers: {}}); return open.apply(this, arguments); };
  XMLHttpRequest.prototype.setRequestHeader = function(key, value) { const r=requests.get(this); if(r) r.headers[key]=value; return set.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function() { const r=requests.get(this); if(r) capture(r.url,r.headers); return send.apply(this,arguments); };
})();
