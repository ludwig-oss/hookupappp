# Hookup mobile

Isolated React Native app (Expo) for Android and iOS. It does not import the web client. It calls the same backend.

Default API: `https://hookupappp.onrender.com`

Override it by setting `EXPO_PUBLIC_API_URL` (no trailing slash), for example `http://10.0.2.2:3001` from an Android emulator.

```bash
cd mobile-version
npm start
```

Then open the project in Expo Go (`npm run android` or `npm run ios`). iOS builds still need macOS; Expo Go on a phone is enough to run it.

Sign in with the same username and password as the website. Session state mirrors the web app: JWT in memory, optional stay-signed-in storage, profile refresh from `GET /api/profile/me`, and a 401 ends the session.
