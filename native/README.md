# Flexr phone shell

A thin Capacitor app that opens the deployed Flexr site and adds one thing the
web can't do: reading your step count from the phone.

- **Android** — Health Connect, so steps come from Samsung Health, Google Fit,
  Fitbit or the phone's own counter, whichever you already use.
- **iOS** — Apple Health.

The shell loads `https://flexr-ten.vercel.app`, so it's always the same version
as the website and there's nothing to re-publish when the app changes. Only a
change in this folder needs a new build.

## Build it (Android)

1. Install [Android Studio](https://developer.android.com/studio).
2. In this folder:

   ```bash
   npm install
   npx cap sync android
   npx cap open android
   ```

3. In Android Studio press Run with your phone connected (USB debugging on), or
   Build → Build APK to get a file you can copy to the phone.

To point a build at a different site: `FLEXR_URL=https://… npx cap sync android`.

## Build it (iOS)

Needs a Mac with Xcode and an Apple Developer account to install on a real
phone. `npm install && npx cap add ios && npx cap sync ios && npx cap open ios`.

## Steps permission

Android asks the first time you tap **Allow steps** on the Day tab. Flexr
requests `READ_STEPS` and nothing else. If Health Connect isn't installed the
app offers to set it up; on Android 14 and later it's part of the system.

Apple Health can't report whether permission was granted, so on iOS the app
simply tries to read and shows what it finds.

## Publishing

Nothing here is needed to use the app yourself — an APK installed directly
works. A Play Store listing needs a Play Console account (one-off $25) and a
privacy policy that mentions health data, because Health Connect access is
reviewed.
