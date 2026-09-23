const $gate = $('#admGate');
const $login = $('#admLoginScreen');
const $shell = $('#admShell');
let dashboardBooted = false; // guards against re-running the initial data load on every future auth event
let adminAccessRechecked = false; // guards the one-time "double check before denying" grace period below

function showLoginScreen(errorMsg){
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
}

async function bootDashboard(){
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
  await loadProductsFromFirestore(); // from shared-catalog.js

  renderAdminDashboard(); // from admin.js
}

/* Fires on every login/logout/page load (see auth.js). role is null
   very briefly on first load until the Firestore read resolves —
   authRoleReady (below) is what actually decides what to show. */
document.addEventListener('authStateReady', function(e){
  if(!e.detail.user) showLoginScreen();
});

document.addEventListener('authRoleReady', function(e){
  const { user, role, unknown } = e.detail;
  if(!user || user.isAnonymous){
    adminAccessRechecked = false; // fresh sign-in later gets its own grace check
    showLoginScreen();
    return;
  }
  if(unknown){
    // auth.js couldn't confirm the role at all (e.g. right after the
    // tab was backgrounded for a while and the reconnect is still
    // catching up) — NOT the same as confirmed non-admin. Signing
    // someone out here was the "logged out after inactivity" bug:
    // don't force a logout on an unknown state, just wait for the
    // next authRoleReady (which fires again on the next token
    // refresh/retry) rather than guessing.
    if(!dashboardBooted) showLoadingGate();
    return;
  }
  if(role !== 'admin'){
    if(!adminAccessRechecked){
      // First non-admin verdict for this sign-in — the very first
      // role read right after logging in can occasionally land before
      // Firestore is fully consistent (e.g. a role that was just
      // granted hasn't propagated yet), coming back with a stale
      // default instead of "unknown". Rather than flash "no access"
      // at someone who really is an admin, double-check once before
      // deciding — this is the ONLY retry; a second non-admin verdict
      // is treated as real.
      adminAccessRechecked = true;
      showLoadingGate();
      window.CCAuth.recheckRole();
      return;
    }
    // TEMP DIAGNOSTIC
    console.warn('[admin-boot] role was', role, 'not admin (confirmed on recheck).');
    // Used to also call window.CCAuth.logoutUser() here, but admin,
    // rider, and customer all share one Firebase Auth session on this
    // origin — signOut() isn't scoped to this tab, it kills every
    // other open tab's session too. That was the real cause of the
    // "logged out after inactivity" reports: having more than one of
    // these apps open at once, whichever one's role check lost the
    // race would sign everyone out. firestore.rules already blocks a
    // non-admin from doing anything real, so there's no security need
    // to force a client-side sign-out here — just show the message.
    showLoginScreen('This account does not have admin access.');
    return;
  }
  adminAccessRechecked = true; // confirmed admin — no need to grace-check again this sign-in
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
    const message = (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found')
      ? 'Incorrect email or password.'
      : 'Could not sign in. Please try again.';
    $('#admLoginError').text(message).addClass('show');
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
  await window.CCAuth.logoutUser();
});

/* Shows the loading gate immediately so there's no flash of the login
   form for someone who's actually already signed in as an admin —
   authStateReady/authRoleReady above will swap it out within a beat. */
showLoadingGate();