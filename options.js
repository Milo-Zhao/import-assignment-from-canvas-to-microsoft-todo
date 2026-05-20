document.addEventListener('DOMContentLoaded', () => {

  // ── Elements ────────────────────────────────────────────────────────────────

  const authSignedOut    = document.getElementById('auth-signed-out');
  const authSignedIn     = document.getElementById('auth-signed-in');
  const authLoading      = document.getElementById('auth-loading');
  const authError        = document.getElementById('auth-error');
  const btnSignIn        = document.getElementById('btn-sign-in');
  const btnSignOut       = document.getElementById('btn-sign-out');

  // ── Auth state ────────────────────────────────────────────────────────────────

  function showAuth(state) {
    if (authSignedOut) authSignedOut.hidden = state !== 'signedOut';
    if (authSignedIn)  authSignedIn.hidden  = state !== 'signedIn';
    if (authLoading)   authLoading.hidden   = state !== 'loading';
    if (authError)     authError.hidden     = true;
  }

  async function refreshAuthStatus() {
    showAuth('loading');
    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' });
      showAuth(res.isAuthenticated ? 'signedIn' : 'signedOut');
    } catch {
      showAuth('signedOut');
    }
  }

  // ── Sign in ───────────────────────────────────────────────────────────────────

  if (btnSignIn) {
    btnSignIn.addEventListener('click', async () => {
      showAuth('loading');
      if (authError) authError.hidden = true;
      try {
        const res = await chrome.runtime.sendMessage({ type: 'START_AUTH' });
        if (res.success) {
          showAuth('signedIn');
        } else {
          throw new Error(res.error || 'Authentication failed');
        }
      } catch (err) {
        showAuth('signedOut');
        if (authError) {
          authError.textContent = `Sign-in failed: ${err.message}`;
          authError.hidden = false;
        }
      }
    });
  }

  // ── Sign out ──────────────────────────────────────────────────────────────────

  if (btnSignOut) {
    btnSignOut.addEventListener('click', async () => {
      showAuth('loading');
      await chrome.runtime.sendMessage({ type: 'SIGN_OUT' });
      showAuth('signedOut');
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────────

  refreshAuthStatus();

});
