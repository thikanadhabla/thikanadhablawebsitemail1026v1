// mail-auth.js
// Shared authentication + API helpers for mail pages

const MAIL_SUPABASE_URL = "https://fmrmiylqjokyrsztfmgp.supabase.co";
const MAIL_SUPABASE_ANON_KEY = "sb_publishable_cNHjqBdWpu98niKZqMvIuA_96VjEQxk";
const MAIL_FN_URL = MAIL_SUPABASE_URL + "/functions/v1/mail-api";

const MailAuth = {
  supabase: null,

  init() {
    this.supabase = supabase.createClient(MAIL_SUPABASE_URL, MAIL_SUPABASE_ANON_KEY);
  },

  // Save session after successful login
  saveSession(data) {
    sessionStorage.setItem("_mail_token", data.access_token);
    sessionStorage.setItem("_mail_user_id", data.user.id);
    sessionStorage.setItem("_mail_user_email", data.user.email);
    sessionStorage.setItem("_mail_is_admin", data.isAdmin ? "1" : "0");
    sessionStorage.setItem("_mail_session_id", data.session_id);
    sessionStorage.setItem("_mail_login_time", String(Date.now()));
  },

  clearSession() {
    sessionStorage.clear();
  },

  getToken() { return sessionStorage.getItem("_mail_token") || null; },
  getUserEmail() { return sessionStorage.getItem("_mail_user_email") || ""; },
  getUserId() { return sessionStorage.getItem("_mail_user_id") || ""; },
  isAdmin() { return sessionStorage.getItem("_mail_is_admin") === "1"; },
  getSessionId() { return sessionStorage.getItem("_mail_session_id") || ""; },
  getLoginTime() { return parseInt(sessionStorage.getItem("_mail_login_time") || "0", 10); },

  // Verify the token is still valid and returns user + isAdmin
  async verifySession() {
    const token = this.getToken();
    if (!token) return null;

    try {
      // Use Supabase auth client to validate token
      const { data, error } = await this.supabase.auth.getUser(token);
      if (error || !data?.user) return null;

      // Fetch admin status from the mail-api
      const res = await fetch(`${MAIL_FN_URL}?action=senders`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!res.ok) return null;

      return {
        user: data.user,
        token,
        isAdmin: this.isAdmin(),
      };
    } catch (e) {
      return null;
    }
  },

  // API call helper
  async api(action, payload = {}, method = "POST", queryParams = {}) {
    const headers = { "Content-Type": "application/json" };
    const token = this.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let url = `${MAIL_FN_URL}?action=${action}`;
    for (const [k, v] of Object.entries(queryParams)) {
      url += `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
    }

    const opts = { method, headers };
    if (method === "POST") opts.body = JSON.stringify(payload);

    const res = await fetch(url, opts);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text }; }

    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  },

  // Force logout — used on 401 errors
  async forceLogout(reason) {
    const dur = this.getLoginTime() ? Math.round((Date.now() - this.getLoginTime()) / 1000) : 0;
    try {
      await this.api("log_logout", { session_id: this.getSessionId(), duration_sec: dur });
    } catch (e) { /* ignore */ }

    this.clearSession();
    if (reason) sessionStorage.setItem("_mail_login_reason", reason);
    location.replace("mail-login.html");
  },

  // Called on page load — redirects to login if not authenticated
  async requireAuth(requireAdmin = false) {
    this.init();
    const session = await this.verifySession();

    if (!session) {
      this.clearSession();
      location.replace("mail-login.html");
      return null;
    }

    if (requireAdmin && !session.isAdmin) {
      location.replace("mail-dashboard.html");
      return null;
    }

    return session;
  },

  // Redirect to correct dashboard based on role
  async routeToDashboard() {
    this.init();
    const session = await this.verifySession();
    if (!session) {
      location.replace("mail-login.html");
      return;
    }
    if (session.isAdmin) {
      location.replace("mail-admin.html");
    } else {
      location.replace("mail-dashboard.html");
    }
  },

  // Called on login page load — if already logged in, redirect
  async redirectIfLoggedIn() {
    this.init();
    const session = await this.verifySession();
    if (session) {
      if (session.isAdmin) location.replace("mail-admin.html");
      else location.replace("mail-dashboard.html");
    }
  },
};
