import { initializeApp } from 'firebase/app';
import { getAuth, signInWithRedirect, signInWithPopup, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, User, signInAnonymously } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, Firestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { Product } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with standard getFirestore using the custom DB ID.
// This is more reliable inside iframes where third-party IndexedDB/persistent cache access may be restricted by sandbox policies.
const firestoreDbId = (firebaseConfig as any).firestoreDatabaseId;
export const db = getFirestore(app, firestoreDbId);

// Passive Guest/Anonymous sign-in to guarantee every visitor has a valid Auth ID for Firestore safety
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // If the admin already has a stored Google token, or is currently in the middle of a Google redirect sign-in,
    // do NOT run signInAnonymously(auth) as it will cancel the redirect result exchange or disconnect the admin session.
    const hasStoredToken = !!localStorage.getItem('yeng_gmail_access_token');
    const isSigningInGoogle = sessionStorage.getItem('yeng_signing_in_google') === 'true';
    if (hasStoredToken || isSigningInGoogle) {
      console.log("[GoogleAuth] Skipping passive anonymous sign-in to protect Admin/Gmail Google login flow.");
      return;
    }

    try {
      await signInAnonymously(auth);
      console.log("Đăng nhập ẩn danh thành công làm Khách");
    } catch (err) {
      console.warn("Lỗi đăng nhập ẩn danh tự động:", err);
    }
  } else {
    console.log("Người dùng hiện tại:", user.isAnonymous ? "Khách ẩn danh" : user.email);
  }
});

const provider = new GoogleAuthProvider();
// Request Workspace Gmail scopes (already requested and approved by user in the UI)
provider.addScope('https://mail.google.com/');
provider.addScope('https://www.googleapis.com/auth/gmail.send');
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
provider.addScope('https://www.googleapis.com/auth/gmail.compose');
provider.addScope('https://www.googleapis.com/auth/gmail.modify');

// Ask for offline access/refresh token and consent prompt if possible
provider.setCustomParameters({
  access_type: 'offline',
  prompt: 'consent'
});

// Flags and cache
let isSigningIn = false;
let cachedAccessToken: string | null = localStorage.getItem('yeng_gmail_access_token');

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: any, token: string) => void,
  onAuthFailure?: () => void
) => {
  const gmailDocRef = doc(db, "gmail", "config_YengCornerSecret_3bf8d79a29e4");

  // 1. Proactively check and notify if credentials already exist in localStorage (Instant load)
  const token = localStorage.getItem('yeng_gmail_access_token');
  const storedUser = localStorage.getItem('yeng_gmail_user');
  if (token && storedUser) {
    try {
      const parsedUser = JSON.parse(storedUser);
      if (onAuthSuccess) {
        onAuthSuccess(parsedUser, token);
      }
    } catch (e) {
      console.error('Error parsing stored user:', e);
    }
  }

  // 2. Self-healing synchronization: Proactively fetch Gmail and Google Sheets config from Firestore
  getDoc(gmailDocRef).then((docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data) {
        const urlToUse = data.googleSheetUrl || data.googleSheetsUrl;
        if (urlToUse) {
          const localSheetsUrl = localStorage.getItem('yeng_google_sheets_url');
          if (localSheetsUrl !== urlToUse) {
            localStorage.setItem('yeng_google_sheets_url', urlToUse);
          }
        }
        if (data.accessToken) {
          const localToken = localStorage.getItem('yeng_gmail_access_token');
          if (!localToken || localToken !== data.accessToken) {
            localStorage.setItem('yeng_gmail_access_token', data.accessToken);
            
            const mockUser = {
              email: data.email || "yengcorner@gmail.com",
              displayName: "Yeng Corner Admin",
              photoURL: data.photoURL || null,
              isAnonymous: false,
              uid: "admin_gmail_uid"
            };
            localStorage.setItem('yeng_gmail_user', JSON.stringify(mockUser));
            if (onAuthSuccess) {
              onAuthSuccess(mockUser, data.accessToken);
            }
          }
        }
      }
    }
  }).catch((err) => {
    console.error("Failed to restore Gmail token / Sheets URL from Firestore on initAuth:", err);
  });

  // 3. Handle redirect result from Google sign-in
  getRedirectResult(auth)
    .then(async (result) => {
      sessionStorage.removeItem('yeng_signing_in_google');
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
          const userObj = result.user;

          localStorage.setItem('yeng_gmail_access_token', cachedAccessToken);
          localStorage.setItem('yeng_gmail_user', JSON.stringify(userObj));

          // Save directly to Firestore for extreme session persistence across tabs and devices
          try {
            const snap = await getDoc(gmailDocRef);
            const existingData = snap.exists() ? snap.data() : {};
            await setDoc(gmailDocRef, {
              ...existingData,
              accessToken: cachedAccessToken,
              email: userObj.email || "yengcorner@gmail.com",
              updatedAt: new Date().toISOString()
            });
            console.log("Successfully synchronized Google access token to Firestore on redirect callback.");
          } catch (dbErr) {
            console.error("Failed to write token to Firestore from redirect result:", dbErr);
          }

          if (onAuthSuccess) {
            onAuthSuccess(userObj, cachedAccessToken);
          }
        }
      }
    })
    .catch((error) => {
      sessionStorage.removeItem('yeng_signing_in_google');
      console.error('Error handling redirect result:', error);
    });

  // 4. Standard auth state change listener (De-coupled from guest logins)
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && !user.isAnonymous) {
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
      // Fallback: If Firebase session has switched to an Anonymous Guest or Null (e.g. during checkout or refresh),
      // we do NOT log the admin out of the Gmail/Sheets admin interface.
      // We keep the Admin Gmail authentication state fully alive using localStorage credentials.
      const storedToken = localStorage.getItem('yeng_gmail_access_token');
      const storedUser = localStorage.getItem('yeng_gmail_user');
      if (storedToken && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          if (onAuthSuccess) onAuthSuccess(parsedUser, storedToken);
          return;
        } catch (e) {}
      }
      // Only trigger failure if there are absolutely no credentials at all
      const isSigningInGoogle = sessionStorage.getItem('yeng_signing_in_google') === 'true';
      if (!isSigningInGoogle && !storedToken) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<void> => {
  try {
    isSigningIn = true;
    sessionStorage.setItem('yeng_signing_in_google', 'true');

    // Check if we are running inside an iframe (like the AI Studio development environment preview)
    const isInIframe = window.self !== window.top;

    if (!isInIframe) {
      console.log("[GoogleAuth] Detected top-level window (Vercel/Direct). Using high-stability signInWithPopup...");
      const result = await signInWithPopup(auth, provider);
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
          const userObj = result.user;

          localStorage.setItem('yeng_gmail_access_token', cachedAccessToken);
          localStorage.setItem('yeng_gmail_user', JSON.stringify(userObj));

          const gmailDocRef = doc(db, "gmail", "config_YengCornerSecret_3bf8d79a29e4");
          try {
            const snap = await getDoc(gmailDocRef);
            const existingData = snap.exists() ? snap.data() : {};
            await setDoc(gmailDocRef, {
              ...existingData,
              accessToken: cachedAccessToken,
              email: userObj.email || "yengcorner@gmail.com",
              updatedAt: new Date().toISOString()
            });
            console.log("Successfully synchronized Google access token via popup directly to Firestore.");
          } catch (dbErr) {
            console.error("Failed to write token to Firestore from popup result:", dbErr);
          }
          // Reload the page or invoke callbacks to update UI
          window.location.reload();
          return;
        }
      }
    } else {
      console.log("[GoogleAuth] Detected iframe environment (AI Studio). Using signInWithRedirect...");
      await signInWithRedirect(auth, provider);
    }
  } catch (error: any) {
    console.error('Đăng nhập thất bại, đang chuyển hướng fallback:', error);
    try {
      console.log("[GoogleAuth] Fallback to signInWithRedirect...");
      await signInWithRedirect(auth, provider);
    } catch (fallbackErr) {
      console.error('Redirect fallback failed:', fallbackErr);
      sessionStorage.removeItem('yeng_signing_in_google');
      throw fallbackErr;
    }
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken || localStorage.getItem('yeng_gmail_access_token');
};

export const logout = async () => {
  try {
    await auth.signOut();
  } catch (e) {
    console.warn("Failed to sign out from Firebase auth:", e);
  }
  cachedAccessToken = null;
  localStorage.removeItem('yeng_gmail_access_token');
  localStorage.removeItem('yeng_gmail_user');
};

/**
 * Highly optimized HTML5 Canvas image compressor designed specifically to output ultra-lightweight but highly readable
 * images (~100KB-150KB) by recursively lowering quality and scale when needed, protecting Firestore quotas.
 */
export const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800, quality = 0.6): Promise<string> => {
  return new Promise((resolve) => {
    // If it is not a base64 string (e.g. standard unsplash/http URL), return immediately
    if (!base64Str || !base64Str.startsWith('data:image/')) {
      resolve(base64Str);
      return;
    }

    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Scale dimensions proportionally
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        
        let currentQuality = quality;
        let result = canvas.toDataURL('image/jpeg', currentQuality);
        
        // Iteratively reduce quality if file is still larger than ~150KB (approx 200,000 characters for base64) to ensure high readability
        while (result.length > 200000 && currentQuality > 0.1) {
          currentQuality -= 0.05;
          result = canvas.toDataURL('image/jpeg', currentQuality);
        }
        
        // If still too big, scale down further to guarantee it is under ~150KB
        if (result.length > 200000) {
          const smallCanvas = document.createElement('canvas');
          smallCanvas.width = Math.round(width * 0.7);
          smallCanvas.height = Math.round(height * 0.7);
          const sCtx = smallCanvas.getContext('2d');
          if (sCtx) {
            sCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
            result = smallCanvas.toDataURL('image/jpeg', 0.4);
          }
        }
        
        console.log(`[compressImage] Original: ${base64Str.length} chars, Compressed: ${result.length} chars (~${Math.round(result.length * 0.75 / 1024)} KB)`);
        resolve(result);
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

export const sanitizeProductForOrder = async (product: Product): Promise<Product> => {
  const leanProduct: Product = {
    id: product.id,
    name: product.name,
    price: product.price,
    image: product.image,
    category: product.category,
    artist: product.artist || "",
    orderDeadline: product.orderDeadline || "",
    releaseDate: product.releaseDate || "",
    stock: product.stock,
    status: product.status,
    tag: product.tag,
  };

  if (product.variantMatrix) {
    leanProduct.variantMatrix = product.variantMatrix.map(v => ({
      option1: v.option1,
      option2: v.option2,
      price: v.price,
      stock: v.stock
    }));
  }
  if (product.variations) {
    leanProduct.variations = product.variations.map(v => ({
      name: v.name,
      price: v.price,
      stock: v.stock
    }));
  }

  // Compress product image if it's base64 to save document space
  if (leanProduct.image && leanProduct.image.startsWith('data:image/')) {
    try {
      leanProduct.image = await compressImage(leanProduct.image, 100, 100, 0.5);
    } catch (e) {
      console.warn("Could not compress product base64 image:", e);
      leanProduct.image = leanProduct.image.slice(0, 1000);
    }
  }

  return leanProduct;
};
