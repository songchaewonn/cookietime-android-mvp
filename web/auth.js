(() => {
  const config = window.COOKIE_TIME_FIREBASE_CONFIG || {};
  const configured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
  const api = {
    currentUser: null,
    isConfigured: () => configured,
    async signIn() {
      if (!configured) throw new Error('Firebase web configuration is missing.');
      if (!window.firebase?.auth) throw new Error('Firebase Authentication SDK is unavailable.');
      const auth = window.firebase.auth();
      const provider = new window.firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await auth.signInWithPopup(provider);
      } catch (error) {
        if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(error.code)) {
          await auth.signInWithRedirect(provider);
          return;
        }
        throw error;
      }
    },
    async signOut() {
      if (window.firebase?.auth && configured) await window.firebase.auth().signOut();
    }
  };

  window.CookieAuth = api;
  if (!configured) return;
  const initialize = () => {
    if (!window.firebase?.auth) return false;
    if (!window.firebase.apps.length) window.firebase.initializeApp(config);
    window.firebase.auth().onAuthStateChanged(user => {
      api.currentUser = user;
      document.dispatchEvent(new CustomEvent('cookietime-auth-change', {
        detail: { user: user ? { uid: user.uid, displayName: user.displayName, email: user.email, photoURL: user.photoURL } : null }
      }));
    });
    return true;
  };
  if (!initialize()) {
    document.addEventListener('DOMContentLoaded', () => {
      if (!initialize()) console.error('Firebase Authentication SDK did not load.');
    }, { once: true });
  }
})();
