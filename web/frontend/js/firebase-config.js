// Firebase Console → Project settings → Your apps → Web app → SDK configuration.
// Public web configuration only. NEVER put a service-account private key here.
window.FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};
// For local automated tests only; keep false when connecting to a real project.
window.FIREBASE_EMULATORS = false;
