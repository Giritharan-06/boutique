# Fabric-to-blouse prototype — Phase 1

This adds a browser-only admin trial alongside the existing hosted outfit try-on. It does not replace the storefront fitting room, consume AI credits, upload fabrics to a rendering service, or change any database schema.

## Enable and open

1. Set `FABRIC_TRIAL_ENABLED=true` in the ignored `.env.local` file and restart the app. The default in `.env.example` is `false`.
2. Sign into the existing boutique admin account at `/crm/login`.
3. Open **AI fitting room → Fabric-to-blouse studio**, or visit `/crm/fabric-trial` directly.
4. Upload a JPG, PNG or WebP fabric image under 5 MB, or choose **Try the sample fabric**.

Both the page and capability endpoint verify the existing admin cookie on the server. Customers and anonymous visitors cannot open the trial. With the flag off, the page, browser checks and capability endpoint return 404. The customer Try-On page has no trial link.

On Vercel, set the same server-side flag only when deliberately enabling admin trials and redeploy. Do not use a `NEXT_PUBLIC_` variable. Existing `DATABASE_URL`, domain validation, admin accounts and sessions remain in use. No new database tables, columns or settings are introduced. There is no customer-enable switch in this phase.

## What works

- Boat Neck, Princess Cut, Puff Sleeve and Elbow-Length Sleeve design cards.
- Fabric decoding, validation, crop rectangle selection by mouse or touch, and keyboard-editable crop percentages.
- Pattern scale, rotation, horizontal/vertical position and repetition; optional seam guides.
- Fixed-model blouse alignment controls with face protection.
- Original, mapped and split comparison modes.
- Reset adjustments, remove/replace fabric and a complete 768 × 1024 PNG download.
- Responsive desktop and mobile panels; keyboard controls and status/error messages.

No recolouring, tinting, body transformation or inference is performed. Browser colour management and resampling still apply; JPG compression and rescaling can slightly change edge pixels. Single-swatch mode can leave part of the garment uncovered when moved. The result is a flat fabric study, not a realistic AI fit, material drape simulation or tailoring measurement. Download always exports the full mapped result, independently of the active comparison mode.

## Placeholder assets and real-model replacement

The existing catalogue contains fashion photos but no matched front-facing blouse mask set. Phase 1 therefore uses an **explicitly labelled illustrated female reference** at `/public/fabric-trial/reference-model.svg` and four matching transparent SVG masks. The original face, hair and body pixels remain unchanged outside the garment overlay. A protected top region prevents the adjustable blouse from covering the face. Exported images retain the illustrated-reference notice.

For a photographic prototype, supply a licensed, front-facing model photo in a neutral base garment, with unobscured arms and torso, and four transparent masks traced specifically to that same photo and pose. Also supply front/back neckline, sleeve and seam references where needed. Use one consistent image size. Update the model dimensions, protected-face boundary, pivot, per-template bounds, mask URLs and optional seam paths in `templates.ts`, then re-run browser checks. Do not reuse a generic garment mask and claim realistic fitting. Model upload or automatic body segmentation is intentionally not part of Phase 1.

`node scripts/generate-fabric-assets.mjs` regenerates the placeholder masks, thumbnails and synthetic sample swatch from the authored template paths. It does not generate or fetch model photographs.

## Modules

| File | Responsibility |
| --- | --- |
| `app/image-upload.tsx` | Shared existing-style upload control, reused by both fitting modes |
| `app/fabric-trial/images.ts` | File validation, decode, bounded-size canvas and crop processing |
| `app/fabric-trial/templates.ts` | Four designs, model coordinates and safe adjustment bounds |
| `app/fabric-trial/renderer.ts` | Browser texture mapping, alpha masks, alignment and comparison |
| `app/fabric-trial/export.ts` | PNG encoding and download |
| `app/fabric-trial/types.ts` | `FabricRenderService` interface for a future opt-in renderer |
| `app/fabric-trial/studio.tsx` | Trial UI state, loading/errors and render cancellation |
| `lib/local/fabric-trial.ts` | Existing-auth admin check and server feature flag |

The browser renderer implements `FabricRenderService`. A future AI adapter can consume the original fabric Blob, selected template, crop and alignment settings, and return the same rendered-surface result with `method: 'ai'`. Such an adapter would need separate consent, privacy handling and request/error policy. No paid APIs, AI SDKs, model downloads or GPU processes are used by this prototype.

## Verification

Verified on 26 October 2026: all 39 Node tests passed, the native Next production build passed its TypeScript checks, both feature-flag states passed the admin/customer access integration check, and all 8 real-browser canvas checks passed. The UI was checked at 1280 px and 390 px widths without horizontal overflow. A fabric was uploaded through the actual file chooser and the download button produced a verified 768 × 1024 PNG. Existing remote AI generation was not invoked during these checks, so no customer credits were consumed.

### Automated

```text
npm test
npx tsc --noEmit
npm run build
npm run test:fabric-access
```

The access check starts a temporary production server on port 5176. It creates disposable admin/customer accounts using the existing account flow, checks customer/anonymous exclusion and flag-off behavior, confirms the existing CRM/catalogue endpoints still work, and removes only those test records afterward. It uses the configured database but creates no schemas. If interrupted, run `node scripts/verify-fabric-trial.mjs --cleanup`.

### Real browser canvas checks

With the flag enabled and signed in as admin, open `/crm/fabric-trial/checks` and click **Run browser checks**. These use synthetic in-memory swatches and the real Canvas API to verify:

- JPG/PNG/WebP decode and invalid/corrupt file handling.
- Exact interior PNG colour preservation.
- Four distinct masks and unchanged face/lower-body pixels.
- Pattern repeat, scale, rotation and position changes.
- Crop exclusion, manual alignment and comparison modes.
- Full PNG export dimensions and pixel equality with the mapped result.

No personal photos or external rendering calls are involved.

### UI smoke checklist

1. Upload each supported format; try an unsupported and corrupt file.
2. Drag a crop and edit its percentages using the keyboard.
3. Switch all four designs; verify the swatch and controls persist.
4. Adjust each texture control; switch repeat off and back on.
5. Compare Original/Mapped/Compare; move the divider.
6. Adjust blouse alignment and reset; verify the face remains visible.
7. Download the PNG while Compare or Original is selected; confirm the file contains the complete mapped blouse and model.
8. Check desktop and 390 px mobile widths for overflow and usable controls.
9. Open the customer fitting room; verify its original upload, consent, AI generation and credit flow are still present and no trial entry is visible.

Fabric files, rendered previews and crop state stay in browser memory until replacement, removal or page exit. They are not persisted to account storage.
