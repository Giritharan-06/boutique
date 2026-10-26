# Password recovery

“Forgot password?” is available on the customer and admin sign-in/create-account screens. Recovery uses the existing accounts and expiring sessions store; no database schema changes are required. Reset tokens have a separate hash namespace and cannot act as sign-in sessions.

Email delivery is deliberately unconfigured until the owner sets it up. Requests show “Password recovery is temporarily unavailable. Please contact the boutique for help.” No fake email success or reset link is returned to the browser.

## Enable email later

Set these server-only environment variables locally or in Vercel, then restart/redeploy:

- `RESEND_API_KEY`: email-send API key.
- `PASSWORD_RESET_FROM`: a verified sender, such as `Aarini <accounts@your-domain.com>`.
- `PASSWORD_RESET_ORIGIN`: canonical HTTPS website origin, such as `https://boutique-roan-kappa.vercel.app` (no path). Local HTTP origins are allowed outside Vercel for development.

The sender adapter is in `lib/local/password-reset.ts`; it can be replaced for another email provider. No email account has been created, no provider subscription purchased, and no live email has been sent during implementation.

## Flow and safeguards

- Customer and admin recovery stay separate. Existing email/password sign-in remains unchanged.
- A cryptographically random reset token is stored only as a SHA-256 hash; links expire after 15 minutes and work once.
- Token secrets travel in the URL fragment, which is not sent to the page server, and the browser removes it after reading it. Do not refresh the reset form after opening a link; reopen the email link if needed.
- Valid and unknown emails receive the same generic success message when delivery is configured. Per-account requests have a persisted one-minute cooldown. A per-instance burst limit supplements it; high-traffic deployments may additionally use centralized rate limiting.
- Resetting a password atomically changes its salted scrypt hash and revokes every existing session and recovery token for that account. It does not sign the user in automatically.
- Reset pages are excluded from indexing; writes require the existing same-origin checks. Raw database/provider errors are not returned to users.

## Verify

Run `npm test` and `npm run build`. Password recovery tests use isolated temporary SQLite data and a captured in-memory email sender; no real credentials, accounts or outgoing emails are used. Tests cover both roles, expired/used/invalid tokens, cooldown, failed delivery cleanup, concurrent redemption, session revocation and missing email configuration.

After setting up email, check `/login` and `/crm/login` → **Forgot password?**. Request a link using a test account you own, open its email, set and confirm a new password, verify old credentials fail and new credentials work, then verify the same link cannot be used again.
