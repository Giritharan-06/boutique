# Aarini — localhost boutique and CRM

## Start

Double-click START-LOCAL.cmd, or run npm run dev from this folder.

- Website: http://127.0.0.1:5173/
- CRM: http://127.0.0.1:5173/crm

Node.js 24 is used. Run npm install if dependencies are missing. No ChatGPT login, Python, CUDA, local AI model or paid API key is needed. Keep the terminal running while using the app; Ctrl+C stops it. The server binds only to 127.0.0.1.

## Local data

Products, customer profiles, orders, appointments, accounts, AI allowances, plans and sessions are saved in .local/boutique.sqlite. Uploaded product photos are stored under .local/product-images. Existing local development records from the earlier D1 preview are imported once, if present. Bag and wishlist are device-local browser preferences. Back up the .local directory while the app is stopped. This directory is excluded from Git.

Order prices and stock are calculated server-side. Updates use SQLite transactions and revision checks. Requests with unexpected hosts or origins are rejected. The CRM at /crm has local admin sign-in and first-time account creation. Customers can create an account on the storefront, manage their profile and view their own orders at /account. Passwords are stored as scrypt hashes; admin and customer sessions use separate HttpOnly cookies. Existing localhost accounts and passwords are not included in this repository. This local workspace is not intended to be exposed to the internet.

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

Four AI-generated sample photos are supplied for each collection. CRM product forms accept up to four JPG, PNG or WebP photos per style; uploads are resized and saved locally. When present, the first uploaded garment photo is used by AI try-on after explicit consent. Replace the shared collection samples with each item’s real images and measurements before launch. AI preview illustrates appearance, not measured fit.

## Checks

- npm test
- npx tsc --noEmit
- npm run build
- npm run test:crm (temporary local API fixtures, cleaned up after the run)
- npm run test:commerce (temporary profile, order, credit and plan checks)
- node scripts/verify-local.mjs (local API and hosted connectivity)
- node scripts/verify-local.mjs --generate (sends only synthetic catalogue images to the hosted model and saves an actual result if the free demo is available)

## Hosting

The source repository is https://github.com/Giritharan-06/boutique. Pushing source does not deploy or host this application. Run it on localhost; do not register a new Site or push to the old hosting remote. .openai/hosting.json retains the old project ID as historical metadata, not active configuration. The earlier private ChatGPT-hosted deployment is separate; stopping localhost does not remove that old deployment.

Online payments, carrier integration, email notifications, password recovery and multi-staff roles are not configured. Clothing orders are recorded as unpaid cash-on-delivery orders. Recording a payment or activating AI credits in the CRM does not collect money.
