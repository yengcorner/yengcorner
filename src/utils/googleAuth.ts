import { initializeApp } from 'firebase/app';
import { getAuth, signInWithRedirect, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, User, signInAnonymously } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, Firestore, doc, getDoc } from 'firebase/firestore';
import { Product } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with robust local offline caching to handle network fluctuations and iframe container isolation smoothly
let tempDb: Firestore;
const firestoreDbId = (firebaseConfig as any).firestoreDatabaseId;

try {
  tempDb = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, firestoreDbId);
} catch (error) {
  console.warn("Could not initialize Firestore with persistent cache, falling back to getFirestore:", error);
  try {
    tempDb = getFirestore(app, firestoreDbId);
  } catch (err2) {
    console.error("Failed to initialize Firestore with custom DB ID:", err2);
    tempDb = getFirestore(app);
  }
}

export const db = tempDb;

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

  // Self-healing synchronization: Proactively fetch Gmail and Google Sheets config from Firestore
  const gmailDocRef = doc(db, "gmail", "config_YengCornerSecret_3bf8d79a29e4");
  getDoc(gmailDocRef).then((docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data) {
        if (data.googleSheetsUrl) {
          const localSheetsUrl = localStorage.getItem('yeng_google_sheets_url');
          if (localSheetsUrl !== data.googleSheetsUrl) {
            localStorage.setItem('yeng_google_sheets_url', data.googleSheetsUrl);
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
            } as any;
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

  // Handle redirect result from Google sign-in
  getRedirectResult(auth)
    .then((result) => {
      sessionStorage.removeItem('yeng_signing_in_google');
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
      sessionStorage.removeItem('yeng_signing_in_google');
      console.error('Error handling redirect result:', error);
    });

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
      // If we are currently handling redirect result or are in middle of google login, do NOT wipe active session cache
      const isSigningInGoogle = sessionStorage.getItem('yeng_signing_in_google') === 'true';
      if (!isSigningInGoogle) {
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
    await signInWithRedirect(auth, provider);
  } catch (error: any) {
    console.error('Đăng nhập thất bại:', error);
    sessionStorage.removeItem('yeng_signing_in_google');
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

export const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800, quality = 0.6): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

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

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        try {
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        } catch (err) {
          console.warn("Lỗi khi toDataURL canvas, dùng base64 gốc:", err);
          resolve(base64Str);
        }
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
