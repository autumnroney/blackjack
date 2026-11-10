// Google sign-in through Supabase Auth.
// Loaded separately from the game so blackjack still works if this fails.

// The publishable key is meant to be public: it only allows what your
// Supabase auth settings and row-level security permit.
const SUPABASE_URL = "https://ymomfylsgfkipdnohzgp.supabase.co";
const SUPABASE_KEY = "sb_publishable_68L4WLhZyqiYB28veVLTyA_LY5G4Kv_";
const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm";

const $ = (id) => document.getElementById(id);

function profileOf(user) {
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

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function renderSignedOut() {
  $("auth-signed-out").hidden = false;
  $("auth-signed-in").hidden = true;
  $("greeting").hidden = true;
}

function renderSignedIn(user) {
  const p = profileOf(user);
  $("auth-signed-out").hidden = true;
  $("auth-signed-in").hidden = false;

  const avatar = $("avatar");
  const fallback = $("avatar-fallback");
  fallback.textContent = initials(p.name);
  if (p.avatar) {
    avatar.src = p.avatar;
    avatar.alt = p.name;
    avatar.hidden = false;
    fallback.hidden = true;
    avatar.onerror = () => {
      avatar.hidden = true;
      fallback.hidden = false;
    };
  } else {
    avatar.hidden = true;
    fallback.hidden = false;
  }
  $("user-name").textContent = p.name;
  $("user-name").title = p.email;

  $("greeting").hidden = false;
  $("greeting").textContent = `${greeting()}, ${p.firstName}! Pull up a seat.`;
}

function showAuthError(text) {
  const el = $("auth-error");
  el.textContent = text;
  el.hidden = !text;
}

async function init() {
  let supabase;
  try {
    const { createClient } = await import(SUPABASE_JS);
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (err) {
    console.error(err);
    $("auth-signed-out").disabled = true;
    showAuthError("Sign-in is unavailable right now.");
    return;
  }

  // Errors from the OAuth round trip come back in the URL.
  const params = new URLSearchParams(location.search + "&" + location.hash.slice(1));
  const oauthError = params.get("error_description");
  if (oauthError) showAuthError(oauthError.replace(/\+/g, " "));

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      showAuthError("");
      renderSignedIn(session.user);
    } else {
      renderSignedOut();
    }
    // Tidy the ?code=… / #access_token=… left behind by the redirect.
    if (location.search.includes("code=") || location.hash.includes("access_token") || oauthError) {
      history.replaceState(null, "", location.pathname);
    }
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

  $("signout").addEventListener("click", async () => {
    await supabase.auth.signOut();
  });
}

init();
