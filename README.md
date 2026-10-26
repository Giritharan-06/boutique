# Aarini — localhost boutique and CRM

## Start

Double-click START-LOCAL.cmd, or run npm run dev from this folder.

- Website: http://127.0.0.1:5173/
- CRM: http://127.0.0.1:5173/crm

Node.js 24 is used. Run npm install if dependencies are missing. No ChatGPT login, Python, CUDA, local AI model or paid API key is needed. Keep the terminal running while using the app; Ctrl+C stops it. The server binds only to 127.0.0.1.

## Database

Copy .env.example to .env.local and set DATABASE_URL to your PostgreSQL connection string. The launcher loads it on startup. The connection is server-only, pooled and encrypted with certificate verification and channel binding enabled. Never put it in a NEXT_PUBLIC_ or VITE_ variable or commit it to Git.

With DATABASE_URL configured, products, customer profiles, orders, appointments, accounts, sessions, AI allowances, plans and uploaded product photos are saved in the PostgreSQL aarini schema. Other schemas are untouched. A connection failure does not silently switch to a separate local database.

- npm run db:check verifies TLS and table counts without printing connection details.
- npm run db:migrate copies the existing .local/boutique.sqlite data and uploaded photos into an empty aarini schema. Stop the app first. It refuses to overwrite existing remote records and leaves the SQLite source unchanged as a backup.
- Without DATABASE_URL, the app uses .local/boutique.sqlite and .local/product-images for offline development. Back up .local while the app is stopped. Both .local and .env.local are excluded from Git. Restart after changing the database configuration.

Bag and wishlist are device-local browser preferences. AI photos and results are temporary; they are not saved to PostgreSQL. Order prices and stock are calculated server-side. Updates use transactions, revision checks and a database lock for shared writes. Requests with unexpected hosts or origins are rejected. The CRM at /crm has admin sign-in and first-time account creation. Customers can create an account on the storefront, manage their profile and view their own orders at /account. Passwords are stored as scrypt hashes; admin and customer sessions use separate HttpOnly cookies. Existing accounts and passwords are not included in this repository. This workspace is not intended to be exposed to the internet.

## Shopping and CRM

- Forty sample styles across four collections, product galleries, size selection, search, wishlist and shopping bag.
- Buy now checkout with cash on delivery, server-calculated delivery charges and customer order history.
- CRM product uploads, inventory, customers, order status and payment records, appointments and CSV exports.
- CRM Settings for store details, delivery preferences, individual AI limits, credit packs and subscription plans.
- AI credit and plan selections remain pending until an administrator confirms payment. No online payment gateway or automatic recurring charges are connected. Offer names, prices and allowances can be changed in Settings.

## Free hosted virtual try-on

The app uses the official FASHN VTON 1.5 Hugging Face Space:
https://huggingface.co/spaces/fashn-ai/fashn-vton-1.5

Only ordinary image decoding, orientation correction, resizing and format conversion happen locally. All model inference runs on the hosted Space. There are no local model files or GPU processes, and the launcher does not start Python.

The user must consent before a photo and the selected outfit are sent to the public demo. The app connects anonymously: it has no billing key or paid fallback. The free GPU quota and queue are shared and can be exhausted; the UI reports errors rather than inventing a preview. The Space can be unavailable or require sign-in at any time. No guarantee of unlimited free generation is made.

The job endpoint reports queued/running/completed/failed states. Only one job runs at a time on this local app, with a five-minute timeout and a Cancel button. Inputs are never written to the local database; output images are held in server memory for up to 15 minutes. Clearing a photo locally does not guarantee deletion by Hugging Face or the Space operator.

The core FASHN model is Apache-2.0, but its bundled human parser inherits the NVIDIA SegFormer non-commercial evaluation licence. This integration is a prototype/demo, not a cleared commercial try-on service. Review all upstream licences before business deployment:
- https://huggingface.co/fashn-ai/fashn-vton-1.5
- https://github.com/fashn-AI/fashn-human-parser/blob/main/LICENSE
- https://github.com/NVlabs/SegFormer/blob/master/LICENSE

Four AI-generated sample photos are supplied for each collection. CRM product forms accept up to four JPG, PNG or WebP photos per style; uploads are resized and saved to the configured database (local files in offline mode). When present, the first uploaded garment photo is used by AI try-on after explicit consent. Replace the shared collection samples with each item’s real images and measurements before launch. AI preview illustrates appearance, not measured fit.

## Checks

- npm test
- npx tsc --noEmit
- npm run build
- npm run test:crm (temporary local API fixtures, cleaned up after the run)
- npm run test:commerce (temporary profile, order, credit and plan checks)
- npm run test:postgres (concurrent credit reservations and activation checks, using disposable accounts in the configured PostgreSQL database)
- node scripts/verify-local.mjs (local API and hosted connectivity)
- node scripts/verify-local.mjs --generate (sends only synthetic catalogue images to the hosted model and saves an actual result if the free demo is available)

## Hosting

### Vercel build configuration

The production command is `npm run build` (`next build --webpack`), which creates the native Next.js `.next` output and routes manifest expected by Vercel. The checked-in `vercel.json` sets the Next.js framework, build command, output directory and canonical `APP_ORIGIN` for this site's Vercel domain. Node.js is pinned to 24.x. `npm start` runs the native Next.js production server locally after building; development still uses the existing Vinext launcher.

Run `npm run test:production` to check the built pages, PostgreSQL catalogue and protected CRM endpoint on temporary localhost port 5174. Run `npm run test:hosted-auth` to verify production signup, signin, secure cookies, signout, request-origin protection and logo assets on temporary port 5175; its disposable customer is removed after the check. Configure `DATABASE_URL` separately in Vercel's server environment; the local secret file is excluded from Git, and hosted deployments require PostgreSQL instead of silently creating a local SQLite file.

API requests accept localhost, the configured HTTPS `APP_ORIGIN`, and Vercel's server-provided deployment, branch and production origins. Writes require a matching browser Origin; external origins and unconfigured proxy hosts are rejected. Update `APP_ORIGIN` when changing the canonical domain. Hosted session cookies are Secure and HttpOnly. Public customer signup is available; creating hosted studio accounts requires an existing signed-in owner. Bootstrap the first owner locally against the target PostgreSQL database before deployment.

The source repository is https://github.com/Giritharan-06/boutique. A Vercel Git integration can build and deploy pushes to its configured branches. The local launcher binds to localhost. Do not register a new ChatGPT Site or push to the old hosting remote. .openai/hosting.json retains the old project ID as historical metadata, not active configuration. The earlier private ChatGPT-hosted deployment is separate; stopping localhost does not remove that old deployment.

Online payments, carrier integration, email notifications, password recovery and multi-staff roles are not configured. Clothing orders are recorded as unpaid cash-on-delivery orders. Recording a payment or activating AI credits in the CRM does not collect money.
