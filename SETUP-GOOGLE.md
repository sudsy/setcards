# Setting up Google Drive for Setcards

This lets bands keep their songs in a shared Google Drive folder. You do this once for your copy of the app (for example your GitHub Pages site). It is free, and you never see or store anyone's files: each person signs in with their own Google account and the app talks straight to their Drive.

You need the web address where the app is hosted, for example `https://sudsy.github.io`. For testing on your own computer, also use `http://localhost:8000`.

## 1. Create a Google Cloud project

1. Go to <https://console.cloud.google.com/> and sign in.
2. Use the project picker at the top to create a new project, for example "Setcards".
3. Note the **project number** shown on the project's dashboard.

## 2. Turn on the APIs

In "APIs & Services", then "Library", turn on:

- **Google Drive API**
- **Google Picker API**

## 3. Set up the sign-in screen

1. Open "Google Auth Platform" (or "OAuth consent screen" in older consoles).
2. Choose **External** for the audience.
3. Fill in the app name (Setcards), a support email and a developer contact email.
4. Under "Data access" (or "Scopes"), add `https://www.googleapis.com/auth/drive.file`. This is the narrowest Drive permission: Setcards can only see files it created or that a person picks for it.
5. Leave the app in **Testing** and add each bandmate's Google account under "Test users" (up to 100 people).

While in testing, people see a "Google hasn't verified this app" notice the first time they sign in. That is expected. To remove it for the public, submit the app for verification later. Because Setcards only uses `drive.file`, that review is the lighter "brand verification", not a paid security audit.

## 4. Create the sign-in client ID

1. Go to "Clients" (or "Credentials", then "Create credentials", then "OAuth client ID").
2. Choose **Web application**.
3. Under **Authorised JavaScript origins**, add your hosting address, for example `https://sudsy.github.io`, and `http://localhost:8000` for testing. Use the origin only, without the repository path.
4. Create it and copy the **Client ID** (it ends in `.apps.googleusercontent.com`).

## 5. Create an API key for the file picker

1. In "Credentials", choose "Create credentials", then "API key".
2. Restrict it: under "Application restrictions" choose "Websites" and add your hosting address. Under "API restrictions" allow only the Google Picker API.

## 6. Put the values in `config.js`

```js
window.SETCARDS_CONFIG = {
  google: {
    clientId: '1234567890-abc.apps.googleusercontent.com',
    apiKey: 'AIza…',
    appId: '1234567890'   // the project number
  }
};
```

Commit and push. These values identify the app to Google and are meant to be public. They do not give anyone access to files.

Someone running their own copy without editing `config.js` can also paste their own values into the Songs screen, under "I have a Google client ID". They are saved in that browser only.

## Using it with a band

1. One person opens Setcards, goes to Songs, and taps **Create a new one** (or **Connect band folder** to pick an existing folder).
2. In Google Drive, share that folder with the bandmates (Editor access lets them add songs and save chords).
3. Each bandmate opens Setcards, taps **Connect band folder**, and picks the shared folder. It appears under "Shared with me" in the picker.
4. Songs added through Setcards are visible to everyone straight away. If someone drops a Guitar Pro file straight into the Drive folder, other people tap **Give Setcards access** once and pick it. That step comes from the `drive.file` permission, which keeps Setcards from seeing anything else in anyone's Drive.
