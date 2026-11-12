# Hosting WITNESS live for the judges

WITNESS is a small Node server (zero dependencies). It needs a host that runs
Node - GitHub Pages alone cannot run it (Pages is static-only; the Attack Lab
and the Testnet observer are API endpoints). Two-step plan:

## 1. Public repo (GitHub)

```bash
cd witness
git init && git add -A && git commit -m "WITNESS - mandate-bound AI payments on NEAR"
git branch -M main
git remote add origin https://github.com/<your-username>/witness.git
git push -u origin main
```

Once the repo is public, the logo has a permanent, never-expiring URL:

```
https://raw.githubusercontent.com/<your-username>/witness/main/app/assets/witness-logo.png
```

(CDN mirror: `https://cdn.jsdelivr.net/gh/<your-username>/witness@main/app/assets/witness-logo.png`)

## 2. Live demo (Render free tier - recommended)

1. render.com → New → Web Service → connect the GitHub repo.
2. Runtime: Node · Build command: *(none - no dependencies)* · Start command: `npm start`
3. Environment variable: `WITNESS_TESTNET_ACCOUNT` = `mujeebwajid-witness-vault.testnet`
4. Deploy. Your live URL is `https://<service>.onrender.com` - the home page,
   the Attack Lab, the observer and `/reviewer` all work there.

Alternatives with the same settings: Railway, Fly.io, or any VPS running
`WITNESS_TESTNET_ACCOUNT=mujeebwajid-witness-vault.testnet npm start`
(Node 20+; the server binds `PORT` if set, otherwise 4173).

## 3. Put both links in the submission

- Repository: the GitHub URL from step 1.
- Demo post on X: link the live Render URL and the `/reviewer` evidence page.
