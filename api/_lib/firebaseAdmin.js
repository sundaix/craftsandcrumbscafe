const admin = require('firebase-admin');

if(!admin.apps.length){
  if(!process.env.FIREBASE_SERVICE_ACCOUNT_KEY){
    console.error('FIREBASE_SERVICE_ACCOUNT_KEY is not set — see the setup comment at the top of this file.');
  } else {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
}

module.exports = admin;