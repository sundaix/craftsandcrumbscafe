# Crafts & Crumbs

A Firebase-powered ordering platform for a café that also sells handmade merch. It's three apps sharing one backend: a **customer storefront**, an **admin dashboard**, and a **rider app** — all backed by Firestore for data and Firebase Auth for role-based access.

**Live site:** https://craftsandcrumbs.vercel.app

## Apps

| App | URL | Access |
|---|---|---|
| Customer storefront | `/` | Public |
| Admin dashboard | `/admin` | `role: "admin"` accounts only |
| Rider app | `/rider` | `role: "rider"` accounts only |

Admin and rider accounts are regular Firebase Auth users whose Firestore `users/{uid}` document has `role` set accordingly — there's no separate signup flow for staff; roles are assigned from the Admin dashboard's Accounts tab.

## Features

**Customer storefront**
- Browse drinks, pastries, and merch by category, with search and sorting
- Variable pricing by size and customizable options (e.g. drink add-ons), with live price/calorie recalculation
- Cart, wishlist, and saved delivery addresses (with map-based address picking via Leaflet)
- Guest checkout (anonymous auth) or full account with email OTP verification
- Cash, QR Ph, and Credit/Debit Card payments via PayMongo
- Product reviews with purchase verification
- Combo/bundle deals, promo popups, and a "popular items" carousel — all configurable from the admin dashboard

**Admin dashboard**
- Overview analytics (revenue trends, order status breakdown, top products) via Chart.js
- Product management with a dynamic size/price and option-group builder, and image upload
- Order management: sortable/filterable table, staleness detection, detail view
- Account management (assign roles, disable accounts)
- Settings: delivery fee, promo popup, popular section, combos

**Rider app**
- View and claim available deliveries
- Track "my deliveries" and delivery history
- One-tap links to Maps, call, and SMS the customer
- Proof-of-delivery capture

## Tech stack

- **Frontend:** HTML, CSS, vanilla JS + jQuery, Bootstrap 5, Leaflet (maps), Chart.js (admin analytics)
- **Backend:** Firebase Auth, Firestore
- **Payments:** PayMongo (QR Ph, Card) via Vercel serverless functions
- **Images:** Cloudinary (client-side upload, center-cropped to 1000×1000)
- **Email:** EmailJS (OTP codes, order confirmations)
- **Hosting:** Vercel (static site + `/api` serverless functions)

## Project structure

```
├── index.html              # Customer storefront
├── script.js                # Storefront logic
├── style.css
├── admin/
│   └── index.html            # Admin dashboard
├── admin.js                  # Admin dashboard logic
├── admin.css
├── admin-boot.js             # Admin auth gate + initial load
├── admin-ui.js                # Shared toast/confirm dialog UI
├── rider/
│   ├── index.html             # Rider app
│   ├── rider.js
│   ├── rider-boot.js
│   └── rider.css
├── shared-catalog.js         # Catalog/pricing helpers shared by storefront + admin
├── *-service.js               # Firestore CRUD wrappers (one per collection):
│   accounts, addresses, cart, categories, combos, orders,
│   products, review, settings, wishlist
├── auth.js                   # Auth, roles, OTP email verification
├── firebase-config.js        # Firebase SDK init
├── image-upload-service.js   # Cloudinary upload
├── email-notifications.js    # EmailJS wrapper
├── firestore.rules           # Firestore security rules
├── api/
│   ├── paymongo/
│   │   ├── create-checkout-session.js
│   │   └── verify-payment.js
│   └── _lib/
│       └── firebaseAdmin.js  # Firebase Admin SDK init
├── firebase.json
└── package.json
```

## Setup

1. **Firebase**
   - Create a Firebase project, enable **Authentication** (Email/Password + Anonymous providers) and **Firestore**.
   - Paste your config into `firebase-config.js`.
   - Deploy `firestore.rules` to Firestore.
   - Set the first admin account manually by editing that user's `users/{uid}` document in the Firestore console (`role: "admin"`) — every other admin/rider can then be created from the dashboard.

2. **Cloudinary** (image uploads)
   - Create a free account at [cloudinary.com](https://cloudinary.com).
   - Add an **unsigned** upload preset (Settings → Upload → Upload presets).
   - Set `CLOUDINARY_CLOUD_NAME` and `CLOUDINARY_UPLOAD_PRESET` in `image-upload-service.js`.

3. **EmailJS** (OTP + order confirmation emails)
   - Set up a service and templates at [emailjs.com](https://emailjs.com).
   - Set the public key, service ID, and template IDs in `email-notifications.js`.

4. **PayMongo** (payments)
   - Get your secret key from the PayMongo dashboard (Developers → API Keys).
   - In Vercel, set the environment variables:
     - `PAYMONGO_SECRET_KEY`
     - `FIREBASE_SERVICE_ACCOUNT_KEY` (a Firebase service account JSON, stringified)

5. **Deploy**
   - Static files deploy as-is; `/api` deploys as Vercel serverless functions.
   - `package.json` exists only so Vercel installs `firebase-admin` for those functions.

## Notes

- Guest checkout requires the **Anonymous** sign-in provider to be enabled in Firebase Auth — order creation requires `request.auth != null`, so anonymous auth is what lets a guest place an order without registering.
- OTP verification runs client-side (compared against a code stored on the user's own Firestore document) since there's no custom backend for it — it stops typos and casual mistakes but isn't tamper-proof against someone inspecting their own devtools.
