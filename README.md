# Centella Admin App

Desktop app (Electron + React) for Homeowners Association (HOA) administrators. It handles homeowners, facility reservations, announcements and income reporting, backed by Supabase.

[![Build & Release](https://github.com/xien-ica/Centella-Admin-App/actions/workflows/release.yml/badge.svg)](https://github.com/xien-ica/Centella-Admin-App/actions/workflows/release.yml)

## Features

- **Authentication**: admin login and registration (Supabase Auth, with an admin verification code Edge Function).
- **Overview**: dashboard summary of HOA activity.
- **Facilities Schedule**: manage facilities and their schedules.
- **Homeowners**: browse and search homeowners.
- **Announcements**: create, publish, draft, archive and batch-manage announcements.
- **Reservations**: review and manage facility reservations.
- **Income**:
  - Summary cards for total income, monthly income and pending payments.
  - Transaction table with pagination and skeleton loading.
  - **Filters**: payment status (Paid, Pending, Cancelled, Refunded) and date range, with quick date presets. Changes only apply when you press *Apply filters*.
  - **Export report as PDF (default) or Excel (.xlsx)** for any date range:
    - PDF: branded header, summary cards, summary table, transaction table and page numbers.
    - Excel: styled report with summary cards, color-coded statuses, column filters and print-ready layout.
    - Cancelled and refunded transactions are listed but excluded from the report total.

## Tech stack

| Area | Tools |
| --- | --- |
| Desktop shell | Electron, Electron Forge (Squirrel installer for Windows) |
| UI | React, React Router (`HashRouter`), CSS Modules, Ionicons |
| Build | Vite |
| Backend | Supabase (database, auth, Edge Functions) |
| Reports | ExcelJS, jsPDF, jspdf-autotable |
| Integrations | Resend (email), PayMongo (payments, test mode), Firebase Cloud Messaging (push notifications) |

## Project structure

```
Centella-Admin-App/
├── src/
│   ├── main.js              # Electron main process
│   ├── preload.js           # Preload script
│   ├── renderer.js
│   ├── utils/
│   └── renderer/            # React app
│       ├── App.jsx          # Routes, auth guards, dashboard layout
│       ├── main.jsx         # React entry point
│       ├── auth/            # Login, Register
│       ├── components/      # Shared UI (Sidebar, Dashboard layout, ...)
│       ├── loadingScreen/
│       ├── pages/           # Overview, FacilitiesSchedule, Homeowners,
│       │                    # Announcement, Reservations, Income
│       ├── services/        # Supabase / data access
│       └── utils/           # AuthContext, helpers
├── supabase/                # Supabase config and Edge Functions
├── .github/workflows/       # CI: Windows build and GitHub Release
├── forge.config.js
└── vite.*.config.mjs
```

The Income page is organized as `Income.jsx` plus `hooks/` (`useIncome`, `useFilters`, `usePagination`), `components/` (stats cards, table, filter and export modals, pagination), `utils/` (`export.js`, `filters.js`) and `styles/`.

## Getting started

### Requirements

- **Node.js 22.13 or newer** (required by Electron Forge)
- npm
- A Supabase project

### Install

```bash
git clone https://github.com/xien-ica/Centella-Admin-App.git
cd Centella-Admin-App
npm install
```

### Supabase setup

The app uses the Supabase client library with React + Vite.

1. **Install the package** (already listed in `package.json`, so `npm install` covers it):

   ```bash
   npm install @supabase/supabase-js
   ```

2. **Get your project keys.** In the Supabase dashboard, click **Connect** at the top of your project, then choose **Framework → React → Vite**. Copy the project URL and the publishable key.

3. **Create a `.env` file** in the project root (it is gitignored, so it is never committed):

   ```env
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
   ```

4. **Create the client** (one shared instance, for example in `src/renderer/services/supabase.js`):

   ```js
   import { createClient } from "@supabase/supabase-js"

   export const supabase = createClient(
     import.meta.env.VITE_SUPABASE_URL,
     import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
   )
   ```

5. Use it anywhere in the app:

   ```js
   import { supabase } from "../services/supabase"

   const { data, error } = await supabase.from("reservations").select("*")
   ```

Variables must start with `VITE_` to be available in the renderer. Restart the dev server after editing `.env`.

Only use the **publishable** (public) key in the app. Never put a secret or `service_role` key in the client or commit it. Row Level Security (RLS) policies in Supabase protect your data, so keep them enabled.

### Run in development

```bash
npm start
```

## Building

### Windows installer

```bash
npm run make:win
```

The installer is created in `out/make/squirrel.windows/x64/` (`Setup.exe`, a `.nupkg` and `RELEASES`). The unpacked app is in `out/centella-hoa-win32-x64/`.

**Known issue (Squirrel / `7z.exe`):** if the build fails with *"The system cannot find the file specified"*, copy the x64 7-Zip files from `node_modules/electron-winstaller/vendor`:

```powershell
cd node_modules\electron-winstaller\vendor
copy 7z-x64.exe 7z.exe
copy 7z-x64.dll 7z.dll
cd ..\..\..
npm run make:win
```

The release workflow applies this fix automatically.

## Releases

Releases are built by GitHub Actions (`.github/workflows/release.yml`) on a Windows runner.

1. Set `"version"` in `package.json` (for example `1.0.1`).
2. Commit and push your changes.
3. Create and push a matching tag:

   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

4. The workflow builds the installer and attaches `Setup.exe`, the `.nupkg` and `RELEASES` to a new GitHub Release.

You can also run the workflow manually from the **Actions** tab. That only produces a downloadable build artifact and does not create a Release.

If the app needs environment variables at build time, add them under **Settings → Secrets and variables → Actions** and reference them in the workflow's build step.

## Supabase Edge Functions & integrations

Edge Functions live in `supabase/functions/` and talk to third-party services. These keys are **secrets**: they are stored in Supabase, used only inside Edge Functions, and never go in the app's `.env` or the client code.

| Service | Used for | Secrets |
| --- | --- | --- |
| [Resend](https://resend.com) | Sending emails (for example verification codes) | `RESEND_API_KEY` |
| [PayMongo](https://www.paymongo.com) | Payments (test/simulation mode) and payment webhooks | `PAYMONGO_SECRET_KEY`, `PAYMONGO_PUBLIC_KEY`, `PAYMONGO_WEBHOOK_SECRET` |
| [Firebase Cloud Messaging](https://firebase.google.com) | Push notifications | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |
| App config | Deep link scheme used in redirects | `APP_SCHEME` |

### Set the secrets

In the Supabase dashboard go to **Edge Functions → Secrets**, or use the CLI:

```bash
npx supabase secrets set RESEND_API_KEY=<value>
npx supabase secrets set PAYMONGO_SECRET_KEY=<value> PAYMONGO_PUBLIC_KEY=<value> PAYMONGO_WEBHOOK_SECRET=<value>
npx supabase secrets set FIREBASE_PROJECT_ID=<value> FIREBASE_CLIENT_EMAIL=<value>
npx supabase secrets set APP_SCHEME=<value>
```

For `FIREBASE_PRIVATE_KEY`, use the dashboard or load it from a file so the line breaks in the key are kept. List what is set (names only) with `npx supabase secrets list`.

### Deploy a function

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase functions deploy <function-name>
```

### Notes

- **PayMongo** is used in test mode (simulated payments). Use the `sk_test_` / `pk_test_` keys. Switching to live payments means replacing them with live keys and updating the webhook secret.
- Point the PayMongo webhook at your deployed payment-webhook function URL, and keep `PAYMONGO_WEBHOOK_SECRET` in sync with the one PayMongo gives you.
- Never commit these values. If one is exposed, rotate it in the service's dashboard and update the Supabase secret.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `Electron Forge requires Node.js >= 22.13.0` | Upgrade Node (`node -v` to check). |
| Squirrel error "cannot find the file specified" | Apply the `7z.exe` fix above. |
| `git push` rejected (fetch first) | Run `git pull --rebase`, then push again. |
| PDF shows `PHP` instead of `₱` | The built-in PDF fonts lack the peso glyph. Embed a `.ttf` font in jsPDF to show `₱`. |

## License

Add a license of your choice (for example MIT) in a `LICENSE` file and mention it here.
