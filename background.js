const GRAPH_BASE    = 'https://graph.microsoft.com/v1.0';
const AUTH_ENDPOINT = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const CLIENT_ID     = 'fbdc96e5-9057-4890-8a43-c93b4425c18a';

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => chars[b % chars.length]).join('');
}

// ── Auth ──────────────────────────────────────────────────────────────────────

// Uses OAuth 2.0 implicit flow — the access token is returned directly in the
// redirect URL fragment, so no client secret or token-exchange step is needed.
function startAuth() {
  const redirectUri = `https://${chrome.runtime.id}.chromiumapp.org/`;

  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set('client_id',     CLIENT_ID);
  url.searchParams.set('response_type', 'token');
  url.searchParams.set('response_mode', 'fragment');
  url.searchParams.set('redirect_uri',  redirectUri);
  url.searchParams.set('scope',         'https://graph.microsoft.com/Tasks.ReadWrite');
  url.searchParams.set('state',         randomString(16));
  url.searchParams.set('nonce',         randomString(16));

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: url.toString(), interactive: true }, async (responseUrl) => {
      if (chrome.runtime.lastError || !responseUrl) {
        return reject(new Error(chrome.runtime.lastError?.message || 'Auth cancelled'));
      }
      const fragment     = new URLSearchParams(new URL(responseUrl).hash.slice(1));
      const accessToken  = fragment.get('access_token');
      const expiresIn    = parseInt(fragment.get('expires_in') || '3600', 10);
      const errorMsg     = fragment.get('error_description') || fragment.get('error');

      if (!accessToken) return reject(new Error(errorMsg || 'No access token returned'));

      const expiresAt = Date.now() + expiresIn * 1000 - 60_000; // 1-min buffer
      await chrome.storage.local.set({ accessToken, tokenExpiresAt: expiresAt });
      resolve(true);
    });
  });
}

async function getValidAccessToken() {
  const { accessToken, tokenExpiresAt } = await chrome.storage.local.get(['accessToken', 'tokenExpiresAt']);
  if (!accessToken) throw new Error('NOT_AUTHENTICATED');
  if (Date.now() < tokenExpiresAt) return accessToken;

  // Silently refresh — shows login UI only if the Microsoft session has lapsed.
  await startAuth();
  const { accessToken: fresh } = await chrome.storage.local.get('accessToken');
  if (!fresh) throw new Error('NOT_AUTHENTICATED');
  return fresh;
}

function signOut() {
  return chrome.storage.local.remove(['accessToken', 'tokenExpiresAt', 'todoListId']);
}

// ── Microsoft Graph ───────────────────────────────────────────────────────────

async function getTaskListId(token) {
  const { todoListId } = await chrome.storage.local.get('todoListId');
  if (todoListId) return todoListId;

  const res = await fetch(`${GRAPH_BASE}/me/todo/lists`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch To Do lists');

  const { value: lists } = await res.json();
  const list = lists.find((l) => l.isOwner && l.displayName === 'Tasks') || lists[0];
  if (!list) throw new Error('No To Do list found');

  await chrome.storage.local.set({ todoListId: list.id });
  return list.id;
}

async function createTask(token, listId, { title, description, dueDateTime }) {
  const body = { title, importance: 'normal', status: 'notStarted' };
  if (description)  body.body         = { content: description, contentType: 'html' };
  if (dueDateTime)  body.dueDateTime  = { dateTime: dueDateTime, timeZone: 'UTC' };

  const res = await fetch(`${GRAPH_BASE}/me/todo/lists/${listId}/tasks`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error?.message || 'Failed to create task');
  }
  return res.json();
}

// ── Message router ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
  return true; // keep the message channel open for async response
});

async function handleMessage({ type, data }) {
  switch (type) {
    case 'ADD_TASK': {
      const token  = await getValidAccessToken();
      const listId = await getTaskListId(token);
      const task   = await createTask(token, listId, data);
      return { success: true, taskId: task.id };
    }
    case 'START_AUTH':      { await startAuth(); return { success: true }; }
    case 'SIGN_OUT':        { await signOut();   return { success: true }; }
    case 'GET_AUTH_STATUS': {
      const { accessToken, tokenExpiresAt } = await chrome.storage.local.get(['accessToken', 'tokenExpiresAt']);
      return { success: true, isAuthenticated: !!accessToken && Date.now() < tokenExpiresAt };
    }
    default: throw new Error(`Unknown message type: ${type}`);
  }
}
