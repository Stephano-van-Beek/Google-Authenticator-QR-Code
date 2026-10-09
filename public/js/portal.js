// Reads the session token created after a successful two-factor sign-in.
const session = sessionStorage.getItem('session');

// Loads portal information only when the server accepts the session token.
async function openPortal() {
  if (!session) {
    window.location.replace('/html/login.html');
    return;
  }

  const r = await fetch('/api/dashboard', { headers: { 'X-Session': session } });
  if (!r.ok) {
    sessionStorage.removeItem('session');
    window.location.replace('/html/login.html');
    return;
  }

  const data = await r.json();
  document.getElementById('hello').textContent = 'Welcome, ' + data.username + '!';
  document.getElementById('announcement').textContent = data.announcement;
  document.getElementById('portal').hidden = false;
}

// Removes the session from the server and browser, then returns to sign-in.
document.getElementById('logout').onclick = async () => {
  await fetch('/api/logout', { method: 'POST', headers: { 'X-Session': session } });
  sessionStorage.removeItem('session');
  window.location.replace('/html/login.html');
};

// An expired or invalid session cannot open the portal.
openPortal().catch(() => {
  sessionStorage.removeItem('session');
  window.location.replace('/html/login.html');
});
