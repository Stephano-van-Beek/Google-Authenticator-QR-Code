require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const path = require('path');
const { Resend } = require('resend');

const app = express();
// Lets the server read JSON sent by the browser, such as a username and password.
app.use(express.json());
// Sends the sign-in page when someone opens the website's root address.
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'html', 'login.html')));
// Supports the familiar /index.html address for the protected employee portal.
// The portal page's JavaScript sends visitors without a session back to sign-in.
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'html', 'index.html')));
// Makes the files in public/ available to the browser.
app.use(express.static('public'));

// Temporary storage used while the server is running; it is cleared on restart.
const users = {};     // username -> { email, salt, hash, secret, enabled }
const pending = {};   // token -> username (password OK, waiting for code)
const sessions = {};  // token -> { username, expiresAt }
const setupLinks = {}; // token -> { username, expiresAt }

// Turns a password into a value that is safe to store instead of the password itself.
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
// Creates unpredictable tokens for login steps and employee sessions.
const token = () => crypto.randomBytes(24).toString('hex');
// A successful employee login remains valid for eight hours.
const sessionLength = 8 * 60 * 60 * 1000;
const setupLinkLength = 24 * 60 * 60 * 1000;
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const usernamePattern = /^[a-zA-Z0-9_-]{3,32}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// DATABASE CONNECTION POINT:
// Replace the users, pending, sessions, and setupLinks objects above with database queries here.
// Keep the route handlers below; they can call helpers such as findUser(), saveUser(), and saveSession().

// Returns the signed-in employee only when their session exists and has not expired.
const sessionUser = (req) => {
  const sessionToken = req.headers['x-session'];
  const session = sessions[sessionToken];
  if (!session || session.expiresAt <= Date.now()) {
    delete sessions[sessionToken];
    return undefined;
  }
  return session.username;
};

// Creates an employee account and emails a one-time Authenticator setup link.
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!usernamePattern.test(username || ''))
    return res.status(400).json({ error: 'Username must be 3-32 letters, numbers, underscores, or hyphens.' });
  if (!emailPattern.test(email || '') || !password || password.length < 8)
    return res.status(400).json({ error: 'A valid email and a password of 8+ characters are required.' });
  if (users[username]) return res.status(409).json({ error: 'Username already taken.' });
  if (!resend || !process.env.FROM_EMAIL || !process.env.PUBLIC_BASE_URL)
    return res.status(500).json({ error: 'Email delivery is not configured. Set RESEND_API_KEY, FROM_EMAIL, and PUBLIC_BASE_URL.' });

  const secret = speakeasy.generateSecret({ name: 'MyWebsite (' + username + ')' });
  const salt = crypto.randomBytes(16).toString('hex');
  const setupToken = token();
  const setupUrl = new URL('/html/setup.html', process.env.PUBLIC_BASE_URL);
  setupUrl.searchParams.set('token', setupToken);
  users[username] = { email, salt, hash: hash(password, salt), secret: secret.base32, enabled: false };
  setupLinks[setupToken] = { username, expiresAt: Date.now() + setupLinkLength };

  try {
    await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: email,
      subject: 'Set up Google Authenticator for Employee Portal',
      html: `<p>Hello ${username},</p><p>Use this one-time link to set up Google Authenticator:</p><p><a href="${setupUrl.href}">Set up two-factor authentication</a></p><p>This link expires in 24 hours.</p>`,
    });
    res.status(201).json({ message: 'Check your email for the Google Authenticator setup link.' });
  } catch (error) {
    delete users[username];
    delete setupLinks[setupToken];
    res.status(502).json({ error: 'Could not send the setup email. Check the email configuration and try again.' });
  }
});

// Loads the QR code only when the emailed one-time setup link is still valid.
app.get('/api/setup', async (req, res) => {
  const setup = setupLinks[req.query.token];
  if (!setup || setup.expiresAt <= Date.now()) {
    delete setupLinks[req.query.token];
    return res.status(401).json({ error: 'This setup link is invalid or has expired.' });
  }
  const user = users[setup.username];
  if (!user) return res.status(400).json({ error: 'Unknown user.' });
  const qr = await QRCode.toDataURL(speakeasy.otpauthURL({
    secret: user.secret,
    label: `Employee Portal (${setup.username})`,
    issuer: 'Employee Portal',
    encoding: 'base32',
  }));
  res.json({ qr, secret: user.secret });
});

// Checks the first Authenticator code and enables two-factor authentication.
app.post('/api/confirm', (req, res) => {
  const { token: setupToken, code } = req.body || {};
  const setup = setupLinks[setupToken];
  if (!setup || setup.expiresAt <= Date.now()) {
    delete setupLinks[setupToken];
    return res.status(401).json({ error: 'This setup link is invalid or has expired.' });
  }
  const u = users[setup.username];
  if (!u) return res.status(400).json({ error: 'Unknown user.' });
  const ok = speakeasy.totp.verify({ secret: u.secret, encoding: 'base32', token: String(code), window: 1 });
  if (!ok) return res.status(401).json({ error: 'Wrong code.' });
  u.enabled = true;
  delete setupLinks[setupToken];
  res.json({ ok: true });
});

// Checks the employee's username and password before requesting their 2FA code.
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const u = users[username];
  if (!u || !u.enabled || hash(password || '', u.salt) !== u.hash)
    return res.status(401).json({ error: 'Invalid username, password, or 2FA not set up.' });
  const t = token();
  pending[t] = username;
  res.json({ step: t });
});

// Checks the 2FA code and creates an eight-hour session when it is correct.
app.post('/api/verify', (req, res) => {
  const { step, code } = req.body || {};
  const username = pending[step];
  if (!username) return res.status(401).json({ error: 'Login expired. Start again.' });
  const ok = speakeasy.totp.verify({ secret: users[username].secret, encoding: 'base32', token: String(code), window: 1 });
  if (!ok) return res.status(401).json({ error: 'Wrong code.' });
  delete pending[step];
  const s = token();
  sessions[s] = { username, expiresAt: Date.now() + sessionLength };
  res.json({ session: s, username });
});

// GET means the browser asks for information; this route checks an existing session.
app.get('/api/me', (req, res) => {
  const username = sessionUser(req);
  if (!username) return res.status(401).json({ error: 'Not logged in.' });
  res.json({ username });
});

// Returns protected portal information only for a valid, unexpired session.
app.get('/api/dashboard', (req, res) => {
  const username = sessionUser(req);
  if (!username) return res.status(401).json({ error: 'Not logged in.' });
  res.json({
    username,
    announcement: 'You are signed in to the employee portal.',
  });
});

// Deletes the current session when the employee chooses to log out.
app.post('/api/logout', (req, res) => {
  delete sessions[req.headers['x-session']];
  res.status(204).end();
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`http://localhost:${port}`));
