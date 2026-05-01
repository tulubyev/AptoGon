// HSI Verified Human — Background Service Worker
// Manages credential state and communicates with content scripts

const HSI_API = 'https://api.homosapience.org';

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CREDENTIAL') {
    getCredential().then(sendResponse);
    return true; // keep channel open for async
  }

  if (message.type === 'SYNC_CREDENTIAL') {
    // Content script found credential in localStorage — save to extension storage
    if (message.cred) {
      chrome.storage.local.set({
        hsi_credential: message.cred,
        hsi_did: message.did || null,
      }, () => {
        updateBadgeIcon(true);
      });
    }
    return false;
  }

  if (message.type === 'VERIFY_ON_CHAIN') {
    verifyOnChain(message.did).then(sendResponse);
    return true;
  }

  if (message.type === 'OPEN_VERIFY_PAGE') {
    chrome.tabs.create({ url: 'http://localhost:3000/verify' });
  }
});

// Retrieve and validate credential from extension storage
async function getCredential() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['hsi_credential', 'hsi_did'], (result) => {
      const credRaw = result.hsi_credential;
      const did = result.hsi_did;

      if (!credRaw) {
        resolve({ status: 'none' });
        return;
      }

      let cred;
      try {
        cred = typeof credRaw === 'string' ? JSON.parse(credRaw) : credRaw;
      } catch {
        resolve({ status: 'invalid' });
        return;
      }

      // Check expiry
      const expires = cred.expirationDate
        ? new Date(cred.expirationDate).getTime()
        : 0;
      const now = Date.now();

      if (expires && now > expires) {
        resolve({ status: 'expired', did, cred });
        return;
      }

      const confidence = cred.credentialSubject?.confidence ?? 0;
      const txHash = cred.credentialSubject?.txHash;
      const expressionProof = cred.credentialSubject?.expressionProof;
      const issuanceDate = cred.issuanceDate;

      resolve({
        status: 'valid',
        did: did || cred.credentialSubject?.id,
        confidence,
        txHash,
        expressionProof,
        issuanceDate,
        expirationDate: cred.expirationDate,
        daysLeft: expires ? Math.ceil((expires - now) / 86400000) : null,
      });
    });
  });
}

// Optional: verify ExpressionProof on-chain via HSI API
async function verifyOnChain(did) {
  try {
    const res = await fetch(`${HSI_API}/badge/verify?did=${encodeURIComponent(did)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { onChain: false };
    const data = await res.json();
    return { onChain: data.valid === true, bondCount: data.bond_count ?? 0 };
  } catch {
    return { onChain: null }; // network error, not necessarily invalid
  }
}

// Sync credential from any tab's localStorage into extension storage
// Called when user visits homosapience.org
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === 'complete' &&
    tab.url &&
    (tab.url.includes('homosapience.org') || tab.url.includes('localhost:3000'))
  ) {
    chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const cred = localStorage.getItem('hsi_credential');
        const did = localStorage.getItem('hsi_did');
        return { cred, did };
      },
    }).then((results) => {
      if (results && results[0] && results[0].result) {
        const { cred, did } = results[0].result;
        if (cred) {
          chrome.storage.local.set({
            hsi_credential: cred,
            hsi_did: did,
          });
          // Update badge icon to show verified state
          updateBadgeIcon(true);
        }
      }
    }).catch(() => {});
  }
});

function updateBadgeIcon(verified) {
  chrome.action.setBadgeText({ text: verified ? '✓' : '' });
  chrome.action.setBadgeBackgroundColor({ color: verified ? '#7c3aed' : '#6b7280' });
}

// On startup, check stored credential
chrome.runtime.onStartup.addListener(() => {
  getCredential().then((result) => {
    updateBadgeIcon(result.status === 'valid');
  });
});
