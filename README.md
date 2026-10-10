# Centella Homes HOA Management (Admin App)

A desktop app for HOA administrators to manage homeowners, facility reservations, announcements, and income. Built with Electron, React, and Supabase.

> Capstone project

## Features

**Authentication**
- Admin registration in 3 steps, with an email verification code
- Login with saved session (stays logged in after restarting the app)
- Protected pages: users who are not logged in are sent to the login screen

**Overview**
- Stats cards, today's schedule, recent activity, and latest announcements

**Facilities Schedule**
- Calendar, reservations, and summary views
- Create and manage reservations from the schedule

**Facilities Reservation**
- Filter reservations by status (pending, approved, rejected, cancelled, completed)
- Import reservations from a CSV file
- Live updates with a notification sound when a new reservation comes in
- Notification dot in the sidebar for new reservations and registrations

**Homeowners**
- Search, filter, and pagination (table and card views)
- Register homeowners and review their uploaded ID photos
- Verify, reject, or archive homeowner accounts
- Export homeowner records to CSV

**Announcements**
- Rich-text editor (bold, colors, links, alignment)
- Image upload
- Draft, scheduled, published, and archived states
- Preview before publishing

**Income Tracker**
- Income computed from reservation payments
- Filter by period, with live updates
- Export formatted reports to Excel (.xlsx)

**Settings**
- Update profile, email, and password
- Notification and theme preferences

## Tech Stack

| Area | Technology |
| --- | --- |
| Desktop app | Electron 38 + Electron Forge |
| UI | React 19, React Router, CSS Modules |
| Build tool | Vite |
| Backend | Supabase (Auth, Database, Realtime, Storage) |
| Rich text | TipTap |
| Excel export | ExcelJS |
| Other | date-fns, Framer Motion, Lucide Icons, DOMPurify |

## Project Structure

```
src/
├── main.js            # Electron main process
├── preload.js         # Secure bridge to the renderer
├── assets/            # Icons, images, notification sounds
├── utils/             # Supabase client and helpers
└── renderer/
    ├── App.jsx        # Routes and layouts
    ├── auth/          # Login and Register
    ├── components/    # Sidebar and dashboard layout
    ├── pages/         # Overview, Facilities, Reservations,
    │                  # Homeowners, Announcements, Income
    └── services/      # Supabase data functions
```

## Requirements

- Node.js 18 or newer
- A Supabase project

## Setup

1. Clone and install:

   ```bash
   git clone https://github.com/xien-ica/Centella-Admin-App.git
   cd Centella-Admin-App
   npm install
   ```

2. Create a `.env` file in the project root:

   ```env
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-supabase-key
   ```

3. Prepare Supabase. The app expects:
   - Tables: `admin_accounts`, `admins`, `admin_preferences`, `residents`, `reservations`, `facilities`, `announcements`
   - Storage buckets: `user-ids`, `announcement-images`
   - Functions: `generate_admin_id`, `increment_views`
   - Realtime turned on for the reservations and residents tables

   The database schema is not included in this repo.

4. Run the app:

   ```bash
   npm start
   ```

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Run the app in development |
| `npm run package` | Package the app without an installer |
| `npm run make` | Build an installer for your OS |
| `npm run make:win` | Build the Windows installer |
| `npm run make:mac` | Build the macOS package |
| `npm run make:linux` | Build the Linux packages (.deb, .rpm) |
| `npm run lint` | Check the code for errors |

Builds are saved in the `out/` folder.

## Notes

- The window opens maximized, with a minimum size of 1600x900.
- Security: context isolation and sandbox are on, and Node integration is off.

## License

MIT
