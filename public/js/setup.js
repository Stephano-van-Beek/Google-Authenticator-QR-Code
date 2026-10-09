const $ = (id) => document.getElementById(id);
const setupToken = new URLSearchParams(window.location.search).get('token');

function msg(text, ok) {
  $('msg').textContent = text || '';
  $('msg').className = 'msg' + (ok ? ' ok' : '');
}

// Loads the QR code only with the valid one-time token from the registration email.
async function loadSetup() {
  if (!setupToken) throw new Error('This setup link is missing its token.');
  const r = await fetch('/api/setup?token=' + encodeURIComponent(setupToken));
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Could not load two-factor setup.');
  $('qr').src = data.qr;
  $('secret').textContent = data.secret;
  $('setupForm').hidden = false;
}

// Confirms the first Authenticator code and sends the employee back to login.
$('setupForm').onsubmit = async (e) => {
  e.preventDefault();
  const r = await fetch('/api/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: setupToken, code: $('sc').value }),
  });
  const data = await r.json();
  if (!r.ok) return msg(data.error || 'Could not confirm two-factor authentication.');
  msg('Two-factor authentication is ready. You can log in now.', true);
  window.setTimeout(() => window.location.assign('login.html'), 1500);
};

loadSetup().catch((error) => msg(error.message));
