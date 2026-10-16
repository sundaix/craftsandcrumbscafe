const $gate = $('#admGate');
const $login = $('#admLoginScreen');
const $shell = $('#admShell');
let dashboardBooted = false; // guards against re-running the initial data load on every future auth event
let adminAccessRechecked = false; // guards the "double check before denying" grace period below (one recheck per verdict)
let roleCheckedUid = null; // which account the grace-period state above belongs to
let gateTimer = null; // gives up on the loading gate if the role check never resolves
// auth.js retries the role read for up to ~28s before it reports "unknown", so wait
// longer than that: a shorter timeout would show the sign-in form to an admin who is
// in fact signed in and just on a slow connection.
const GATE_TIMEOUT_MS = 35000;

function clearGateTimer(){
  clearTimeout(gateTimer);
  gateTimer = null;
}

function showLoginScreen(errorMsg){
  clearGateTimer();
  $gate.hide();
  $shell.hide();
  $login.show();
  if(errorMsg){
    $('#admLoginError').text(errorMsg).addClass('show');
  } else {
    $('#admLoginError').removeClass('show');
  }
}

function showLoadingGate(){
  $login.hide();
  $shell.hide();
  $gate.show();
  // Without this, an "unknown" role (offline / slow reconnect) left the
  // spinner up forever with no way out. After GATE_TIMEOUT_MS fall back to
  // the sign-in form. This never signs anyone out; a late authRoleReady
  // still takes over normally. Not restarted if already running.
  if(!gateTimer){
    gateTimer = setTimeout(() => {
      gateTimer = null;
      if(!dashboardBooted) showLoginScreen("We couldn't verify your account. Check your connection, then sign in again.");
    }, GATE_TIMEOUT_MS);
  }
}

async function bootDashboard(){
  clearGateTimer();
  $login.hide();
  $gate.hide();
  $shell.show();
  if(dashboardBooted) return; // already loaded once this session — just re-show the shell
  dashboardBooted = true;

  try{
    const categories = await window.CCCategories.fetchAllCategories();
    CUSTOM_CATEGORIES = categories;
    categories.forEach(applyCustomCategoryCore);
  } catch(err){
    console.error('Could not load categories from Firestore.', err);
  }
  // Real catalog only. loadProductsFromFirestore() (shared-catalog.js) falls
  // back to the demo seed list when the network fails, which would show
  // fake products with Edit/Delete buttons to the admin.
  try{
    setCatalogProducts(await window.CCProducts.fetchAllProducts());
  } catch(err){
    console.error('Could not load products from Firestore.', err);
    showToast("Couldn't load the product catalog. Refresh the page before editing products.", 'error', 8000);
  }

  renderAdminDashboard(); // from admin.js
}

/* Fires on every login/logout/page load (see auth.js). role is null
   very briefly on first load until the Firestore read resolves —
   authRoleReady (below) is what actually decides what to show. */
document.addEventListener('authStateReady', function(e){
  if(!e.detail.user) showLoginScreen();
});

document.addEventListener('authRoleReady', function(e){
  const { user, role, unknown, blocked } = e.detail;
  if(!user || user.isAnonymous){
    adminAccessRechecked = false; // fresh sign-in later gets its own grace check
    roleCheckedUid = null;
    // auth.js signs a suspended account out and says so with blocked:true;
    // without this the admin just landed on a blank login form, no reason given.
    showLoginScreen(blocked ? 'This account has been suspended.' : undefined);
    return;
  }
  if(user.uid !== roleCheckedUid){
    // A different account signed in (e.g. a non-admin got "no access" and
    // then logged in as an admin without logging out first): it gets its
    // own grace check instead of inheriting the previous account's verdict.
    roleCheckedUid = user.uid;
    adminAccessRechecked = false;
  }
  if(unknown){
    // auth.js couldn't confirm the role at all (e.g. right after the
    // tab was backgrounded for a while and the reconnect is still
    // catching up) — NOT the same as confirmed non-admin. Signing
    // someone out here was the "logged out after inactivity" bug:
    // don't force a logout on an unknown state, just wait for the
    // next authRoleReady (which fires again on the next token
    // refresh/retry) rather than guessing. The gate times out (above)
    // so this can't spin forever.
    if(!dashboardBooted) showLoadingGate();
    return;
  }
  if(role !== 'admin'){
    if(!adminAccessRechecked){
      // First non-admin verdict — the very first role read right after
      // logging in (or after a token refresh) can occasionally land before
      // Firestore is fully consistent and come back with a stale default
      // instead of "unknown". Rather than flash "no access" at someone who
      // really is an admin, double-check once before deciding. A second
      // non-admin verdict is treated as real. If the dashboard is already
      // open, keep it on screen while the recheck runs.
      adminAccessRechecked = true;
      if(!dashboardBooted) showLoadingGate();
      window.CCAuth.recheckRole();
      return;
    }
    // Deliberately no logoutUser() here: admin, rider and customer share
    // one Firebase Auth session on this origin, so signOut() kills every
    // other open tab's session too (the old "logged out after inactivity"
    // bug). firestore.rules already stops a non-admin doing anything real,
    // so just show the message.
    console.warn('[admin-boot] role was', role, 'not admin (confirmed on recheck).');
    showLoginScreen('This account does not have admin access.');
    return;
  }
  // Confirmed admin. Reset (rather than set) the flag so that a LATER
  // non-admin verdict, e.g. a stale read after a token refresh, still gets
  // its one recheck instead of instantly hiding the dashboard mid-work.
  adminAccessRechecked = false;
  bootDashboard();
});

$(document).on('submit', '#admLoginForm', async function(e){
  e.preventDefault();
  const email = $('#admLoginEmail').val().trim();
  const password = $('#admLoginPassword').val();
  const $btn = $('#admLoginSubmitBtn');
  $('#admLoginError').removeClass('show');
  $btn.prop('disabled', true).text('Signing in...');
  try{
    await window.CCAuth.loginUser(email, password);
    // authRoleReady (above) takes it from here — it fires automatically
    // once auth.js's onAuthStateChanged + role lookup resolve.
  } catch(err){
    console.error(err);
    const messages = {
      'auth/invalid-credential': 'Incorrect email or password.',
      'auth/wrong-password': 'Incorrect email or password.',
      'auth/user-not-found': 'Incorrect email or password.',
      'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
      'auth/network-request-failed': 'No connection. Check your internet and try again.'
    };
    $('#admLoginError').text(messages[err.code] || 'Could not sign in. Please try again.').addClass('show');
  } finally {
    $btn.prop('disabled', false).text('Sign In');
  }
});

$(document).on('click', '#admLogoutBtn', async function(){
  const ok = await showConfirm({
    title: 'Log out?',
    message: "You'll need to sign in again to access the dashboard.",
    confirmText: 'Log Out'
  });
  if(!ok) return;
  dashboardBooted = false;
  adminAccessRechecked = false;
  roleCheckedUid = null;
  await window.CCAuth.logoutUser();
});

/* Shows the loading gate immediately so there's no flash of the login
   form for someone who's actually already signed in as an admin —
   authStateReady/authRoleReady above will swap it out within a beat. */
showLoadingGate();