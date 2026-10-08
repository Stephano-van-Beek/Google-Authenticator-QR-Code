# Google Authenticator Login

A website login page that requires a Google Authenticator code to log in.

## How it works
1. **Register**: choose a username and password. The site shows a QR code.
2. **Scan** the QR code with the Google Authenticator app. The app generates a new 6-digit code every 30 seconds.
3. **Confirm** by entering the current code once to switch 2FA on.
4. **Log in**: enter username and password, then the 6-digit code from the app.

## Run it
```bash
npm install
npm start
```
Open http://localhost:3000

## Notes
- Users are stored in memory (lost on restart). Use a database for real use.
- Use HTTPS in production.
