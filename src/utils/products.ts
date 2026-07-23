import { Product } from '../types';
import { INITIAL_PRODUCTS } from '../data/products';
import { db, auth } from './googleAuth';
import { collection, doc, setDoc, deleteDoc, onSnapshot, addDoc, getDoc, updateDoc, query, where, getDocs } from 'firebase/firestore';

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

export const PRODUCTS_CACHE_MAX_AGE = 5 * 1000; // 5 seconds

export const isProductsCacheExpired = (): boolean => {
  try {
    const storedTime = localStorage.getItem('yeng_products_timestamp');
    if (!storedTime) return true;
    return Date.now() - Number(storedTime) > PRODUCTS_CACHE_MAX_AGE;
  } catch (e) {
    return true;
  }
};

export const saveProductsToLocalStorage = (list: Product[]) => {
  try {
    localStorage.setItem('yeng_products', JSON.stringify(list));
    localStorage.setItem('yeng_products_timestamp', Date.now().toString());
  } catch (e) {
    console.error("Error setting products to localStorage:", e);
  }
};

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

// Map to keep track of product.id -> Firestore document ID
const productIdToDocIdMap = new Map<number, string>();

// Set up real-time listener to keep cachedProducts and localStorage in sync with Firestore
onSnapshot(collection(db, "products"), (snapshot) => {
  const list: Product[] = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    if (data) {
      let numericId = Number(data.id);
      if (isNaN(numericId) || !numericId) {
        numericId = Number(docSnap.id);
      }
      if (isNaN(numericId) || !numericId) {
        // Generate a stable unique numeric ID from the string docSnap.id
        let hash = 0;
        const str = docSnap.id;
        for (let i = 0; i < str.length; i++) {
          hash = (hash << 5) - hash + str.charCodeAt(i);
          hash |= 0;
        }
        numericId = Math.abs(hash);
      }
      data.id = numericId;
      productIdToDocIdMap.set(numericId, docSnap.id);
      list.push(data as Product);
    }
  });
  // Sort products by id descending
  list.sort((a, b) => Number(b.id) - Number(a.id));
  cachedProducts = list;
  saveProductsToLocalStorage(list);
  
  // Dispatch an update event so that any active React components can reactively update
  const event = new CustomEvent('yeng_products_updated', { detail: list });
  window.dispatchEvent(event);
}, (err) => {
  console.error("Error listening to products collection:", err);
  handleFirestoreError(err, OperationType.GET, "products");
});

export const getProducts = (): Product[] => {
  if (isProductsCacheExpired()) {
    console.log("[getProducts] Products cache expired, triggering background revalidation from DB server...");
    fetchProductsFromServer().catch(err => console.warn("Background revalidation of products failed:", err));
  }
  return cachedProducts;
};

// Fetch fresh products directly from server bypassing any cache (Cache-Busting)
export const fetchProductsFromServer = async (): Promise<Product[]> => {
  try {
    console.log("[fetchProductsFromServer] Fetching fresh products directly from Firestore client-side...");
    const snapshot = await getDocs(collection(db, "products"));
    const list: Product[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data) {
        let numericId = Number(data.id);
        if (isNaN(numericId) || !numericId) {
          numericId = Number(docSnap.id);
        }
        if (isNaN(numericId) || !numericId) {
          let hash = 0;
          const str = docSnap.id;
          for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0;
          }
          numericId = Math.abs(hash);
        }
        data.id = numericId;
        productIdToDocIdMap.set(numericId, docSnap.id);
        list.push(data as Product);
      }
    });

    if (list.length > 0) {
      // Sort products by id descending
      list.sort((a, b) => Number(b.id) - Number(a.id));
      cachedProducts = list;
      saveProductsToLocalStorage(list);

      // Dispatch update event
      const event = new CustomEvent('yeng_products_updated', { detail: list });
      window.dispatchEvent(event);
      console.log("[fetchProductsFromServer] Successfully updated products directly from Firestore client-side:", list.length);
      return list;
    }
  } catch (err) {
    console.warn("[fetchProductsFromServer] Direct Firestore read failed, falling back to server API...", err);
  }

  // Fallback to server API if direct client-side Firestore read fails
  try {
    const timestamp = Date.now();
    const response = await fetch(`/api/products?t=${timestamp}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    if (response.ok) {
      const list = await response.json();
      if (Array.isArray(list) && list.length > 0) {
        cachedProducts = list;
        saveProductsToLocalStorage(list);
        
        // Sync ID Map
        list.forEach((p: Product) => {
          if (p.id) {
            productIdToDocIdMap.set(Number(p.id), p.id.toString());
          }
        });

        // Dispatch update event
        const event = new CustomEvent('yeng_products_updated', { detail: list });
        window.dispatchEvent(event);
        console.log("[fetchProductsFromServer] Fallback successful. Updated products list from server API:", list.length);
        return list;
      }
    } else {
      console.warn("[fetchProductsFromServer] Fallback server API returned error status:", response.status);
    }
  } catch (err) {
    console.error("[fetchProductsFromServer] Fallback server API also failed:", err);
  }
  return cachedProducts;
};

// Auto background-revalidation on page focus or tab visibility change (SWR pattern)
if (typeof window !== 'undefined') {
  const triggerProductsRevalidation = () => {
    if (isProductsCacheExpired()) {
      console.log("[Products Revalidation] Window focused/visible and cache is stale. Fetching fresh products in background...");
      fetchProductsFromServer().catch(err => console.warn("Focus revalidation failed:", err));
    }
  };

  window.addEventListener('focus', triggerProductsRevalidation);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      triggerProductsRevalidation();
    }
  });
}

// Trigger an initial fetch from the server on boot
try {
  fetchProductsFromServer();
} catch (e) {
  console.error("Error doing initial boot fetch:", e);
}

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
    product.id = Number(product.id);
    if (!product.id || isNaN(product.id)) {
      // Assign a new ID based on current cached list safely filtering out non-numeric IDs
      const validIds = cachedProducts.map(p => Number(p?.id)).filter(id => !isNaN(id) && isFinite(id));
      const maxId = validIds.reduce((max, id) => id > max ? id : max, 0);
      product.id = maxId + 1;
    }
    
    // Find existing product in cache to merge unedited fields (e.g. stock, status, rating, etc.)
    const existingInCache = cachedProducts.find(p => Number(p.id) === Number(product.id)) || {};
    const mergedProduct = { ...existingInCache, ...product };
    
    // Recursive data sanitization to remove all undefined values for Firestore compatibility
    const sanitizedProduct = sanitizeData(mergedProduct);
    
    const docId = productIdToDocIdMap.get(product.id) || product.id.toString();
    const docRef = doc(db, "products", docId);
    await setDoc(docRef, sanitizedProduct, { merge: true });

    // Update memory cache safely and immediately
    const idx = cachedProducts.findIndex(p => Number(p.id) === Number(product.id));
    let nextProducts = [...cachedProducts];
    if (idx > -1) {
      nextProducts[idx] = mergedProduct as Product;
    } else {
      nextProducts.unshift(mergedProduct as Product);
    }
    cachedProducts = nextProducts;
    saveProductsToLocalStorage(nextProducts);

    // Dispatch custom event to notify React components instantly
    const event = new CustomEvent('yeng_products_updated', { detail: nextProducts });
    window.dispatchEvent(event);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `products/${product?.id}`);
  }
};

export const deleteProduct = async (productId: number): Promise<void> => {
  try {
    const docId = productIdToDocIdMap.get(productId) || productId.toString();
    const docRef = doc(db, "products", docId);
    await deleteDoc(docRef);

    // Update memory cache safely and immediately
    const nextProducts = cachedProducts.filter(p => Number(p.id) !== Number(productId));
    cachedProducts = nextProducts;
    saveProductsToLocalStorage(nextProducts);

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
    saveProductsToLocalStorage(INITIAL_PRODUCTS);

    // Dispatch custom event to notify React components instantly
    const event = new CustomEvent('yeng_products_updated', { detail: INITIAL_PRODUCTS });
    window.dispatchEvent(event);
  } catch (err) {
    console.error("Error resetting products in Firestore:", err);
    handleFirestoreError(err, OperationType.DELETE, "products");
  }
  return INITIAL_PRODUCTS;
};

/**
 * Thêm sản phẩm mới vào Firestore collection 'products' sử dụng addDoc theo chuẩn Firebase v9+
 * @param formData Đối tượng chứa thông tin sản phẩm từ form
 * @returns ID của document vừa tạo trong Firestore
 */
export const addProductWithAddDoc = async (formData: {
  name: string;
  price: number;
  image: string;
  category: string;
  stock: number;
  status: string;
  artist: string;
  pob: string;
  shortDescription: string;
  deadline: string;
  releaseDate: string;
  description: string;
}): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, "products"), {
      name: formData.name,
      price: Number(formData.price),
      image: formData.image || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800&q=80",
      category: formData.category,
      stock: Number(formData.stock),
      status: formData.status || "Còn hàng",
      artist: formData.artist || "",
      pob: formData.pob || "",
      shortDescription: formData.shortDescription || "",
      deadline: formData.deadline || "",
      releaseDate: formData.releaseDate || "",
      description: formData.description || "",
      createdAt: new Date().toISOString()
    });
    console.log("Document successfully written with ID: ", docRef.id);
    return docRef.id;
  } catch (err) {
    console.error("Error adding document to 'products' collection:", err);
    throw err;
  }
};

/**
 * Tìm phân loại/phiên bản đầu tiên khả dụng (còn hàng) cho sản phẩm
 */
export function resolveDefaultVersionForProduct(product: Product): string {
  // 1. Multi-tier variantMatrix
  if (product.attribute1Name && product.variantMatrix && product.variantMatrix.length > 0) {
    const availableMatrix = product.variantMatrix.find(v => v.stock === undefined || v.stock > 0);
    if (availableMatrix) {
      return availableMatrix.option2 
        ? `${availableMatrix.option1} - ${availableMatrix.option2}` 
        : availableMatrix.option1;
    }
  }

  // 2. Variations
  if (product.variations && product.variations.length > 0) {
    const availableVar = product.variations.find(v => v.stock === undefined || (v.stock !== undefined && v.stock > 0));
    if (availableVar) {
      return availableVar.name;
    }
    return product.variations[0].name;
  }

  // 3. Versions
  if (product.versions && product.versions.length > 0) {
    return product.versions[0];
  }

  return "";
}

/**
 * Lấy số lượng tồn kho khả dụng cho sản phẩm và phân loại cụ thể
 */
export function getProductStockForVersion(product: Product, version: string): number {
  if (!product) return 0;
  
  // Trạng thái chung là Hết hàng thì coi như bằng 0
  if (product.status === "Hết hàng") return 0;
  if (product.tag?.toLowerCase().trim() === 'sold_out' || 
      product.tag?.toLowerCase().trim() === 'sold out' || 
      product.tag?.toLowerCase().trim() === 'hết hàng') {
    return 0;
  }

  const targetVer = (version || "").trim().toLowerCase();

  // Case 1: Multi-tier variant (has variantMatrix)
  if (product.attribute1Name && product.variantMatrix && Array.isArray(product.variantMatrix) && product.variantMatrix.length > 0) {
    const matched = product.variantMatrix.find(v => {
      const combinedName = v.option2 ? `${v.option1} - ${v.option2}` : v.option1;
      return combinedName.trim().toLowerCase() === targetVer || v.option1.trim().toLowerCase() === targetVer;
    });
    if (matched) {
      return matched.stock !== undefined ? matched.stock : 0;
    }
    // If version is not matched but matrix exists
    return 0;
  }
  // Case 2: Simple variations list (variations)
  if (product.variations && Array.isArray(product.variations) && product.variations.length > 0) {
    const matched = product.variations.find(v => v.name.trim().toLowerCase() === targetVer);
    if (matched) {
      return matched.stock !== undefined ? matched.stock : 0;
    }
    return 0;
  }
  // Case 3: Base product
  return product.stock !== undefined ? product.stock : 0;
}

/**
 * Kiểm tra xem toàn bộ sản phẩm đã bị hết hàng hay chưa
 */
export function isProductSoldOut(product: Product): boolean {
  if (!product) return true;
  if (product.status === "Hết hàng") return true;
  if (product.tag?.toLowerCase().trim() === 'sold_out' || 
      product.tag?.toLowerCase().trim() === 'sold out' || 
      product.tag?.toLowerCase().trim() === 'hết hàng') {
    return true;
  }

  // 1. Multi-tier variantMatrix
  if (product.attribute1Name && product.variantMatrix && Array.isArray(product.variantMatrix) && product.variantMatrix.length > 0) {
    const totalStock = product.variantMatrix.reduce((sum, v) => sum + (v.stock !== undefined ? v.stock : 0), 0);
    return totalStock === 0;
  }

  // 2. Variations
  if (product.variations && Array.isArray(product.variations) && product.variations.length > 0) {
    const totalStock = product.variations.reduce((sum, v) => sum + (v.stock !== undefined ? v.stock : 0), 0);
    return totalStock === 0;
  }

  // 3. Base stock
  if (product.stock !== undefined) {
    return product.stock <= 0;
  }

  return false;
}

export async function deductProductStock(productId: number, version: string, quantityToDeduct: number): Promise<void> {
  try {
    console.log(`[Deduct Stock] Bắt đầu trừ kho: productId=${productId}, version="${version}", quantityToDeduct=${quantityToDeduct}`);
    
    let docRef = null;
    let product: Product | null = null;

    // 1. Tìm thông qua cache map trước (hỗ trợ cả kiểu number và kiểu string)
    const mappedDocId = productIdToDocIdMap.get(Number(productId)) || productIdToDocIdMap.get(productId as any);
    if (mappedDocId) {
      const testRef = doc(db, "products", mappedDocId);
      const testSnap = await getDoc(testRef);
      if (testSnap.exists()) {
        docRef = testRef;
        product = testSnap.data() as Product;
        console.log(`[Deduct Stock] Tìm thấy sản phẩm qua cached ID Map: "${product.name}" (docId: ${mappedDocId})`);
      }
    }

    // 2. Nếu map thất bại, truy vấn trực tiếp Firestore dựa trên trường "id" (cả định dạng number và string)
    if (!docRef) {
      console.log(`[Deduct Stock] Không tìm thấy qua ID Map. Đang truy vấn trực tiếp Firestore bằng field "id" = ${productId}...`);
      const qNum = query(collection(db, "products"), where("id", "==", Number(productId)));
      const qSnapNum = await getDocs(qNum);
      if (!qSnapNum.empty) {
        docRef = qSnapNum.docs[0].ref;
        product = qSnapNum.docs[0].data() as Product;
        console.log(`[Deduct Stock] Tìm thấy sản phẩm bằng truy vấn "id" (number): "${product.name}" (docId: ${docRef.id})`);
      } else {
        const qStr = query(collection(db, "products"), where("id", "==", String(productId)));
        const qSnapStr = await getDocs(qStr);
        if (!qSnapStr.empty) {
          docRef = qSnapStr.docs[0].ref;
          product = qSnapStr.docs[0].data() as Product;
          console.log(`[Deduct Stock] Tìm thấy sản phẩm bằng truy vấn "id" (string): "${product.name}" (docId: ${docRef.id})`);
        }
      }
    }

    // 3. Dự phòng cuối cùng: dùng productId làm Document ID trực tiếp
    if (!docRef) {
      const directRef = doc(db, "products", productId.toString());
      const directSnap = await getDoc(directRef);
      if (directSnap.exists()) {
        docRef = directRef;
        product = directSnap.data() as Product;
        console.log(`[Deduct Stock] Tìm thấy sản phẩm bằng Document ID trực tiếp: "${product.name}"`);
      }
    }

    if (!docRef || !product) {
      console.error(`[Deduct Stock] THẤT BẠI: Không thể tìm thấy tài liệu sản phẩm trong Firestore cho ID: ${productId}`);
      return;
    }

    // Tiến hành trừ kho sản phẩm
    let updatePayload: any = {};
    let totalStockRemaining = 0;

    // Phân tích các trường hợp sản phẩm có phân loại/biến thể
    // Case 1: Có ma trận thuộc tính (variantMatrix)
    if (product.variantMatrix && Array.isArray(product.variantMatrix) && product.variantMatrix.length > 0) {
      let updatedMatrix = [...product.variantMatrix];
      let matchedIdx = updatedMatrix.findIndex(v => {
        const combinedName = v.option2 ? `${v.option1} - ${v.option2}` : v.option1;
        return combinedName.trim().toLowerCase() === version.trim().toLowerCase();
      });
      
      if (matchedIdx > -1) {
        let currentStock = updatedMatrix[matchedIdx].stock !== undefined ? updatedMatrix[matchedIdx].stock! : 0;
        let nextStock = Math.max(0, currentStock - quantityToDeduct);
        updatedMatrix[matchedIdx] = {
          ...updatedMatrix[matchedIdx],
          stock: nextStock
        };
        updatePayload.variantMatrix = updatedMatrix;
        console.log(`[Deduct Stock] Đã khớp phân loại trong variantMatrix: "${version}". Kho cũ: ${currentStock} -> Kho mới: ${nextStock}`);
      } else {
        console.warn(`[Deduct Stock] Không tìm thấy phân loại khớp chính xác với "${version}" trong variantMatrix.`);
      }

      totalStockRemaining = updatedMatrix.reduce((sum, item) => sum + (item.stock !== undefined ? item.stock : 0), 0);
    } 
    // Case 2: Có danh sách phân loại đơn giản (variations)
    else if (product.variations && Array.isArray(product.variations) && product.variations.length > 0) {
      let updatedVariations = [...product.variations];
      let matchedIdx = updatedVariations.findIndex(v => 
        v.name.trim().toLowerCase() === version.trim().toLowerCase()
      );
      
      if (matchedIdx > -1) {
        let currentStock = updatedVariations[matchedIdx].stock !== undefined ? updatedVariations[matchedIdx].stock! : 0;
        let nextStock = Math.max(0, currentStock - quantityToDeduct);
        updatedVariations[matchedIdx] = {
          ...updatedVariations[matchedIdx],
          stock: nextStock
        };
        updatePayload.variations = updatedVariations;
        console.log(`[Deduct Stock] Đã khớp phân loại trong variations: "${version}". Kho cũ: ${currentStock} -> Kho mới: ${nextStock}`);
      } else {
        console.warn(`[Deduct Stock] Không tìm thấy phân loại khớp chính xác với "${version}" trong variations.`);
      }

      totalStockRemaining = updatedVariations.reduce((sum, item) => sum + (item.stock !== undefined ? item.stock : 0), 0);
    } 
    // Case 3: Sản phẩm cơ bản không phân loại
    else {
      let currentStock = product.stock !== undefined ? product.stock : 0;
      let nextStock = Math.max(0, currentStock - quantityToDeduct);
      updatePayload.stock = nextStock;
      totalStockRemaining = nextStock;
      console.log(`[Deduct Stock] Sản phẩm cơ bản. Kho cũ: ${currentStock} -> Kho mới: ${nextStock}`);
    }

    // Đồng thời cập nhật kho tổng của base product (nếu có trường stock chính) để đồng bộ thông tin
    if (product.stock !== undefined) {
      const currentBaseStock = product.stock;
      const nextBaseStock = Math.max(0, currentBaseStock - quantityToDeduct);
      updatePayload.stock = nextBaseStock;
    }

    // Cập nhật trạng thái "Hết hàng" nếu tổng số lượng tồn kho còn lại bằng 0
    let nextStatus = product.status;
    if (totalStockRemaining <= 0) {
      nextStatus = "Hết hàng";
      updatePayload.status = "Hết hàng";
    }
    
    console.log(`[Deduct Stock] Đang gửi yêu cầu updateDoc lên Firestore cho "${product.name}":`, updatePayload);
    await updateDoc(docRef, updatePayload);
    console.log(`[Deduct Stock] Cập nhật tồn kho THÀNH CÔNG cho "${product.name}".`);
  } catch (err) {
    console.error(`[Deduct Stock] LỖI khi trừ kho hàng của sản phẩm ID ${productId} (phân loại: ${version}):`, err);
    handleFirestoreError(err, OperationType.UPDATE, `products/${productId}`);
  }
}


