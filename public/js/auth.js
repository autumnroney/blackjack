// Google sign-in and player profiles through Supabase.
// Loaded separately from the game so blackjack still works if this fails.

// The publishable key is meant to be public: it only allows what your
// Supabase auth settings and row-level security permit.
const SUPABASE_URL = "https://ymomfylsgfkipdnohzgp.supabase.co";
const SUPABASE_KEY = "sb_publishable_68L4WLhZyqiYB28veVLTyA_LY5G4Kv_";
const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm";
const PROFILES = "blackjack_profiles";
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const BIO_MAX = 160;

const $ = (id) => document.getElementById(id);

let supabase = null;
let currentUser = null;
let currentProfile = null; // row from blackjack_profiles, or null if not created yet

// ---------- helpers ----------

function googleInfo(user) {
  const meta = user.user_metadata || {};
  const name = meta.full_name || meta.name || user.email || "Player";
  return {
    name,
    firstName: meta.given_name || name.split(" ")[0],
    avatar: meta.avatar_url || meta.picture || "",
    email: user.email || "",
  };
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function timeGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function suggestUsername(user) {
  const g = googleInfo(user);
  const base = (g.email.split("@")[0] || g.name)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);
  return base.length >= 3 ? base : (base + "player").slice(0, 20);
}

function setAvatar(img, fallback, url, name) {
  fallback.textContent = initials(name);
  if (url) {
    img.onerror = () => {
      img.hidden = true;
      fallback.hidden = false;
    };
    img.src = url;
    img.alt = name;
    img.hidden = false;
    fallback.hidden = true;
  } else {
    img.removeAttribute("src");
    img.hidden = true;
    fallback.hidden = false;
  }
}

function showAuthError(text) {
  const el = $("auth-error");
  el.textContent = text;
  el.hidden = !text;
}

// ---------- header + greeting ----------

function renderSignedOut() {
  $("auth-signed-out").hidden = false;
  $("auth-signed-out").disabled = false;
  $("auth-signed-in").hidden = true;
  $("greeting-bar").hidden = true;
  if ($("profile-dialog").open) $("profile-dialog").close();
}

function renderSignedIn() {
  const g = googleInfo(currentUser);
  const p = currentProfile;
  const name = p?.display_name || g.name;

  $("auth-signed-out").hidden = true;
  $("auth-signed-in").hidden = false;
  setAvatar($("avatar"), $("avatar-fallback"), p ? p.avatar_url : g.avatar, name);
  $("user-name").textContent = p ? `@${p.username}` : g.name;
  $("profile-open").title = p ? `${p.display_name} — edit profile` : "Create your profile";

  $("greeting-bar").hidden = false;
  $("greeting").textContent = p
    ? `${timeGreeting()}, ${p.display_name}! Pull up a seat.`
    : `${timeGreeting()}, ${g.firstName}! Pull up a seat.`;
  $("create-profile-cta").hidden = !!p;
}

// ---------- profile data ----------

async function loadProfile() {
  const { data, error } = await supabase
    .from(PROFILES)
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();
  if (error) {
    console.error(error);
    showAuthError("Couldn't load your profile.");
    return;
  }
  currentProfile = data;
  renderSignedIn();

  // First visit after signing in: invite them to make a profile (once per tab).
  if (!data) {
    let prompted = false;
    try {
      prompted = sessionStorage.getItem("blackjack.profilePrompted") === currentUser.id;
      sessionStorage.setItem("blackjack.profilePrompted", currentUser.id);
    } catch {
      /* storage unavailable */
    }
    if (!prompted) openProfile();
  }
}

function friendlyDbError(error) {
  if (error.code === "23505") return "That username is taken. Try another one.";
  if (error.code === "23514") return "Some details aren't valid. Check the fields and try again.";
  return error.message || "Couldn't save your profile.";
}

// ---------- profile dialog ----------

function formError(text) {
  $("profile-error").textContent = text;
  $("profile-error").hidden = !text;
}

function updatePreview() {
  const g = googleInfo(currentUser);
  const name = $("pf-display-name").value.trim() || g.name;
  setAvatar(
    $("pf-avatar"),
    $("pf-avatar-fallback"),
    $("pf-use-google").checked ? g.avatar : "",
    name
  );
  $("pf-preview-name").textContent = name;
  const u = $("pf-username").value;
  $("pf-preview-username").textContent = u ? `@${u}` : "";
  $("pf-bio-count").textContent = `${$("pf-bio").value.length}/${BIO_MAX}`;
}

function openProfile() {
  if (!currentUser) return;
  const g = googleInfo(currentUser);
  const p = currentProfile;

  $("profile-title").textContent = p ? "Your profile" : "Create your profile";
  $("pf-save").textContent = p ? "Save changes" : "Create profile";
  $("pf-delete").hidden = !p;
  $("pf-email").textContent = g.email;

  $("pf-username").value = p?.username ?? suggestUsername(currentUser);
  $("pf-display-name").value = p?.display_name ?? g.name;
  $("pf-bio").value = p?.bio ?? "";
  $("pf-use-google").checked = p ? !!p.avatar_url : !!g.avatar;
  $("pf-use-google").disabled = !g.avatar;
  $("pf-since").textContent = p
    ? `Member since ${new Date(p.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })}`
    : "";

  formError("");
  updatePreview();
  $("profile-dialog").showModal();
}

async function saveProfile(event) {
  event.preventDefault();
  const username = $("pf-username").value.trim().toLowerCase();
  const display_name = $("pf-display-name").value.trim();
  const bio = $("pf-bio").value.trim();

  if (!USERNAME_RE.test(username)) {
    formError("Usernames are 3–20 characters: lowercase letters, numbers and underscores.");
    $("pf-username").focus();
    return;
  }
  if (!display_name || display_name.length > 40) {
    formError("Display name must be 1–40 characters.");
    $("pf-display-name").focus();
    return;
  }

  const g = googleInfo(currentUser);
  const row = {
    id: currentUser.id,
    username,
    display_name,
    bio: bio.slice(0, BIO_MAX),
    avatar_url: $("pf-use-google").checked && g.avatar.startsWith("https://") ? g.avatar : null,
  };

  $("pf-save").disabled = true;
  formError("");
  const { data, error } = await supabase.from(PROFILES).upsert(row).select().single();
  $("pf-save").disabled = false;

  if (error) {
    console.error(error);
    formError(friendlyDbError(error));
    return;
  }
  currentProfile = data;
  renderSignedIn();
  $("profile-dialog").close();
}

async function deleteProfile() {
  if (!currentProfile) return;
  if (!confirm("Delete your blackjack profile? You'll stay signed in and can create a new one later.")) return;
  const { error } = await supabase.from(PROFILES).delete().eq("id", currentUser.id);
  if (error) {
    formError(friendlyDbError(error));
    return;
  }
  currentProfile = null;
  renderSignedIn();
  $("profile-dialog").close();
}

// ---------- boot ----------

function wireProfileUi() {
  $("profile-open").addEventListener("click", openProfile);
  $("create-profile-cta").addEventListener("click", openProfile);
  $("pf-cancel").addEventListener("click", () => $("profile-dialog").close());
  $("profile-form").addEventListener("submit", saveProfile);
  $("pf-delete").addEventListener("click", deleteProfile);
  $("pf-username").addEventListener("input", (e) => {
    const cleaned = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (cleaned !== e.target.value) e.target.value = cleaned;
    updatePreview();
  });
  ["pf-display-name", "pf-bio", "pf-use-google"].forEach((id) =>
    $(id).addEventListener("input", updatePreview)
  );
  $("profile-dialog").addEventListener("click", (e) => {
    if (e.target === $("profile-dialog")) $("profile-dialog").close(); // backdrop click
  });
}

async function init() {
  try {
    const { createClient } = await import(SUPABASE_JS);
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (err) {
    console.error(err);
    $("auth-signed-out").disabled = true;
    showAuthError("Sign-in is unavailable right now.");
    return;
  }

  wireProfileUi();

  // Errors from the OAuth round trip come back in the URL.
  const params = new URLSearchParams(location.search + "&" + location.hash.slice(1));
  const oauthError = params.get("error_description");
  if (oauthError) showAuthError(oauthError.replace(/\+/g, " "));

  supabase.auth.onAuthStateChange((event, session) => {
    // Tidy the ?code=… / #access_token=… left behind by the redirect.
    if (location.search.includes("code=") || location.hash.includes("access_token") || oauthError) {
      history.replaceState(null, "", location.pathname);
    }
    if (!session?.user) {
      currentUser = null;
      currentProfile = null;
      renderSignedOut();
      return;
    }
    const sameUser = currentUser?.id === session.user.id;
    currentUser = session.user;
    showAuthError("");
    if (sameUser && event === "TOKEN_REFRESHED") return;
    renderSignedIn();
    // Don't await Supabase calls inside this callback (supabase-js can deadlock).
    setTimeout(loadProfile, 0);
  });

  $("auth-signed-out").addEventListener("click", async () => {
    $("auth-signed-out").disabled = true;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: location.origin + location.pathname },
    });
    if (error) {
      $("auth-signed-out").disabled = false;
      showAuthError(error.message);
    }
  });

  $("signout").addEventListener("click", () => supabase.auth.signOut());
}

init();
