# Mardan Eye Clinic

A static patient-information website for Mardan Eye Clinic. Patients can contact the clinic by phone or WhatsApp to arrange a visit. There is no online booking, patient portal, staff dashboard, API, or database in this codebase.

## Local development

Use Node.js 24 and pnpm 10.28.2.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://127.0.0.1:4321. Run `pnpm typecheck` and `pnpm build` to check the site.

## Content and deployment

Clinic contact information is in `apps/website/src/lib/catalog.ts` and the appointment page. Doctor listings, fees, hours and the street address require clinic confirmation before publishing. Illustrative photographs are credited on the site.

`apps/website/wrangler.jsonc` configures the static Cloudflare Worker for `mardaneyeclinic.com`. A production deployment requires explicit authorization; building or pushing a branch does not deploy it.
