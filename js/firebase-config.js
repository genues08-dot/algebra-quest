// The Firebase project's web config. These values are public by design: what players can read
// and write is set by the rules in firestore.rules, not by keeping this file secret.
window.AQ_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBIDppApg-xsYWh3jjFeEauL8-T60Wn5cM',
  authDomain: 'algebra-quest1.firebaseapp.com',
  projectId: 'algebra-quest1',
  storageBucket: 'algebra-quest1.firebasestorage.app',
  messagingSenderId: '796009946632',
  appId: '1:796009946632:web:fa3940cefbe7858fe2fbbd'
};

// Usernames log in as "<username>@" this domain. firestore.rules checks the same domain, so the
// two must always match. It never changes, even if the project gets a custom domain.
window.AQ_LOGIN_DOMAIN = 'algebra-quest1.firebaseapp.com';
