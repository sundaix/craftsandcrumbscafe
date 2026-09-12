/* =========================================================
   Crafts & Crumbs — admin-boot.js
   Bootstraps the standalone admin app: shows a login screen (using
   CCAuth.loginUser from auth.js — the same generic function the
   customer site uses, just without the OTP/anonymous-guest machinery
   layered around it there), checks the signed-in account's role, and
   only then loads the catalog data + renders the dashboard.

   Auth state itself is still whatever auth.js already provides
   (onAuthStateChanged + the authRoleReady custom event) — this file
   doesn't duplicate that, it just reacts to it.
========================================================= */

const $gate = $('#admGate');
const $login = $('#admLoginScreen');
const $shell = $('#admShell');
let dashboardBooted = false; // guards against re-running the initial data load on every future auth event

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
  const { user, role } = e.detail;
  if(!user || user.isAnonymous){
    showLoginScreen();
    return;
  }
  if(role !== 'admin'){
    // Signed in, but not an admin account — don't leave them signed
    // in on this app at all, since there's nothing here for a
    // customer account to do.
    window.CCAuth.logoutUser();
    showLoginScreen('This account does not have admin access.');
    return;
  }
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
  await window.CCAuth.logoutUser();
});

/* Shows the loading gate immediately so there's no flash of the login
   form for someone who's actually already signed in as an admin —
   authStateReady/authRoleReady above will swap it out within a beat. */
showLoadingGate();