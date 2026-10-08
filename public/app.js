const $ = (id) => document.getElementById(id);
const forms = ['loginForm', 'codeForm', 'regForm', 'setupForm', 'welcome'];
let step = null, regUser = null;

function show(name) { forms.forEach((f) => ($(f).hidden = f !== name)); }
function msg(text, ok) { $('msg').textContent = text || ''; $('msg').className = 'msg' + (ok ? ' ok' : ''); }

async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Error');
  return data;
}

$('toReg').onclick = (e) => { e.preventDefault(); msg(); show('regForm'); };
$('toLogin').onclick = (e) => { e.preventDefault(); msg(); show('loginForm'); };

$('regForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    regUser = $('ru').value;
    const d = await post('/api/register', { username: regUser, password: $('rp').value });
    $('qr').src = d.qr; $('secret').textContent = d.secret;
    msg(); show('setupForm');
  } catch (err) { msg(err.message); }
};

$('setupForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    await post('/api/confirm', { username: regUser, code: $('sc').value });
    msg('2FA enabled! You can log in now.', true); show('loginForm');
  } catch (err) { msg(err.message); }
};

$('loginForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const d = await post('/api/login', { username: $('lu').value, password: $('lp').value });
    step = d.step; msg(); show('codeForm');
  } catch (err) { msg(err.message); }
};

$('codeForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const d = await post('/api/verify', { step, code: $('lc').value });
    sessionStorage.setItem('session', d.session);
    $('hello').textContent = 'Welcome, ' + d.username + '!';
    msg(); show('welcome');
  } catch (err) { msg(err.message); }
};

$('logout').onclick = () => { sessionStorage.removeItem('session'); show('loginForm'); };
