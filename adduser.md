Here's a complete `README.md` file you can put in your repo. It documents how to add new mail users, how the system works, and how to troubleshoot common issues.

Save this as **`README.md`** in your repo root.

---

```markdown
# Thikana Dhabla Ghosi — Family Mail System

A private email system for `@thikanadhabla.in` addresses with a web dashboard.

## What This System Does

- Receives emails at `@thikanadhabla.in` addresses via Cloudflare
- Saves every email to Supabase (PostgreSQL database)
- Forwards every email to `infothikanadhabla@gmail.com` as backup
- Lets users read and send emails from a web dashboard
- Admins can see everything — all emails, all activity, all sessions

---

## System Architecture

```
External sender
      ↓
Cloudflare Email Routing (DNS MX records)
      ↓
Cloudflare Email Worker (email-inbound-thikanadhabla)
      ↓
   ┌──┴─────────────────────┐
   ↓                        ↓
Forward to Gmail      Supabase Edge Function
(infothikanadhabla    (mail-api)
 @gmail.com)                ↓
                     Supabase Database
                     (received_emails, sent_emails,
                      activity_logs, mail_admins)
                            ↓
                     Web Dashboard
                     (mail-login.html →
                      mail-dashboard.html /
                      mail-admin.html)
                            ↓
                     Outbound emails → Resend API
```

---

## Files in This Repo

| File | Purpose |
|---|---|
| `mail-login.html` | Login page (email + password + math captcha) |
| `mail-dashboard.html` | User mailbox — own inbox, sent, compose |
| `mail-admin.html` | Admin dashboard — everything + tracking |
| `mail-auth.js` | Shared authentication helper |
| `README.md` | This file |

---

## How to Add a New Mail User

To add a new `@thikanadhabla.in` mailbox, follow these **4 steps**.

### Step 1: Add a Mail Sender (so they can send emails)

1. Open **Supabase Dashboard** → `https://supabase.com/dashboard/project/fmrmiylqjokyrsztfmgp`
2. Left sidebar → **SQL Editor** → **New query**
3. Run this (replace with the real values):

```sql
INSERT INTO mail_senders (email, display_name)
VALUES ('newuser@thikanadhabla.in', 'New User');
```

**Example** — adding `accounts@thikanadhabla.in`:

```sql
INSERT INTO mail_senders (email, display_name)
VALUES ('accounts@thikanadhabla.in', 'Accounts');
```

### Step 2: Create a Supabase Auth User (so they can log in)

1. Supabase Dashboard → **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Fill in:
   - **Email:** `newuser@thikanadhabla.in`
   - **Password:** *(choose a strong password)*
   - ✅ Check **Auto Confirm User**
4. Click **Create user**
5. **Copy the user's UUID** (click the user → copy the ID at the top)

### Step 3: (Admin Only) Grant Admin Access

If this user should be an **admin** (see everything), run:

```sql
INSERT INTO mail_admins (email)
VALUES ('newuser@thikanadhabla.in');
```

**Skip this step if the user is a regular mailbox user.**

### Step 4: Route Their Email in Cloudflare

1. Cloudflare Dashboard → select **`thikanadhabla.in`**
2. Left sidebar → **Email** → **Email Routing**
3. Click **Routes** tab → **Add route** (or edit existing)
4. Fill in:
   - **Custom address:** `newuser@thikanadhabla.in`
   - **Action:** **Send to Worker**
   - **Worker:** `email-inbound-thikanadhabla`
   - ✅ **Also forward to:** `infothikanadhabla@gmail.com`
5. Click **Save**

Wait 30 seconds for the route to activate. Send a test email from a different account to verify.

---

## Quick Reference — The 4 Steps

| # | Step | Where | Command/Action |
|---|---|---|---|
| 1 | Add to `mail_senders` | Supabase SQL | `INSERT INTO mail_senders...` |
| 2 | Create Auth user | Supabase Authentication | Add user with password |
| 3 | Add to `mail_admins` (optional) | Supabase SQL | `INSERT INTO mail_admins...` |
| 4 | Add route in Cloudflare | Cloudflare Email Routing | Send to Worker + forward |

---

## User Roles

### Regular User (`support@`, `info@`, or any non-admin)
- Can read their own inbox (emails sent to their address)
- Can send from their own address
- Cannot see other users' emails
- Cannot see logs

**Login redirects to:** `mail-dashboard.html`

### Admin (`admin@`, `rajvardhan@`, or any address in `mail_admins`)
- Can read **every** email received at any `@thikanadhabla.in` address
- Can see **every** email sent by anyone
- Can see **all** activity logs
- Can see **all** login sessions
- Can send from any sender address

**Login redirects to:** `mail-admin.html`

---

## Adding a New Admin

If a user already exists and you want to promote them to admin:

```sql
INSERT INTO mail_admins (email)
VALUES ('existing-user@thikanadhabla.in')
ON CONFLICT DO NOTHING;
```

If you want to demote an admin:

```sql
DELETE FROM mail_admins WHERE email = 'user@thikanadhabla.in';
```

**The user must log out and log back in for the change to take effect.**

---

## Removing a Mail User

To completely remove a user, do these in order:

### 1. Remove from senders

```sql
DELETE FROM mail_senders WHERE email = 'user@thikanadhabla.in';
```

### 2. Remove admin (if applicable)

```sql
DELETE FROM mail_admins WHERE email = 'user@thikanadhabla.in';
```

### 3. Delete from Supabase Auth

Supabase Dashboard → **Authentication** → **Users** → find the user → **Delete user**

### 4. Remove Cloudflare route

Cloudflare → **Email Routing → Routes** → delete the route for that address

---

## Testing — How to Send a Test Email Correctly

**Very important:** Gmail **silently discards** forwarded emails if the test is sent from `infothikanadhabla@gmail.com` (the same address everything forwards to).

**Always test from a different account:**
- ✅ `rajwebsitedomain@gmail.com` (different Gmail)
- ✅ Your work email
- ✅ Any non-Gmail address
- ❌ **Never** `infothikanadhabla@gmail.com`

### Correct Test Flow

1. From `rajwebsitedomain@gmail.com`, send an email to `support@thikanadhabla.in`
2. Wait 10 seconds
3. Check:
   - **Supabase Table Editor → `received_emails`** — should see the new row
   - **Gmail `infothikanadhabla@gmail.com`** → check Inbox, **All Mail**, and **Spam**
   - **Cloudflare Worker logs** — should show "Forwarded" and "Saved to Supabase"
   - **Web dashboard** — log in as `support@` → the email appears in the Inbox

---

## Troubleshooting

### Emails saved in Supabase but not arriving in Gmail

**Cause 1:** `infothikanadhabla@gmail.com` is not verified as a destination address.

**Fix:**
1. Cloudflare → Email Routing → **Destination Addresses**
2. Find `infothikanadhabla@gmail.com`
3. If not there, click **Add destination address**
4. Check Gmail for the Cloudflare verification email → click **Verify**

**Cause 2:** Testing from the same Gmail address.

**Fix:** Send the test from a completely different email account.

**Cause 3:** The route doesn't have "Also forward to" enabled.

**Fix:**
1. Cloudflare → Email Routing → **Routes**
2. Edit the route
3. ✅ Check **Also forward to** → select `infothikanadhabla@gmail.com`
4. Save

---

### User can't log in

1. Check the user exists in **Supabase → Authentication → Users**
2. If missing → follow **Step 2** above to create them
3. If exists but password forgotten → reset it in Supabase Auth dashboard
4. Check the math captcha is being answered correctly

---

### User logs in but sees an empty inbox

1. Check that Cloudflare has a route for their address
2. Send a test email to their address (from a non-Gmail account)
3. Check Supabase → Table Editor → `received_emails`
4. Verify the `recipient_email` column matches the logged-in user exactly

---

### Worker not receiving emails

1. Cloudflare → Email Routing → **Activity Log**
2. Check the status of the last email:
   - **Delivered to Worker** = Worker ran but something failed
   - **Dropped** = Route is not configured
   - **Rejected** = SPF/DKIM issue with the sender

3. Cloudflare → Workers & Pages → `email-inbound-thikanadhabla` → **Logs**
4. Look for error messages

---

### "BACKUP_EMAIL not set" in logs

The Worker is missing the `BACKUP_EMAIL` secret.

**Fix:**
1. Cloudflare → Workers & Pages → `email-inbound-thikanadhabla`
2. Settings → **Variables and Secrets**
3. Add:
   - **Name:** `BACKUP_EMAIL`
   - **Value:** `infothikanadhabla@gmail.com`
4. Click **Save** → then click **Deploy** (both buttons)

---

## Database Schema Reference

### `mail_senders`
Available from-addresses users can send as.

| Column | Type | Description |
|---|---|---|
| email | TEXT (PK) | Full address, e.g. `support@thikanadhabla.in` |
| display_name | TEXT | Human name, e.g. `Support` |
| active | BOOLEAN | Whether the sender is usable |

### `mail_admins`
Users who can see everything.

| Column | Type | Description |
|---|---|---|
| email | TEXT (PK) | Admin's email |
| created_at | TIMESTAMPTZ | When they became admin |

### `received_emails`
Every inbound email.

| Column | Type | Description |
|---|---|---|
| id | BIGSERIAL | Primary key |
| recipient_email | TEXT | Which mailbox received it |
| from_email | TEXT | Who sent it |
| subject | TEXT | Subject line |
| body | TEXT | Plain-text body |
| status | TEXT | `unread` or `read` |
| created_at | TIMESTAMPTZ | When it was received |

### `sent_emails`
Every outbound email.

| Column | Type | Description |
|---|---|---|
| id | BIGSERIAL | Primary key |
| from_email | TEXT | Sender |
| to_email | TEXT | Recipient |
| subject | TEXT | Subject |
| body | TEXT | HTML body |
| status | TEXT | `sent` or `failed` |
| sent_by | UUID | Supabase Auth user ID |
| created_at | TIMESTAMPTZ | When sent |

### `activity_logs`
Every action taken.

| Column | Type | Description |
|---|---|---|
| id | BIGSERIAL | Primary key |
| user_id | UUID | Supabase Auth user |
| user_email | TEXT | User's email |
| action | TEXT | `login`, `logout`, `send`, `delete` |
| details | TEXT | Extra info (recipient, subject, etc.) |
| device | TEXT | User agent |
| ip | TEXT | IP address |
| session_id | TEXT | Session identifier |
| duration_sec | INT | Session duration (for logout) |
| created_at | TIMESTAMPTZ | When |

---

## Current Mail Users

| Email | Role | Can Send As |
|---|---|---|
| `support@thikanadhabla.in` | User | support@ |
| `info@thikanadhabla.in` | User | info@ |
| `admin@thikanadhabla.in` | Admin | All senders |
| `rajvardhan@thikanadhabla.in` | Admin | All senders |

*Update this table as you add new users.*

---

## Secret Values

These are stored in Cloudflare Workers (not in this repo):

| Secret Name | Purpose |
|---|---|
| `BACKUP_EMAIL` | Gmail address to forward all emails to |
| `INBOUND_WEBHOOK_SECRET` | Authenticates Worker → Supabase calls |

If you ever need to change these, do it in:
**Cloudflare → Workers & Pages → email-inbound-thikanadhabla → Settings → Variables and Secrets**

After changing any secret, click **Deploy** — the change won't apply otherwise.

---

## Cloudflare Worker Code Location

**Cloudflare → Workers & Pages → email-inbound-thikanadhabla → Edit code**

The Worker:
1. Receives the email
2. Forwards it to `infothikanadhabla@gmail.com`
3. Parses the subject and body
4. Posts the parsed data to Supabase

---

## Support

If something breaks:

1. Check the **Cloudflare Worker logs** first
2. Check the **Supabase Edge Function logs** (`mail-api` function)
3. Check the **Cloudflare Email Routing Activity Log**
4. Check the **browser console** on the dashboard page

Most issues fall into these categories:
- **Email not saved** → Cloudflare route not set up, or Worker error
- **Email not forwarded** → Gmail destination not verified
- **Email not showing in dashboard** → User's Auth account missing or wrong mailbox
- **Login fails** → Password wrong, or captcha wrong, or Auth user missing

---

## Version

Last updated: 2026-10-09
Maintained by: Rajvardhan Singh Badgujar
```
---

## How to Use This File

1. Save it as **`README.md`** in your repo root
2. Commit and push:
   ```bash
   git add README.md
   git commit -m "Add mail system documentation"
   git push origin main
   ```
3. It will render automatically on GitHub — anyone with repo access can read it

---

## Quick Reference — How to Add a New User

Copy-paste these commands, replacing `newuser@thikanadhabla.in` and `New User` with real values:

**1. Supabase SQL — add as sender:**
```sql
INSERT INTO mail_senders (email, display_name)
VALUES ('newuser@thikanadhabla.in', 'New User');
```

**2. Supabase Dashboard → Authentication → Users → Add user:**
- Email: `newuser@thikanadhaba.in`
- Password: *(strong)*
- ✅ Auto Confirm User

**3. Supabase SQL — grant admin (only if needed):**
```sql
INSERT INTO mail_admins (email)
VALUES ('newuser@thikanadhabla.in');
```

**4. Cloudflare → Email Routing → Routes → Add route:**
- Address: `newuser@thikanadhabla.in`
- Action: **Send to Worker** → `email-inbound-thikanadhabla`
- ✅ Also forward to: `infothikanadhabla@gmail.com`

Send a test email from a different account, then log in as the new user at:
```
https://thikanadhabla.in/mail-login.html
```

---

Let me know if you want me to add a "Adding a New Sender Address Only" (without a login user — just the from-address) section, or expand any part.
