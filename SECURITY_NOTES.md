# Security Notes

- **Cloudflare Access** should protect who can reach the app URL.
- **Firebase Auth** (to be added later) should protect user identity.
- **Firestore Security Rules** (to be added later) must protect actual data access.
- `VITE_FIREBASE_*` configuration values in frontend env vars are **not secrets** and are not sufficient security by themselves.
- Never place private Firebase service account keys or admin credentials in frontend code.
