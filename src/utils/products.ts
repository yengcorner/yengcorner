import { Product } from '../types';
import { INITIAL_PRODUCTS } from '../data/products';
import { db, auth } from './googleAuth';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function sanitizeData(obj: any): any {
  if (obj === undefined) {
    return null;
  }
  if (obj === null) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => sanitizeData(item));
  }
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        sanitized[key] = sanitizeData(val);
      }
    }
    return sanitized;
  }
  return obj;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function convertToSlug(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9\s-]/g, "") // remove special characters
    .trim()
    .replace(/\s+/g, "-") // replace spaces with hyphens
    .replace(/-+/g, "-"); // remove double hyphens
}

// Memory cache of products
let cachedProducts: Product[] = [];

// Load cached products initially from localStorage if available as a synchronous fallback
try {
  const saved = localStorage.getItem('yeng_products');
  if (saved) {
    cachedProducts = JSON.parse(saved);
  } else {
    cachedProducts = INITIAL_PRODUCTS;
  }
} catch (e) {
  console.error("Error loading products cache:", e);
  cachedProducts = INITIAL_PRODUCTS;
}

// Set up real-time listener to keep cachedProducts and localStorage in sync with Firestore
onSnapshot(collection(db, "products"), (snapshot) => {
  const list: Product[] = [];
  snapshot.forEach((docSnap) => {
    list.push(docSnap.data() as Product);
  });
  // Sort products by id descending
  list.sort((a, b) => b.id - a.id);
  cachedProducts = list;
  localStorage.setItem('yeng_products', JSON.stringify(list));
  
  // Dispatch an update event so that any active React components can reactively update
  const event = new CustomEvent('yeng_products_updated', { detail: list });
  window.dispatchEvent(event);
}, (err) => {
  console.error("Error listening to products collection:", err);
  handleFirestoreError(err, OperationType.GET, "products");
});

export const getProducts = (): Product[] => {
  return cachedProducts;
};

export const subscribeProducts = (callback: (products: Product[]) => void) => {
  // Call immediately with current cache
  callback(cachedProducts);
  
  const handleUpdate = (e: any) => {
    callback(e.detail);
  };
  
  window.addEventListener('yeng_products_updated', handleUpdate);
  return () => {
    window.removeEventListener('yeng_products_updated', handleUpdate);
  };
};

export const saveProduct = async (product: Product): Promise<void> => {
  try {
    if (!product.id) {
      // Assign a new ID based on current cached list
      const maxId = cachedProducts.reduce((max, p) => p.id > max ? p.id : max, 0);
      product.id = maxId + 1;
    }
    
    // Recursive data sanitization to remove all undefined values for Firestore compatibility
    const sanitizedProduct = sanitizeData(product);
    
    const docRef = doc(db, "products", product.id.toString());
    await setDoc(docRef, sanitizedProduct);

    // Update memory cache immediately
    const idx = cachedProducts.findIndex(p => p.id === product.id);
    let nextProducts = [...cachedProducts];
    if (idx > -1) {
      nextProducts[idx] = product;
    } else {
      nextProducts.unshift(product);
    }
    cachedProducts = nextProducts;
    localStorage.setItem('yeng_products', JSON.stringify(nextProducts));

    // Dispatch custom event to notify React components instantly
    const event = new CustomEvent('yeng_products_updated', { detail: nextProducts });
    window.dispatchEvent(event);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `products/${product?.id}`);
  }
};

export const deleteProduct = async (productId: number): Promise<void> => {
  try {
    const docRef = doc(db, "products", productId.toString());
    await deleteDoc(docRef);

    // Update memory cache immediately
    const nextProducts = cachedProducts.filter(p => p.id !== productId);
    cachedProducts = nextProducts;
    localStorage.setItem('yeng_products', JSON.stringify(nextProducts));

    // Dispatch custom event to notify React components instantly
    const event = new CustomEvent('yeng_products_updated', { detail: nextProducts });
    window.dispatchEvent(event);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `products/${productId}`);
  }
};

export const resetProductsToDefault = async (): Promise<Product[]> => {
  try {
    for (const p of cachedProducts) {
      await deleteDoc(doc(db, "products", p.id.toString()));
    }
    cachedProducts = INITIAL_PRODUCTS;
    localStorage.setItem('yeng_products', JSON.stringify(INITIAL_PRODUCTS));

    // Dispatch custom event to notify React components instantly
    const event = new CustomEvent('yeng_products_updated', { detail: INITIAL_PRODUCTS });
    window.dispatchEvent(event);
  } catch (err) {
    console.error("Error resetting products in Firestore:", err);
    handleFirestoreError(err, OperationType.DELETE, "products");
  }
  return INITIAL_PRODUCTS;
};
