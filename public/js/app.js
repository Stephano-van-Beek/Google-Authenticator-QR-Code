// A short helper that finds an HTML element by its id.
const $ = (id) => document.getElementById(id);
// Shows an error or success message above the form.
function msg(text, ok) { $('msg').textContent = text || ''; $('msg').className = 'msg' + (ok ? ' ok' : ''); }

// Sends JSON to a server endpoint and waits for its JSON response.
// "async" lets callers use "await" because network requests finish later.
async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Error');
  return data;
}

// Creates an account and asks the server to email a one-time setup link.
$('regForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const d = await post('/api/register', {
      username: $('ru').value,
      email: $('re').value,
      password: $('rp').value,
    });
    e.currentTarget.reset();
    msg(d.message, true);
  } catch (err) { msg(err.message); }
};

// Checks username, password, and the current Authenticator code in one login form.
$('loginForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const login = await post('/api/login', { username: $('lu').value, password: $('lp').value });
    const verification = await post('/api/verify', { step: login.step, code: $('lc').value });
    sessionStorage.setItem('session', verification.session);
    window.location.assign('/html/index.html');
  } catch (err) { msg(err.message); }
};

// If a valid session already exists, skip sign-in and open the portal.
async function redirectToPortalIfLoggedIn() {
  const session = sessionStorage.getItem('session');
  if (!session) return;
  const r = await fetch('/api/me', { headers: { 'X-Session': session } });
  if (r.ok) {
    window.location.replace('/html/index.html');
    return;
  }
  sessionStorage.removeItem('session');
}

redirectToPortalIfLoggedIn().catch(() => msg('Could not check your existing login. Please sign in again.'));
