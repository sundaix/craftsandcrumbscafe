const $ridGate = $('#ridGate');
const $ridLogin = $('#ridLoginScreen');
const $ridShell = $('#ridShell');
let riderAppBooted = false; // guards against re-running the initial data load on every future auth event
let riderAccessRechecked = false; // guards the one-time "double check before denying" grace period below

function showRiderLoginScreen(errorMsg){
  $ridGate.hide();
  $ridShell.hide();
  $ridLogin.show();
  if(errorMsg){
    $('#ridLoginError').text(errorMsg).addClass('show');
  } else {
    $('#ridLoginError').removeClass('show');
  }
}

function showRiderLoadingGate(){
  $ridLogin.hide();
  $ridShell.hide();
  $ridGate.show();
}

async function bootRiderApp(){
  $ridLogin.hide();
  $ridGate.hide();
  $ridShell.show();
  if(riderAppBooted) return; // already loaded once this session — just re-show the shell
  riderAppBooted = true;
  await window.CCRider.loadAll(); // from rider.js
}

document.addEventListener('authStateReady', function(e){
  if(!e.detail.user) showRiderLoginScreen();
});

document.addEventListener('authRoleReady', function(e){
  const { user, role, unknown } = e.detail;
  if(!user || user.isAnonymous){
    riderAccessRechecked = false; // fresh sign-in later gets its own grace check
    showRiderLoginScreen();
    return;
  }
  if(unknown){
    // See admin-boot.js's identical comment: auth.js couldn't confirm
    // the role yet (e.g. reconnecting after the tab sat inactive) —
    // that's not the same as "confirmed not a rider," so don't force
    // a logout here. Just wait for the next authRoleReady.
    if(!riderAppBooted) showRiderLoadingGate();
    return;
  }
  if(role !== 'rider'){
    if(!riderAccessRechecked){
      // First non-rider verdict for this sign-in — see admin-boot.js's
      // identical comment: the very first role read right after
      // logging in can land before Firestore is fully consistent,
      // coming back with a stale default instead of "unknown". Double
      // check once before showing "no access" — this is the ONLY
      // retry; a second non-rider verdict is treated as real.
      riderAccessRechecked = true;
      showRiderLoadingGate();
      window.CCAuth.recheckRole();
      return;
    }
    // TEMP DIAGNOSTIC
    console.warn('[rider-boot] role was', role, 'not rider (confirmed on recheck).');
    // See admin-boot.js's identical comment: admin/rider/customer
    // share one Firebase Auth session on this origin, so signOut()
    // here was killing every other open tab's session too — that was
    // the real "logged out after inactivity" cause. firestore.rules
    // already blocks a non-rider from doing anything real, so this
    // just shows the message instead of force-signing-out.
    showRiderLoginScreen('This account does not have rider access.');
    return;
  }
  riderAccessRechecked = true; // confirmed rider — no need to grace-check again this sign-in
  bootRiderApp();
});

$(document).on('submit', '#ridLoginForm', async function(e){
  e.preventDefault();
  const email = $('#ridLoginEmail').val().trim();
  const password = $('#ridLoginPassword').val();
  const $btn = $('#ridLoginSubmitBtn');
  $('#ridLoginError').removeClass('show');
  $btn.prop('disabled', true).text('Signing in...');
  try{
    await window.CCAuth.loginUser(email, password);
    // authRoleReady (above) takes it from here.
  } catch(err){
    console.error(err);
    const message = (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found')
      ? 'Incorrect email or password.'
      : 'Could not sign in. Please try again.';
    $('#ridLoginError').text(message).addClass('show');
  } finally {
    $btn.prop('disabled', false).text('Sign In');
  }
});

$(document).on('click', '#ridLogoutBtn', async function(){
  const ok = await showConfirm({
    title: 'Log out?',
    message: "You'll need to sign in again to access the rider app.",
    confirmText: 'Log Out'
  });
  if(!ok) return;
  riderAppBooted = false;
  riderAccessRechecked = false;
  await window.CCAuth.logoutUser();
});

showRiderLoadingGate();