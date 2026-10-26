# Aarini AI Fashion Studio — private admin experiment

## Implementation status

The three workflow interfaces and backend orchestration are implemented at `/crm/fashion-studio`. **This is not a completed or production-validated three-model AI system.** No customer-facing page, checkout, product management, existing authentication flow or existing remote try-on service has been replaced.

| Workflow | Implemented | Live AI verification on 26 October 2026 | Remaining dependency |
| --- | --- | --- | --- |
| Blouse reference | Reference/customer uploads; flat-lay and model-worn modes; hosted FASHN transfer; preview, comparison, download and evaluation log | Two real flat-lay jobs completed with a synthetic adult model and an AI-made blouse reference. Output was 576 × 864 PNG. | Wider identity/design testing; screenshot detection/segmentation; different poses/people and partially hidden garments |
| Fabric-to-blouse | Seven style directions; four sequential generated concepts; selected-concept binding; follow-up FASHN transfer | Original and newer official Qwen demo attempts returned no image. Official client confirmed exhausted ZeroGPU quota. No replacement images were inserted. | Authorized inference quota or a reviewed endpoint; four real concept outputs and complete concept→try-on quality tests |
| Saree & blouse | Saree upload; four matching blouse directions; independent matching-concept jobs; separate final saree service contract | Final draping correctly blocked with `SAREE_PIPELINE_REQUIRED`. Mock contract tests cover all three separate input images, not actual draping. | Licensed saree-specific endpoint, matching-concept inference quota and complete drape/identity/pallu evaluation |

Generic catalogue inspiration is a newly AI-created style board. It is explicitly labelled and is **not** a product photograph, a licensed third-party photograph, or an inference result derived from an uploaded swatch. The preview area never substitutes it for AI output. The synthetic test person is a test input, not a try-on result. Successful live output and reports are saved in ignored `.local/fashion-live/` during development.

Visual inspection of the successful reference example: burgundy colour, wide neckline and gold sleeve decoration were recognizable. The face remained visually recognizable, but the waistband and exposed waist changed; sleeve/embroidery details need closer review. No numerical identity similarity or exact pattern accuracy has been established. These are unblinded observations on synthetic fixtures, not a measured quality benchmark.

## Existing-project analysis and implementation order

The project uses Next.js App Router, React 19 and TypeScript, with Vinext local development and a native Next production build. Vercel hosts Node route handlers; PostgreSQL/Neon is accessed through the existing pooled adapter. Local offline development can use its existing SQLite adapter. Admin and customer sessions are separate HttpOnly cookies verified by `getAuthUser`. The original fitting room uses `app/image-upload.tsx` and an existing hosted FASHN integration in `lib/local/try-on.ts`. The manual Canvas prototype remains at `/crm/fabric-trial`.

Work was organized as: inspect existing architecture → isolated gated UI → validated temporary uploads → persistent job controller/provider adapters → each of the three workflow paths → comparison/export/evaluation UI → isolated tests and live provider probes → Vercel preparation. Independent paths were implemented despite unavailable inference dependencies.

## Module map

| Module | Responsibility |
| --- | --- |
| `app/fashion-studio/model.ts` | Workflow types, seven design definitions, four matching blouse directions, bounded design prompts |
| `app/fashion-studio/studio.tsx` and `studio.css` | Scoped premium three-tab interface, source previews, selection, progress, before/after, downloads and manual evaluation |
| `lib/fashion-studio/access.ts` | Server-only flag, existing admin authentication and bounded daily limit |
| `ImageUploadService` in `images.ts` | Actual-byte validation, orientation, resampling, metadata removal and temporary storage |
| `ImageAnalysisService`, `FabricAnalysisService`, `SareeAnalysisService` | Honest local palette inspection only; remote AI analysis is separately gated |
| `GarmentSegmentationService` in `jobs.ts` | Requires a completed, source-bound reviewed segmentation result for screenshots |
| `BlouseDesignService` in `jobs.ts` | Validates four distinct requested concepts and source/selection binding |
| `VirtualTryOnService` in `jobs.ts` | Garment compatibility and explicit saree-specific gate |
| `AIJobStatusService` in `jobs.ts` | Persistent queued/submitting/completed/failed/cancelled state, leases and short provider polls |
| `ResultExportService` in `images.ts` | Decodes actual provider bytes and exports PNG |
| `providers.ts` | Fixed official Hugging Face demo adapters and reviewed asynchronous gateway adapter |
| `store.ts` | Encrypted expiring images, atomic quota/idempotency, ownership and job records |
| `app/api/fashion-studio/**` | Admin-only capabilities, uploads, assets, jobs, evaluation and authenticated cleanup |

## Model/endpoint evaluation

Verified against primary model cards and live public API descriptions. Availability is a point-in-time observation, not an uptime guarantee. Licensing below is the published model licence; review dependencies and service terms before commercial release.

| Candidate | Licence and inputs | Hardware / endpoint / cost findings | Decision |
| --- | --- | --- | --- |
| [FASHN VTON 1.5](https://huggingface.co/fashn-ai/fashn-vton-1.5) | Apache-2.0 main weights. Person plus model-worn or flat-lay garment; `tops`, `bottoms`, `one-pieces` | Card reports ~8 GB GPU memory and 576×864 output. Official Space `/try_on` was reachable and returned two real outputs. Card explicitly says no standard Inference Provider deployment. Hosted demo has quotas and no production guarantee. | Fixed official demo, `tops`, segmentation-free mode, admin opt-in only. No saree accuracy claim. |
| [CatVTON](https://huggingface.co/zhengchong/CatVTON) | CC BY-NC-SA 4.0; person/garment plus model-specific preprocessing | Authors document under 8 GB VRAM. A Space is not a commercial inference licence or SLA. | Rejected for boutique integration without separate commercial permission. |
| [IDM-VTON](https://huggingface.co/yisol/IDM-VTON) | CC BY-NC-SA 4.0; clothing/person/mask inputs | GPU pipeline; no standard Inference Provider deployment shown. No reliable free commercial endpoint established. | Rejected for boutique integration without separate permission. |
| [Qwen Image Edit 2511](https://huggingface.co/Qwen/Qwen-Image-Edit-2511) | Apache-2.0; image-list plus edit prompt | Official Space `/infer` accepts a Gallery input and returns a Gallery. Actual schema was checked. CUDA model; our minimum VRAM requirement has not been benchmarked. Free Space quota was exhausted; API availability did not mean successful inference. Prompt rewriting is disabled to avoid the demo's separate DashScope rewriter. | Connected for admin concept experiments; no claim of four successful designs yet. |
| [Qwen2.5-VL-7B](https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct) | Apache-2.0 image understanding candidate | Requires a compatible multimodal serving endpoint. No endpoint/token has been supplied; GPU sizing has not been measured here. | Candidate for a reviewed analysis service; not falsely advertised as connected. |
| [SAM 2](https://huggingface.co/facebook/sam2-hiera-large) | Apache-2.0 promptable masks | Needs points/boxes or a detection stage to identify a blouse. A general mask is not semantic garment detection. No hosted endpoint configured. | Candidate for reviewed segmentation, not integrated as pretend automatic blouse detection. |
| [FASHN Human Parser](https://huggingface.co/fashn-ai/fashn-human-parser) | Its own NVIDIA SegFormer licence, **not simply Apache-2.0** | Has garment classes and different terms. The [FASHN pipeline](https://github.com/fashn-AI/fashn-vton-1.5/blob/main/src/fashn_vton/pipeline.py) also invokes parsing internally, even with maskless output. | No separate segmentation endpoint enabled. Full dependency/service licence review remains required before commercial release; current integration stays an unreleased admin trial. |
| Saree-specific model | No suitable reviewed endpoint supplied or verified | Blouse/top transfer is insufficient evidence of saree draping support. Fixed-pose saree research and general image editing do not establish customer-specific drape/pallu preservation. | Final saree inference blocked. |

[Hugging Face dedicated endpoints are charged for provisioned compute](https://huggingface.co/docs/inference-endpoints/pricing); they are not assumed free because weights are downloadable. No paid endpoint, GPU server, subscription, local model or paid API was started. Public demo inference was the only live inference path used.

## Persistence, privacy and execution

- All studio pages and APIs verify **existing admin sessions** on the server. Customer cookies, forged role cookies and knowledge of image/job IDs do not grant access.
- `AI_FASHION_STUDIO_ENABLED` defaults to `false`. Even an enabled studio is not a customer feature. Only admins get its link in the existing fitting room.
- Two additive experimental tables are initialized on first authorized use: `aarini_fashion_studio.jobs` and `.assets` in the **existing PostgreSQL database**. Existing tables/schemas are not altered or replaced. Offline tests use separate `fashion_studio_*` tables through the existing SQLite adapter.
- Upload requests accept one JPG/PNG/WebP under 3 MB, below Vercel's 4.5 MB request cap. Actual decoding, dimensions (64 px minimum, 25 MP maximum), metadata removal and orientation happen server-side. Original filenames and EXIF are not retained.
- Images are AES-256-GCM encrypted with a server-side key. Each asset has an enforced 20-minute access expiry and is scoped to the uploading admin. At most 40 temporary images per admin are accepted.
- Expiry blocks reads immediately. Ciphertext is physically removed on subsequent studio activity and by the configured daily cleanup schedule; **20-minute access expiry does not guarantee deletion of database bytes at exactly 20 minutes**. Configure `CRON_SECRET` for scheduled purging. Remote provider retention is independent and cannot be guaranteed by this app.
- The UI includes individual remove and delete-all controls. Delete-all stops tracking active jobs before deleting images. A cancelled job cannot repopulate personal results after that deletion. Public demos may still finish upstream; the UI states this limitation.
- Daily units are per admin and reset at 00:00 UTC. A four-concept batch reserves 4 units, analysis/try-on 1. Failed submissions still count as attempts; actual provider spend cannot be refunded by our counter. Reservations and duplicate keys are atomic. These are separate experimental counters, not customer paid credits.
- Jobs persist upstream event IDs and metadata rather than relying on in-memory background tasks. The browser requests short, authenticated progress steps. No request keeps a GPU model running inside Vercel. Leaving the page pauses polling; reopening the studio resumes tracking. Submissions interrupted before acknowledgement are not blindly duplicated.
- Jobs time out after 12 minutes; short provider requests have their own deadlines. Terminal states, error codes and elapsed time are recorded. An upstream quota/error with no image stays failed, never “successful”.
- Metadata and human evaluation scores/notes are retained for up to 30 days and purged by cleanup. The UI asks reviewers not to put personal information in notes. Technical completion rate is explicitly distinct from identity or garment quality.

## Local testing

The ignored local environment enables the studio and public demos for admin testing. It has its own random image key and a 24-unit test limit. Nothing was enabled on the live Vercel deployment.

Open `/crm/fashion-studio` after signing into the existing CRM. For a clean blouse reference, choose the actual source type. Screenshots need completed source-bound AI segmentation; simply choosing “isolated garment” does not make a screenshot suitable. For fabric/saree concepts, select exactly four directions, upload a reference and consent, then generate. Only actual returned concept images become selectable for try-on.

Automated checks:

The final implementation passed all **58 automated tests**, the production build (including TypeScript), and the local-production access/ownership/cleanup/flag-off integration checks. Browser checks at 390 px and 1280 px showed no document overflow; the mobile catalogue scrolls independently. Three-tab navigation, source upload previews, category filters and the native large-image dialog (including Escape/focus return) were verified. These software checks do not resolve the live-model limitations in the status table.

```text
npm test
npx tsc --noEmit
npm run build
npm run test:fashion-access
```

The isolated tests use synthetic PNGs and mock provider responses to verify application behavior, not to claim AI output quality. They cover all three job state machines, both roles, forged cookies, image ownership/encryption/expiry, actual formats/orientation, idempotency/quotas, cancellation races, screenshots/raw swatch rejection, selected-concept binding, separate saree/person/blouse inputs and failure-with-no-result handling. The access script uses temporary accounts and no inference, then removes only its own fixtures. Recovery after interruption: `node scripts/verify-fashion-access.mjs --cleanup`.

`scripts/inspect-fashion-models.mjs` checks public interfaces without images. `scripts/verify-fashion-live.mjs` performs real inference using only the synthetic fixtures; it can consume hosted quota. `scripts/verify-qwen-client.mjs` cross-checks the design endpoint with the official client. Do not run these with personal photographs or assume a free demo will remain available. Local fixtures/results under `.local/` are not production assets.

### Required quality matrix before considering a module complete

| Case | Current result |
| --- | --- |
| Isolated blouse + synthetic customer | Real inference succeeded twice; limited visual inspection only |
| Model-worn blouse; another customer; altered pose | Supported model input contract, not yet live-verified in this project |
| Instagram/Pinterest screenshot; partially hidden blouse | Blocked without reviewed detection/segmentation; no hidden detail invented |
| Plain / printed / embroidered / bordered fabric concepts | Upload/preprocessing supported. Printed-swatch inference attempted and failed; full four-design quality matrix remains blocked by quota |
| Selected generated concept → customer try-on | Contract/selection tests pass; live test not reached because no concept returned |
| Plain / printed / silk / bordered / detailed-pallu saree | Final inference not run; no suitable saree-specific endpoint |

For every real result, review identity, skin tone, proportions, colour, motif/embroidery continuity, neckline, sleeves and alignment; for sarees also score drape, border and pallu. Save human scores in **Evaluate quality** (0 means not evaluated). Record failures and partial batches; never infer quantitative identity accuracy from a recognizable face.

## Reviewed gateway contract

This is an implemented **adapter contract**, not a supplied or trained GPU model. A separately operated service must implement and validate it. A standard Hugging Face model URL does not automatically satisfy it; [custom handlers/containers are distinct serving implementations](https://huggingface.co/docs/inference-endpoints/guides/custom_handler).

Set `AI_STUDIO_GATEWAY_URL` to a fixed HTTPS origin ending in `.hf.space` or `.endpoints.huggingface.cloud` and explicitly set `AI_STUDIO_GATEWAY_APPROVED=true`. Use a scoped server-only `HF_TOKEN` for access. Redirects/user-supplied URLs are rejected. Prefer disabling public demos when switching to an owned gateway. For final saree work, also set `AI_STUDIO_SAREE_REVIEWED=true` **after** licence/capability review and independent quality testing.

`GET /studio/capabilities` returns:

```json
{"protocol":1,"commercialUseReviewed":true,"reference":true,"concepts":true,"analysis":true,"segmentation":true,"sareeSpecific":false}
```

Only set capabilities actually supported and licensed. `POST /studio/jobs` receives an idempotency key, module, action, source kind, design ID, normalized PNG reference data URL, optional person data URL and (for saree transfer) a **separate selected blouse** data URL. Return `{"id":"opaque-id"}` quickly. `GET /studio/jobs/opaque-id` returns `queued`, `running`, `failed`, or:

```json
{"status":"completed","image":"data:image/png;base64,..."}
```

For analysis return `analysis` with `summary`, `features` (neckline/sleeves/pattern/embroidery/border/pallu/visibility), `uncertainties`, and `supported`. An optional `segmented` PNG data URL must contain a usable prepared garment image, not a mask presented as an outfit. Hidden/ambiguous garments should set `supported:false`. `POST /studio/jobs/opaque-id/cancel` requests upstream cancellation. Apply provider-side temporary storage TTL, no sensitive logging, bounded payloads and validated model licence rules there too.

## Vercel deployment preparation

The production build uses the existing Next deployment. No GPU/torch dependencies were added to Vercel. New route handlers use Node.js and a bounded 60-second maximum; inference continues in the hosted provider between requests. Existing deployment origin validation and Neon connection remain in use.

Before an **admin-only** deployment:

1. Keep `AI_FASHION_STUDIO_ENABLED=false` for the first deployment if it must remain hidden; it is safe to ship disabled code.
2. Configure a random 64-hex-character `AI_STUDIO_IMAGE_KEY` and keep it stable while temporary images exist. Never prefix it or `HF_TOKEN` with `NEXT_PUBLIC_`.
3. Configure `AI_STUDIO_DAILY_LIMIT` (default 8), optional scoped `HF_TOKEN`, and explicitly decide whether `AI_STUDIO_ALLOW_DEMOS=true` is appropriate for synthetic admin tests. It is false by default.
4. Configure `CRON_SECRET` for the daily cleanup route. `vercel.json` includes `17 3 * * *` (03:17 UTC / 08:47 IST). Confirm the deployed schedule and run a cleanup request before enabling uploads.
5. The existing database owner needs permission to initialize the isolated experimental schema/tables. Provision only that namespace; do not migrate or replace existing commerce/auth tables.
6. Enable the studio flag only after verifying actual admin exclusion, image expiry/ownership, quota/error behavior and the model/dependency licences. This does not enable customer access.
7. Verify the deployment with a test admin, test customer and signed-out browser. Run the full quality matrix with permissioned test inputs before considering any customer release.

No GitHub push or Vercel release was performed as part of this task.
