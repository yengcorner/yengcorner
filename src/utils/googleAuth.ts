import { initializeApp } from 'firebase/app';
import { getAuth, signInWithRedirect, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with robust local offline caching to handle network fluctuations and iframe container isolation smoothly
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, (firebaseConfig as any).firestoreDatabaseId);

const provider = new GoogleAuthProvider();
// Request Workspace Gmail scopes (already requested and approved by user in the UI)
provider.addScope('https://mail.google.com/');
provider.addScope('https://www.googleapis.com/auth/gmail.send');
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
provider.addScope('https://www.googleapis.com/auth/gmail.compose');
provider.addScope('https://www.googleapis.com/auth/gmail.modify');

// Flags and cache
let isSigningIn = false;
let cachedAccessToken: string | null = localStorage.getItem('yeng_gmail_access_token');

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Proactively check and notify if credentials already exist in localStorage
  const token = localStorage.getItem('yeng_gmail_access_token');
  const storedUser = localStorage.getItem('yeng_gmail_user');
  if (token && storedUser) {
    try {
      const parsedUser = JSON.parse(storedUser) as User;
      if (onAuthSuccess) {
        onAuthSuccess(parsedUser, token);
      }
    } catch (e) {
      console.error('Error parsing stored user:', e);
    }
  }

  // Handle redirect result from Google sign-in
  getRedirectResult(auth)
    .then((result) => {
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
          localStorage.setItem('yeng_gmail_access_token', cachedAccessToken);
          localStorage.setItem('yeng_gmail_user', JSON.stringify(result.user));
          if (onAuthSuccess) {
            onAuthSuccess(result.user, credential.accessToken);
          }
        }
      }
    })
    .catch((error) => {
      console.error('Error handling redirect result:', error);
    });

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const storedToken = localStorage.getItem('yeng_gmail_access_token');
      if (storedToken) {
        cachedAccessToken = storedToken;
        if (onAuthSuccess) onAuthSuccess(user, storedToken);
      } else if (cachedAccessToken) {
        localStorage.setItem('yeng_gmail_access_token', cachedAccessToken);
        localStorage.setItem('yeng_gmail_user', JSON.stringify(user));
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      // Fallback to localStorage session even if Firebase's standard session is still initializing
      const storedToken = localStorage.getItem('yeng_gmail_access_token');
      const storedUser = localStorage.getItem('yeng_gmail_user');
      if (storedToken && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser) as User;
          if (onAuthSuccess) onAuthSuccess(parsedUser, storedToken);
          return;
        } catch (e) {}
      }
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<void> => {
  try {
    isSigningIn = true;
    await signInWithRedirect(auth, provider);
  } catch (error: any) {
    console.error('Đăng nhập thất bại:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken || localStorage.getItem('yeng_gmail_access_token');
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  localStorage.removeItem('yeng_gmail_access_token');
  localStorage.removeItem('yeng_gmail_user');
};
