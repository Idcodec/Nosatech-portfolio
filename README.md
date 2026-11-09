# Nosarhiemen Ekienabor — Portfolio

Portfolio site with a **Leave a message** form and a password-protected **Reply desk**.

- `/` is the portfolio. Visitors send a message and see your replies on the same page. Their conversation is remembered on their device with a private link token.
- `/admin` is the reply desk. Sign in with your admin password, read conversations and reply.

Built as plain HTML/CSS/JS with Vercel serverless functions and Redis for storage (Redis Cloud or Upstash, both from Vercel's Storage tab). No framework and no build step.

## Project structure

```
index.html            Portfolio page + contact form
admin.html            Reply desk (password protected)
styles.css            Shared styles (light + dark mode)
api/messages.js       POST: visitor sends a message
api/thread.js         GET: visitor reads their conversation
api/admin/threads.js  GET: list all conversations (admin)
api/admin/reply.js    POST: reply to a conversation (admin)
api/push.js           Visitor turns reply notifications on/off
api/admin/push.js     Owner turns new-message notifications on/off
api/_lib/store.js     Redis helpers, auth, rate limiting
api/_lib/push.js      Sends browser push notifications
sw.js, notify.js      Browser side of notifications
*.webmanifest, icons/ Lets the site be added to a phone's home screen
vercel.json           Clean URLs (/admin instead of /admin.html)
```

## Deploy (about 10 minutes)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Portfolio with message + reply desk"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```

2. **Import into Vercel**
   Go to vercel.com → **Add New → Project** → pick the repo → **Deploy**. Leave the framework preset as **Other**. There's no build command.

3. **Add storage**
   In the project, open the **Storage** tab → **Create Database** → choose **Redis** or **Upstash for Redis** (free plan) → connect it to the project. Either works. Redis adds `REDIS_URL`; Upstash adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`.

4. **Set the admin password**
   **Settings → Environment Variables** → add `ADMIN_PASSWORD` with a long password of your choice.

5. **Redeploy**
   **Deployments** → latest → **Redeploy**, so the new variables take effect.

Then open `https://<your-site>.vercel.app/admin` to reach the reply desk.

## Run locally

```bash
npm install
npm i -g vercel
vercel link        # connect to your Vercel project
vercel env pull    # downloads the env vars into .env.local
vercel dev         # http://localhost:3000
```

## Editing content

All portfolio text lives in `index.html`: the hero, services, stack and process sections. Colors and fonts are the tokens at the top of `styles.css`.

## Notifications

- **You:** open `/admin`, sign in, and click **Turn on notifications**. Do this on each device you want alerts on (laptop, phone). You'll get a notification for every new message, even with the tab closed.
- **Visitors:** after sending a message, they can click **Notify me** to get a notification when you reply.
- **iPhone / iPad:** Apple only allows web notifications for sites added to the Home Screen (iOS 16.4+). Open `/admin` in Safari → Share → **Add to Home Screen** → open **Reply Desk** from the home screen → sign in → **Turn on notifications**.
- Android, Windows, Mac and Linux work in Chrome, Edge and Firefox. Safari on Mac works too.
- No setup needed: the signing keys are created automatically on first use and stored in your database.
- The browser tab title also shows a count, like "(2) Reply Desk", whenever there are unanswered messages.

## Notes

- Visitors don't need an account. A conversation is tied to the browser that started it. If they clear their browser data or switch devices, they'll start a new conversation. Asking for an email gives you a fallback way to reach them.
- There's basic spam protection: a hidden honeypot field, and a limit of 8 messages per IP every 10 minutes. Wrong admin passwords are also rate limited.
- Privacy: each conversation can only be opened with a secret key stored in that visitor's browser. Visitors can't see each other's conversations, and `/admin` needs your password.
