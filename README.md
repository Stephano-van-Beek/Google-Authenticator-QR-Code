# Employee Portal with Two-Factor Authentication

A small employee-portal demo that starts at the sign-in page. It requires a password and a Google Authenticator code before a visitor can open the protected portal page.

## What this project uses

- **No database is required.** It runs with Node.js and the packages listed in `package.json`.
- User accounts, pending two-factor checks, and signed-in sessions are kept in the server's memory while it is running.
- A signed-in employee session expires eight hours after the Authenticator code is verified. The employee must sign in again after it expires.
- The Google Authenticator app supplies the changing six-digit code. This is two-factor authentication, not "Sign in with Google."
- Registration sends the Google Authenticator setup link through Resend. A verified Resend sender domain and API key are required.

## How it works
1. **Open the website**: it shows two side-by-side sections: **Register** and **Log in**.
2. **Register**: enter a username, work email, and password. The registration page does not show a QR code.
3. **Open the email**: Resend sends the work email a one-time setup link that expires after 24 hours.
4. **Set up Authenticator**: the emailed link opens the QR-code page. Scan it with Google Authenticator and enter its current six-digit code once.
5. **Log in**: enter username, password, and the current six-digit Authenticator code in the Log in section.
6. **Employee portal**: after all three login details are correct, the browser opens the protected page and shows “Congrats, you made it!” Opening that page without a valid session sends the visitor back to sign-in.

## Run it
```bash
npm install
npm start
```
Open http://localhost:3000

## Email setup with Resend

1. Create a Resend account and verify a domain that you control. Resend requires a verified sender domain.
2. Copy `.env.example` to a new file named `.env`.
3. Put your Resend API key in `RESEND_API_KEY`.
4. Set `FROM_EMAIL` to an address on your verified domain, for example `Employee Portal <hr@yourdomain.com>`.
5. Set `PUBLIC_BASE_URL` to the public URL employees use. For local testing on the same computer, use `http://localhost:3000`. To open email links on a phone, use a public HTTPS tunnel URL instead.

Never commit the `.env` file or share its Resend API key. This repository contains no personal email address, password, or Authenticator secret; each student must configure their own values.

## Project folders

```text
public/
  css/    Website styling
  html/   Sign-in, emailed setup, and protected portal pages
  js/     Browser code for sign-in, setup, and portal access
server.js Server routes and two-factor authentication checks
```

## Server route commands

`app.post('/api/register', ...)` means: when the browser sends a **POST** request to `/api/register`, create a temporary employee account and return its QR code. The other `app.post(...)` commands receive information that changes something, such as confirming two-factor authentication, starting a login, checking a code, or logging out.

`app.get(...)` means: when the browser asks for information. For example, `/api/dashboard` checks the employee's session before returning protected portal information.

## Notes
- Restarting the server clears all registered users and signs everyone out. This is expected because there is no database.
- Use HTTPS in production.

## Adding a database later

The current in-memory storage and a clearly marked `DATABASE CONNECTION POINT` are deliberately kept together near the top of `server.js`:

- `users` holds usernames, password hashes, Authenticator secrets, and whether two-factor setup is complete.
- `pending` holds temporary login steps while a code is being checked.
- `sessions` holds signed-in sessions and their eight-hour expiry times.

When a database is added, replace those three in-memory objects with database reads and writes while keeping the existing API routes. This leaves a clear place to add persistent employee accounts without changing the login-page flow.
