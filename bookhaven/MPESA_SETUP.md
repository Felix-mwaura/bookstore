# Live M-Pesa: setup guide

Everything M-Pesa needs is set in two places — **Safaricom's Daraja portal** (where
the values come from) and **Vercel** (where they are stored). No code changes,
no database changes beyond the delivery-rate migration that is already applied.

Read §0 first: it records what this deployment already has, so you only redo
what is actually missing.

---

## 0. The five-minute version

| Step | Where | What |
| --- | --- | --- |
| 1 | Daraja portal → My Apps → your app | Copy Consumer Key, Consumer Secret, Passkey, Short Code |
| 2 | Vercel → Settings → Environment Variables (Production) | Store all four, plus `MPESA_ENV=production` |
| 3 | Vercel → Deployments → ⋯ → **Redeploy** | Env changes do not reach an existing build |
| 4 | `https://bookstore-puce-sigma.vercel.app/api/mpesa/status` | Must say `{"enabled":true,"environment":"production"}` |
| 5 | Admin → Payments | Test runs by itself; read the two lines in §4 |
| 6 | Place one real order with your own phone | Confirms the whole chain end to end |

---

## 1. Where each value comes from

Log in at <https://developer.safaricom.co.ke> → **My Apps** → **Production Apps**
→ your app. The card shows five things worth copying:

```
Consumer Key      <40-ish characters>
Consumer Secret   <40-ish characters>
Passkey           <long base64 string>
Short Code        7 digits for a till, 6 for a paybill
Products          Lipa na Mpesa Production
```

(Real values are never written down in this repository.)

The same card is the only reliable statement of **which environment** the app
belongs to. `Production Apps` + the product name *Lipa na Mpesa Production* +
the host `https://api.safaricom.co.ke` in its endpoint list all mean: **live
credentials**. They only work against `api.safaricom.co.ke`; sent to the sandbox
host, Safaricom answers `Invalid Authentication passed`, which is the same
message a wrong key gets.

**Paybill or till?** The portal does not label it, but the number does:

| Short code | Kind | `MPESA_TRANSACTION_TYPE` |
| --- | --- | --- |
| 6 digits (e.g. `247247`) | Paybill | `CustomerPayBillOnline` (default) |
| 7 digits (e.g. `9874839`) | Buy Goods / till | `CustomerBuyGoodsOnline` |
| `174379` | Safaricom's sandbox test paybill | sandbox only, never live |

A till sent as a paybill is accepted at login and then refused at the payment
request, so nothing looks wrong until a customer tries to pay. This app now
detects that combination and says so.

---

## 2. The variables

### Required

| Variable | Value from | Notes |
| --- | --- | --- |
| `MPESA_CONSUMER_KEY` | portal → Consumer Key | Server-only |
| `MPESA_CONSUMER_SECRET` | portal → Consumer Secret | Regenerating it in the portal invalidates the old one immediately |
| `MPESA_SHORTCODE` | portal → Short Code | Digits only — no spaces, no `#`, no `254` |
| `MPESA_PASSKEY` | portal → Passkey | Tied to that app **and** that environment; a sandbox passkey will not work here |
| `MPESA_ENV` | you | `production` for a live app. Unset means `sandbox`, which is the default that caused the original failure |

### Optional, with a working default

| Variable | Default | When to change it |
| --- | --- | --- |
| `MPESA_TRANSACTION_TYPE` | `CustomerPayBillOnline` | Set `CustomerBuyGoodsOnline` for a 7-digit till |
| `MPESA_CALLBACK_URL` | `https://<site>/api/mpesa/callback` | Only if the callback must be on a different domain. Must be public HTTPS |

The callback does **not** need to be registered in the portal: STK push sends
`CallBackURL` with every request. It does need to be reachable — Vercel serves
it at `/api/mpesa/callback`, which is why the default is correct.

### Already present in this deployment

All seven names are set for **Production** in Vercel, and the live site reports
`{"enabled":true,"environment":"production"}`. Their *values* are stored as
`Sensitive` and cannot be read back — not by the app's logs, not by the admin
panel, not by me. The admin panel shows only the last four digits of the
short code, which is exactly what to compare against the portal.

### Two things M-Pesa depends on that are not M-Pesa settings

| Requirement | Why | How to check |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | The server writes the `mpesa_payments` row before the prompt is sent and reads it back when Safaricom confirms | Admin → Payments loads at all |
| `delivery_rate()` = 20 in Supabase | `place_order()` recomputes the total and refuses an M-Pesa order whose payment does not cover it. If the database's delivery rule disagreed with the app, a customer would be charged and then refused | `/api/mpesa/status` returns `enabled:false` with a `pricing-mismatch` reason in Admin → Payments |

---

## 3. Setting them in Vercel

**Dashboard:** Project → **Settings** → **Environment Variables** → add each key,
target **Production**, type **Sensitive** (except `MPESA_ENV` and
`MPESA_TRANSACTION_TYPE`, which are harmless and easier to read as *Plain*).

Three rules that have each cost an hour on this project:

1. **Paste the raw value.** No surrounding quotes, no trailing newline. The app
   strips them, but a stray quote inside the value is not recoverable.
2. **Production target.** A variable set only for *Preview* does nothing for
   `bookstore-puce-sigma.vercel.app`.
3. **Redeploy.** Vercel bakes env vars into a build. Saving a variable does not
   change the deployment that is already serving traffic — pick the newest
   deployment → **⋯** → **Redeploy**, or push any commit to `main`.

**CLI, if you prefer:**

```bash
vercel env add MPESA_ENV production        # then paste the value
vercel env rm MPESA_ENV production         # remove a wrong one
vercel --prod                              # deploy a fresh build
```

---

## 4. Verifying, in order, before you take real money

**1 — Is M-Pesa switched on?**

```bash
curl -s https://bookstore-puce-sigma.vercel.app/api/mpesa/status
# {"enabled":true,"environment":"production"}
```

`enabled:false` means one of the two prerequisites in §2 failed. Admin →
Payments names which.

**2 — Do the credentials work?** Open **Admin → Payments**. The check runs by
itself; read two lines:

- *M-Pesa authentication works* — Safaricom issued a token, which is a
  credential check that costs nothing and moves no money.
- *Short code* — should read `••••4839 · Buy Goods (till)`. Last four digits must
  match the portal, and the label must match the kind of number.

**3 — Does a payment actually go through?** Buy the cheapest book, with your own
phone, real money. You should see:

- an M-Pesa prompt on the phone naming the business;
- the checkout page move to "waiting" and then confirm by itself;
- Admin → Payments show the row as **Paid**, and Admin → Orders show the order.

That last step is the only proof that the whole chain — login, push, callback,
order — works. Nothing before it is.

---

## 5. When it fails

The admin panel's wording maps to exactly one fix each time.

| Panel says | Meaning | Fix |
| --- | --- | --- |
| rejected by both hosts | Key/secret pair invalid for both environments | Re-copy both from the app; if unsure, regenerate the secret and re-copy |
| works on `production`, but `MPESA_ENV` says `sandbox` | `MPESA_ENV` disagrees with the credentials | Set `MPESA_ENV=production`, redeploy |
| no response | The server never reached Safaricom | Deployment egress problem — both hosts answer anonymous requests from the public internet, so this is not an outage |
| Buy Goods (till) but type `CustomerPayBillOnline` | A till cannot be charged as a paybill | Set `MPESA_TRANSACTION_TYPE=CustomerBuyGoodsOnline`, redeploy |
| short code `••••174379` with production | You are using Safaricom's sandbox test paybill | Put the live short code from the portal |
| callback must be public HTTPS | `MPESA_CALLBACK_URL` is `http://` or malformed | Remove it and let the default apply, or fix the scheme |

If the panel says **authentication works** and the customer still gets no
prompt, the remaining causes are on Safaricom's side and worth checking in this
order: the short code is a live till/paybill provisioned for online payments;
the passkey belongs to that same app; the amount is at least KSh 1 (Daraja
rejects 0). The server log line `/api/mpesa/stk: STK rejected` records
Safaricom's own error text and never a credential.

---

## 6. Handling the secrets

- These are `Sensitive` in Vercel and **server-only**. Nothing in this repo sends
  them to a browser, and nothing should start: no `NEXT_PUBLIC_` prefix, ever.
- Do not paste them into chat, tickets, screenshots or git. The consumer key and
  secret pair is enough for someone else to take payments as you.
- If a secret leaks, regenerate it in the portal and update Vercel in the same
  sitting; the old one dies the moment you click regenerate.
- Rotating anything means: update the value → redeploy → run the check in §4.

---

## 7. Local development

Use sandbox credentials, never the live ones:

```bash
cp .env.example .env.local
# MPESA_ENV=sandbox
# MPESA_SHORTCODE=174379        ← Safaricom's sandbox test paybill
# MPESA_PASSKEY=<sandbox app passkey>
npm run dev
npm run mpesa:smoke             # config, host resolution, signing — no network calls to Safaricom
```

The smoke test never contacts Safaricom or moves money; it checks how the app
reads and uses the configuration. The admin panel's *Test connection* is the
only thing that talks to Daraja, and only when an admin asks.
