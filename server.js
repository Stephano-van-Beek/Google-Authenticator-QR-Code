const express = require('express');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const users = {};     // username -> { salt, hash, secret, enabled }
const pending = {};   // token -> username (password OK, waiting for code)
const sessions = {};  // token -> username

const hash = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
const token = () => crypto.randomBytes(24).toString('hex');

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password || password.length < 8)
    return res.status(400).json({ error: 'Username and a password of 8+ characters required.' });
  if (users[username]) return res.status(409).json({ error: 'Username already taken.' });
  const secret = speakeasy.generateSecret({ name: 'MyWebsite (' + username + ')' });
  const salt = crypto.randomBytes(16).toString('hex');
  users[username] = { salt, hash: hash(password, salt), secret: secret.base32, enabled: false };
  const qr = await QRCode.toDataURL(secret.otpauth_url);
  res.json({ qr, secret: secret.base32 });
});

app.post('/api/confirm', (req, res) => {
  const { username, code } = req.body || {};
  const u = users[username];
  if (!u) return res.status(400).json({ error: 'Unknown user.' });
  const ok = speakeasy.totp.verify({ secret: u.secret, encoding: 'base32', token: String(code), window: 1 });
  if (!ok) return res.status(401).json({ error: 'Wrong code.' });
  u.enabled = true;
  res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const u = users[username];
  if (!u || !u.enabled || hash(password || '', u.salt) !== u.hash)
    return res.status(401).json({ error: 'Invalid username, password, or 2FA not set up.' });
  const t = token();
  pending[t] = username;
  res.json({ step: t });
});

app.post('/api/verify', (req, res) => {
  const { step, code } = req.body || {};
  const username = pending[step];
  if (!username) return res.status(401).json({ error: 'Login expired. Start again.' });
  const ok = speakeasy.totp.verify({ secret: users[username].secret, encoding: 'base32', token: String(code), window: 1 });
  if (!ok) return res.status(401).json({ error: 'Wrong code.' });
  delete pending[step];
  const s = token();
  sessions[s] = username;
  res.json({ session: s, username });
});

app.get('/api/me', (req, res) => {
  const u = sessions[req.headers['x-session']];
  if (!u) return res.status(401).json({ error: 'Not logged in.' });
  res.json({ username: u });
});

app.listen(3000, () => console.log('http://localhost:3000'));
