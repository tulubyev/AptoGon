// HSI Verified Human — Popup UI

document.addEventListener('DOMContentLoaded', () => {
  const body = document.getElementById('body');

  chrome.runtime.sendMessage({ type: 'GET_CREDENTIAL' }, (response) => {
    if (chrome.runtime.lastError || !response) {
      renderError();
      return;
    }
    render(response);
  });

  // Read localStorage from the active tab (works on localhost:3000 or homosapience.org)
  function syncFromActiveTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab) return;
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({
          cred: localStorage.getItem('hsi_credential'),
          did: localStorage.getItem('hsi_did'),
        }),
      }, (results) => {
        if (chrome.runtime.lastError || !results || !results[0]) {
          body.innerHTML += `<p style="color:#ef4444;font-size:11px;text-align:center;margin-top:8px;">Не удалось прочитать — открой localhost:3000/verify</p>`;
          return;
        }
        const { cred, did } = results[0].result;
        if (cred) {
          chrome.storage.local.set({ hsi_credential: cred, hsi_did: did }, () => {
            // Reload popup
            window.location.reload();
          });
        } else {
          body.innerHTML += `<p style="color:#f59e0b;font-size:11px;text-align:center;margin-top:8px;">Credential не найден — сначала пройди верификацию на вкладке localhost:3000</p>`;
        }
      });
    });
  }

  function render(cred) {
    if (cred.status === 'valid') {
      renderValid(cred);
    } else if (cred.status === 'expired') {
      renderExpired(cred);
    } else {
      renderNone();
    }
  }

  function renderValid(cred) {
    const did = cred.did ?? '';
    const shortDid = did.length > 16
      ? did.slice(0, 12) + '...' + did.slice(-6)
      : did;
    const conf = Math.round((cred.confidence ?? 0) * 100);
    const issued = cred.issuanceDate
      ? new Date(cred.issuanceDate).toLocaleDateString('ru-RU')
      : '—';
    const daysLeft = cred.daysLeft ?? '?';
    const tx = cred.txHash
      ? cred.txHash.slice(0, 10) + '...'
      : '—';

    body.innerHTML = `
      <div class="status-card valid">
        <div class="status-icon">✅</div>
        <div class="status-title valid">Верифицирован</div>
        <div class="status-sub">Ваша человечность подтверждена<br>криптографически</div>
      </div>

      <div class="details">
        <div class="detail-row">
          <span class="detail-label">DID</span>
          <span class="detail-value">${shortDid}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Уверенность AI</span>
          <span class="detail-value good">${conf}%</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Верифицирован</span>
          <span class="detail-value">${issued}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Действует ещё</span>
          <span class="detail-value ${daysLeft <= 7 ? 'warn' : 'good'}">${daysLeft} дн.</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Aptos TX</span>
          <span class="detail-value">${tx}</span>
        </div>
      </div>

      <button class="btn btn-secondary" id="btn-refresh">🔄 Обновить верификацию</button>
    `;

    document.getElementById('btn-refresh').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_VERIFY_PAGE' });
      window.close();
    });
  }

  function renderExpired(cred) {
    body.innerHTML = `
      <div class="status-card expired">
        <div class="status-icon">⏰</div>
        <div class="status-title expired">Срок истёк</div>
        <div class="status-sub">Верификация действительна 30 дней.<br>Пройдите повторно — это займёт 10 секунд.</div>
      </div>

      <button class="btn btn-primary" id="btn-verify">✍️ Пройти верификацию</button>
    `;

    document.getElementById('btn-verify').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_VERIFY_PAGE' });
      window.close();
    });
  }

  function renderNone() {
    body.innerHTML = `
      <div class="status-card none">
        <div class="status-icon">👤</div>
        <div class="status-title none">Не верифицирован</div>
        <div class="status-sub">
          Пройдите 10-секундную жестовую верификацию,<br>
          чтобы получить Verified Human credential.
        </div>
      </div>

      <div style="background:#fff;border-radius:12px;border:1px solid #e9d5ff;padding:12px 14px;margin-bottom:14px;font-size:11px;color:#6b7280;line-height:1.7;">
        <strong style="color:#7c3aed;">Что это даёт:</strong><br>
        • Badge ✦ на профилях GitHub, Reddit, X<br>
        • Подтверждение без паспорта и email<br>
        • Криптографическое доказательство на Aptos<br>
        • Анонимный DID (никаких личных данных)
      </div>

      <button class="btn btn-primary" id="btn-verify">✍️ Пройти верификацию</button>
      <button class="btn btn-secondary" id="btn-sync">🔄 Синхронизировать с вкладки</button>
    `;

    document.getElementById('btn-verify').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_VERIFY_PAGE' });
      window.close();
    });

    document.getElementById('btn-sync').addEventListener('click', () => {
      syncFromActiveTab();
    });
  }

  function renderError() {
    body.innerHTML = `
      <div class="status-card none">
        <div class="status-icon">⚠️</div>
        <div class="status-title none">Ошибка</div>
        <div class="status-sub">Не удалось загрузить данные расширения.</div>
      </div>
    `;
  }
});
