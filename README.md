# Aarini Boutique & Studio

A first working private boutique application in ivory, blush, sage and burgundy.

## Included

- `/`: responsive storefront, occasion filters, product search, wishlist, bag, size guide and order requests.
- `/crm`: overview, orders, product editing, customers, appointment requests and provider status.
- Virtual fitting room: local photo upload, explicit consent, outfit and size selection, photo deletion, server-side generation adapter.
- D1 persistence, account-scoped records and optimistic concurrency. Order requests calculate prices server-side, reduce stock, and create customers. Cancellation restores stock once.
- Sign in with ChatGPT through the Sites integration. Hosted site is private.

## Development

Node 22.13+ required. Dependencies are installed. Start with `npm run dev`. The local server normally uses http://localhost:5173. Local sign-in is available at `/signin-with-chatgpt?return_to=/crm`. It uses a development identity only; hosted sign-in is handled by Sites.

After schema changes run `npm run db:generate` and build with the Sites build helper to generate the Wrangler config. Apply the generated SQL with:

```
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_military_dakota_north.sql
```

`node --test tests/model.test.mjs` checks pricing, stock, cancellation, validation and immutability. `npx tsc --noEmit` checks types.

## Connect real virtual try-on

No AI provider credentials are configured. No fabricated try-on results are displayed. An uploaded photo remains in browser memory until generation is explicitly requested and the provider is connected. No photos are stored in D1 or localStorage.

Set runtime secrets using Sites environment tools (local development: ignored `.dev.vars`):

- `TRYON_API_URL`: HTTPS URL of your provider adapter.
- `TRYON_API_KEY`: bearer token for that adapter, kept server-side.

The server POSTs JSON `{ photo, garment, size }` to the adapter. `photo` is a JPG/PNG/WebP data URL. `garment` includes catalogue fields, `image` (the campaign image URL), and `panel` (0=left, 1=middle, 2=right). The adapter must extract the selected panel and map inputs to the chosen virtual try-on service. Return `{ "imageUrl": "https://..." }` or a PNG/JPEG/WebP data URL. Do not point this at an arbitrary provider endpoint with a different contract. The request has a 60-second timeout. The adapter should enforce per-user budgets, retention and rate limits before a paid launch.

## Before a public commerce launch

This is a private first version. Every signed-in account has its own catalogue and CRM; it is not yet a multi-user shop where anonymous shoppers feed one shared merchant CRM. Keep the Site private until merchant/staff authorization and shared customer checkout are implemented.

Orders are requests, not paid transactions. Payment processing, shipping integration, taxes, transactional notifications and customer accounts are not configured. Appointment requests require confirmation outside this application. Product images are AI-generated illustrative campaign assets, and the size chart is a sample. Replace them with your actual product photography and measurements. Product photo selection currently uses three campaign panels; arbitrary photo upload is not implemented.

Data lives in D1, not browser storage. Bag and wishlist preferences are device-local. Site deployment applies committed schema migrations; local preview and hosted databases are separate. Do not store sensitive customer measurements without a suitable privacy policy.
