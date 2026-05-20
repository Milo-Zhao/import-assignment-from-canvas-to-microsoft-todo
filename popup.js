const elSignedOut  = document.getElementById('state-signed-out');
const elSignedIn   = document.getElementById('state-signed-in');
const elError      = document.getElementById('state-error');
const elLoading    = document.getElementById('loading');
const elErrorMsg   = document.getElementById('error-message');

function showState(name) {
  elSignedOut.hidden = name !== 'signedOut';
  elSignedIn.hidden  = name !== 'signedIn';
  elError.hidden     = name !== 'error';
  elLoading.hidden   = name !== 'loading';
}

async function init() {
  showState('loading');
  const { isAuthenticated } = await chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' });
  showState(isAuthenticated ? 'signedIn' : 'signedOut');
}

async function signIn() {
  showState('loading');
  try {
    const res = await chrome.runtime.sendMessage({ type: 'START_AUTH' });
    if (res.success) {
      showState('signedIn');
    } else {
      throw new Error(res.error || 'Authentication failed');
    }
  } catch (err) {
    elErrorMsg.textContent = err.message || 'Authentication failed. Please try again.';
    showState('error');
  }
}

document.getElementById('btn-sign-in').addEventListener('click', signIn);
document.getElementById('btn-retry').addEventListener('click', signIn);
document.getElementById('btn-sign-out').addEventListener('click', async () => {
  showState('loading');
  await chrome.runtime.sendMessage({ type: 'SIGN_OUT' });
  showState('signedOut');
});

init();
