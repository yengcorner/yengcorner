import { initializeApp } from 'firebase/app';
import { getAuth, signInWithRedirect, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, User, signInAnonymously } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, Firestore } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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

export const storage = getStorage(app);

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

export const dataURLtoBlob = (dataurl: string): Blob => {
  try {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (e) {
    console.error("Lỗi parse dataURLtoBlob:", e);
    throw e;
  }
};

export const uploadInvoiceImage = async (orderId: string, fileOrBase64: File | string): Promise<string> => {
  try {
    let blob: Blob;
    let fileName = `invoice_${orderId}.jpg`;

    if (fileOrBase64 instanceof File) {
      // If it's a raw File, we can read it, compress it first to ensure we aren't uploading multiple MBs
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(fileOrBase64);
      });
      const compressed = await compressImage(fileBase64);
      blob = dataURLtoBlob(compressed);
      fileName = fileOrBase64.name;
    } else {
      // It's a base64 string
      const compressed = await compressImage(fileOrBase64);
      blob = dataURLtoBlob(compressed);
    }

    const storageRef = ref(storage, `invoices/${orderId}_${Date.now()}_${fileName}`);
    const snapshot = await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error: any) {
    console.error("Lỗi khi tải ảnh lên Firebase Storage:", error);
    throw error;
  }
};

export const sanitizeProductForOrder = async (product: Product): Promise<Product> => {
  // Let's create a lean clone of the product to prevent bloating the order document
  const leanProduct: Product = {
    id: product.id,
    name: product.name,
    price: product.price,
    image: product.image, // We will compress this image if it is a base64 string
    category: product.category,
    artist: product.artist || "",
    orderDeadline: product.orderDeadline || "",
    releaseDate: product.releaseDate || "",
    stock: product.stock,
    status: product.status,
    tag: product.tag,
  };

  // If there is a variantMatrix or variations, keep them lean
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

  // Compress product image if it's a base64 string to tiny size (under 5KB)
  if (leanProduct.image && leanProduct.image.startsWith('data:image/')) {
    try {
      leanProduct.image = await compressImage(leanProduct.image, 100, 100, 0.5);
    } catch (e) {
      console.warn("Could not compress product image for order:", e);
    }
  }

  return leanProduct;
};
