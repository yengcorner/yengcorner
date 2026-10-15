import { OrderPayload, CartItem, Product, Coupon, ORDER_STATUSES, OrderStatus } from '../types';
import { INITIAL_PRODUCTS } from '../data/products';
import { db, compressImage, sanitizeProductForOrder } from './googleAuth';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

// Tự động chuẩn hóa và chuyển đổi trạng thái cũ (ví dụ "Đã có mã vận đơn") thành "Đã về HCM"
export function normalizeOrderStatus(status?: string): string {
  if (!status) return "Chờ xác nhận";
  if (status === "Đã có mã vận đơn" || status === "Đã về Sài Gòn") {
    return "Đã về HCM";
  }
  return status;
}

// Helper to generate some high-fidelity mock orders for first-time administration view
const getInitialMockOrders = (): OrderPayload[] => {
  const pNct = INITIAL_PRODUCTS.find(p => p.id === 1) || INITIAL_PRODUCTS[0];
  const pAespa = INITIAL_PRODUCTS.find(p => p.id === 2) || INITIAL_PRODUCTS[1];
  const pJacket = INITIAL_PRODUCTS.find(p => p.id === 3) || INITIAL_PRODUCTS[2];
  const pIllit = INITIAL_PRODUCTS.find(p => p.id === 5) || INITIAL_PRODUCTS[4];

  return [
    {
      id: "YENG8431",
      status: "Đã xác nhận",
      items: [
        {
          product: pNct,
          quantity: 2,
          version: pNct.versions ? pNct.versions[1] : "Standard Version"
        }
      ],
      subtotal: pNct.price * 2,
      contact: {
        email: "nguyenha99@gmail.com",
        snsLink: "fb.com/ha.nguyen.nctzen"
      },
      payment: {
        method: "Cọc 50%",
        invoiceImage: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=400&q=80"
      },
      shipping: {
        receiverName: "Nguyễn Thị Hà",
        phone: "0912345678",
        address: "128/4 Lê Văn Sỹ, Phường 13, Quận Phú Nhuận, TP. Hồ Chí Minh",
        method: "GHTK"
      },
      note: "Gói xốp nổ bọc dày chống df giúp mình nha shop iu!",
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 1 day ago
    },
    {
      id: "YENG1940",
      status: "Đã xác nhận",
      items: [
        {
          product: pJacket,
          quantity: 1,
          version: "Size M (Black)"
        }
      ],
      subtotal: pJacket.price,
      contact: {
        email: "khangtran.kstyle@gmail.com",
        snsLink: "instagram.com/khang_jennie_stan"
      },
      payment: {
        method: "Thanh toán 100%",
        invoiceImage: "https://images.unsplash.com/photo-1628157582853-a796fa650a6a?w=400&q=80"
      },
      shipping: {
        receiverName: "Trần Minh Khang",
        phone: "0987654321",
        address: "Số 15 Ngõ 82, Chùa Láng, Đống Đa, Hà Nội",
        method: "SPX"
      },
      note: "Hàng về hoãn giao đến đầu tháng giúp mình do đi công tác.",
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days ago
    },
    {
      id: "YENG4712",
      status: "Đã về HCM",
      items: [
        {
          product: pAespa,
          quantity: 1,
          version: "Supernova Ver. (Spark)"
        },
        {
          product: pIllit,
          quantity: 1,
          version: "Màu Đen (Carbon Black)"
        }
      ],
      subtotal: pAespa.price + pIllit.price,
      contact: {
        email: "thaonguyen.aespa@yahoo.com",
        snsLink: "t.me/thaonguyenbunny"
      },
      payment: {
        method: "Thanh toán 100%",
        invoiceImage: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=400&q=80"
      },
      shipping: {
        receiverName: "Lê Thảo Nguyên",
        phone: "0356123456",
        address: "Chung cư Sunrise City, Nguyễn Hữu Thọ, Quận 7, TP. Hồ Chí Minh",
        method: "Viettel Post"
      },
      note: "Hàng có quà pre-order đầy đủ đúng không ạ?",
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days ago
    }
  ];
};

export const STORAGE_KEY = 'yeng_corner_orders_v1';
export const LEGACY_STORAGE_KEY = 'yeng_orders';

const ORDERS_CACHE_MAX_AGE = 5 * 1000; // 5 seconds

export const isOrdersCacheExpired = (): boolean => {
  try {
    const storedTime = localStorage.getItem(STORAGE_KEY + '_timestamp');
    if (!storedTime) return true;
    return Date.now() - Number(storedTime) > ORDERS_CACHE_MAX_AGE;
  } catch (e) {
    return true;
  }
};

// Internal synchronous reader for raw orders in localStorage without triggering mocks
function getOrdersFromLocalSyncRaw(): OrderPayload[] {
  try {
    const map = new Map<string, OrderPayload>();
    // Check both STORAGE_KEY ('yeng_corner_orders_v1') and LEGACY_STORAGE_KEY ('yeng_orders')
    const raw1 = localStorage.getItem(STORAGE_KEY);
    if (raw1) {
      const parsed1 = JSON.parse(raw1);
      if (Array.isArray(parsed1)) {
        parsed1.forEach((ord: any) => {
          if (ord && ord.id) map.set(ord.id, ord);
        });
      }
    }
    const raw2 = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw2) {
      const parsed2 = JSON.parse(raw2);
      if (Array.isArray(parsed2)) {
        parsed2.forEach((ord: any) => {
          if (ord && ord.id && !map.has(ord.id)) map.set(ord.id, ord);
        });
      }
    }
    return Array.from(map.values()).map(ord => ({
      ...ord,
      status: normalizeOrderStatus(ord.status)
    }));
  } catch (e) {
    return [];
  }
}

// Synchronous local orders getter with safe fallback to mock orders
export function getOrdersFromLocalSync(): OrderPayload[] {
  const existing = getOrdersFromLocalSyncRaw();
  if (existing.length > 0) {
    existing.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return existing;
  }
  const initial = getInitialMockOrders();
  saveOrdersToLocalStorage(initial);
  return initial;
}

/**
 * Sinh mã đơn hàng duy nhất có định dạng YENGXXXX (với 4 chữ số ngẫu nhiên từ 1000 đến 9999).
 * Luôn đối chiếu toàn diện với danh sách đơn hàng trong state và localStorage (cả 2 key yeng_orders & yeng_corner_orders_v1)
 * để đảm bảo tuyệt đối không trùng lặp mã đơn hàng cũ.
 */
export function generateUniqueOrderId(existingOrders?: OrderPayload[], prefix: string = "YENG"): string {
  const existingIds = new Set<string>();

  // 1. Quét danh sách truyền vào
  if (Array.isArray(existingOrders)) {
    existingOrders.forEach(o => {
      if (o && o.id) existingIds.add(String(o.id).trim().toUpperCase());
    });
  }

  // 2. Quét các đơn hàng đang lưu trữ trong localStorage (cả 2 key)
  const localExisting = getOrdersFromLocalSyncRaw();
  localExisting.forEach(o => {
    if (o && o.id) existingIds.add(String(o.id).trim().toUpperCase());
  });

  // 3. Vòng lặp sinh số 4 chữ số ngẫu nhiên (1000 - 9999) và kiểm tra chống trùng lặp
  let newId = "";
  let attempts = 0;
  const maxAttempts = 10000;

  while (attempts < maxAttempts) {
    attempts++;
    const randomNum = Math.floor(1000 + Math.random() * 9000); // 4 chữ số ngẫu nhiên
    const candidateId = `${prefix}${randomNum}`.toUpperCase();
    if (!existingIds.has(candidateId)) {
      newId = candidateId;
      break;
    }
  }

  // Dự phòng an toàn nếu toàn bộ 9000 số 4 chữ số đã được sử dụng
  if (!newId) {
    newId = `${prefix}${Math.floor(10000 + Math.random() * 90000)}`;
  }

  return newId;
}

export const saveOrdersToLocalStorage = (list: OrderPayload[], allowEmpty: boolean = false) => {
  try {
    if (!Array.isArray(list)) return;
    
    // BẢO VỆ CHỐNG MẤT ĐƠN HÀNG: Nếu mảng lưu truyền vào rỗng nhưng trong localStorage đã có đơn hàng
    // thì tuyệt đối KHÔNG ĐƯỢC ghi đè làm mất đơn hàng cũ (trừ khi cố ý xóa hết có cờ allowEmpty)
    if (list.length === 0 && !allowEmpty) {
      const existing = getOrdersFromLocalSyncRaw();
      if (existing.length > 0) {
        console.warn("[Orders Protection] Từ chối ghi đè mảng rỗng vào localStorage vì đang có", existing.length, "đơn hàng hiện hữu.");
        return;
      }
    }

    const jsonStr = JSON.stringify(list);
    // Đồng bộ đồng thời vào cả 2 key để tương thích 100% với yeng_orders và yeng_corner_orders_v1
    localStorage.setItem(STORAGE_KEY, jsonStr);
    localStorage.setItem(LEGACY_STORAGE_KEY, jsonStr);
    localStorage.setItem(STORAGE_KEY + '_timestamp', Date.now().toString());
  } catch (e) {
    console.error("Error setting orders to localStorage:", e);
  }
};

// Auto background-revalidation on page focus or tab visibility change (SWR pattern)
if (typeof window !== 'undefined') {
  const triggerOrdersRevalidation = () => {
    if (isOrdersCacheExpired()) {
      console.log("[Orders Revalidation] Window focused/visible and orders cache is stale. Fetching fresh orders in background...");
      getOrders().catch(err => console.warn("Focus orders revalidation failed:", err));
    }
  };

  window.addEventListener('focus', triggerOrdersRevalidation);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      triggerOrdersRevalidation();
    }
  });
}

export function slugify(text: string): string {
  if (!text) return 'unknown';
  const from = "àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ";
  const to   = "aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd";
  let str = text.toLowerCase().trim();
  for (let i = 0; i < from.length; i++) {
    str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
  }
  return str
    .replace(/[^a-z0-9_\s-]/g, "") // remove invalid chars
    .replace(/[\s-]+/g, "_")      // replace spaces/hyphens with underscore
    .replace(/^_+|_+$/g, "");     // trim underscores
}

export function syncAllProductSpecificOrders(): void {
  try {
    // Clear old orders_ prefixed keys to free up localStorage quota immediately
    // Giữ an toàn tuyệt đối cho STORAGE_KEY và LEGACY_STORAGE_KEY
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith("orders_") && key !== STORAGE_KEY && key !== LEGACY_STORAGE_KEY) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {
    console.error("Lỗi dọn dẹp chi tiết sản phẩm:", e);
  }
}

// Internal localStorage helper to avoid nested getOrders() recursion
async function getOrdersLocalFallback(): Promise<OrderPayload[]> {
  try {
    const existing = getOrdersFromLocalSyncRaw();
    if (existing.length > 0) {
      return existing;
    }
    const mock = getInitialMockOrders();
    saveOrdersToLocalStorage(mock);
    return mock;
  } catch (e) {
    return getInitialMockOrders();
  }
}

export async function getOrders(forceRefresh: boolean = false): Promise<OrderPayload[]> {
  const localList = await getOrdersLocalFallback();

  if (!forceRefresh && !isOrdersCacheExpired()) {
    console.log("[getOrders] Orders cache is fresh, returning local cache.");
    if (localList.length > 0) {
      localList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return localList;
    }
  }

  // Fetch directly from Firestore client-side first (ultra fast and authorized)
  try {
    console.log("[getOrders] Fetching fresh orders directly from Firestore client-side...");
    const q = collection(db, 'orders');
    const querySnapshot = await getDocs(q);
    const firestoreList: OrderPayload[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as OrderPayload;
      if (data) {
        firestoreList.push({
          ...data,
          id: data.id || docSnap.id,
          status: normalizeOrderStatus(data.status)
        });
      }
    });
    
    // HỢP NHẤT THÔNG MINH: Giữ toàn bộ đơn hàng hiện có ở máy cục bộ và cập nhật thêm/mới từ Firestore
    const orderMap = new Map<string, OrderPayload>();
    localList.forEach(ord => {
      if (ord && ord.id) orderMap.set(ord.id, ord);
    });
    firestoreList.forEach(ord => {
      if (ord && ord.id) orderMap.set(ord.id, ord);
    });

    const mergedList = Array.from(orderMap.values());
    mergedList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Đồng bộ vào localStorage cache (cả 2 key)
    if (mergedList.length > 0) {
      saveOrdersToLocalStorage(mergedList);
    }

    // Tự động sao lưu ngầm các đơn hàng chỉ có ở máy cục bộ lên Firestore để bảo lưu vĩnh viễn trên đám mây
    if (firestoreList.length > 0) {
      const firestoreIds = new Set(firestoreList.map(o => o.id));
      const unsynced = localList.filter(o => o && o.id && !firestoreIds.has(o.id));
      if (unsynced.length > 0) {
        console.log(`[Order Sync] Tự động đồng bộ ${unsynced.length} đơn hàng cũ từ máy lên Firestore...`);
        unsynced.forEach(ord => {
          const docRef = doc(db, 'orders', ord.id);
          setDoc(docRef, cleanUndefined(ord)).catch(err => console.warn("Lỗi sync ngầm Firestore:", err));
        });
      }
    } else if (localList.length > 0) {
      console.log(`[Order Sync] Firestore rỗng, đồng bộ toàn bộ ${localList.length} đơn hàng từ máy lên Firestore...`);
      localList.forEach(ord => {
        const docRef = doc(db, 'orders', ord.id);
        setDoc(docRef, cleanUndefined(ord)).catch(err => console.warn("Lỗi sync ngầm Firestore:", err));
      });
    }

    console.log("[getOrders] Successfully fetched & merged orders:", mergedList.length);
    return mergedList;
  } catch (err) {
    console.warn("[getOrders] Direct Firestore client fetch failed, falling back to server API...", err);
  }

  // Fallback to server API if direct client-side Firestore read fails
  try {
    const timestamp = Date.now();
    const response = await fetch(`/api/orders?t=${timestamp}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    if (response.ok) {
      const list = await response.json();
      if (Array.isArray(list)) {
        const normalizedList = list.map((ord: OrderPayload) => ({
          ...ord,
          status: normalizeOrderStatus(ord.status)
        }));
        
        const orderMap = new Map<string, OrderPayload>();
        localList.forEach(ord => {
          if (ord && ord.id) orderMap.set(ord.id, ord);
        });
        normalizedList.forEach((ord: OrderPayload) => {
          if (ord && ord.id) orderMap.set(ord.id, ord);
        });

        const mergedList = Array.from(orderMap.values());
        mergedList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        saveOrdersToLocalStorage(mergedList);
        return mergedList;
      }
    }
  } catch (err) {
    console.warn("[getOrders] Failed to fetch from fallback server API:", err);
  }

  // Final fallback to localStorage if everything fails
  localList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return localList;
}

export function listenToOrders(callback: (orders: OrderPayload[]) => void): () => void {
  let isMounted = true;

  // Run initial fetch
  getOrders().then(list => {
    if (isMounted) {
      callback(list);
    }
  }).catch(err => {
    console.warn("listenToOrders initial load fallback:", err);
  });

  // Poll orders periodically without WebChannel connection
  const intervalId = setInterval(() => {
    getOrders().then(list => {
      if (isMounted) {
        callback(list);
      }
    }).catch(() => {});
  }, 10000);

  return () => {
    isMounted = false;
    clearInterval(intervalId);
  };
}

// Helper to recursively remove all undefined values from an object/array for Firestore safety
export function cleanUndefined<T>(obj: T): T {
  if (obj === undefined) {
    return "" as unknown as T;
  }
  if (obj === null) {
    return null as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = obj[key];
        if (val === undefined) {
          // Omit undefined properties entirely
          continue;
        }
        cleaned[key] = cleanUndefined(val);
      }
    }
    return cleaned as T;
  }
  return obj;
}

export async function saveOrder(order: OrderPayload): Promise<void> {
  try {
    // Failsafe sanitization right before writing to Firestore
    const sanitizedOrder = { ...order };
    
    // 1. Sanitize product items
    if (sanitizedOrder.items && sanitizedOrder.items.length > 0) {
      const sanitizedItems = await Promise.all(
        sanitizedOrder.items.map(async (item) => {
          if (item.product) {
            return {
              ...item,
              product: await sanitizeProductForOrder(item.product)
            };
          }
          return item;
        })
      );
      sanitizedOrder.items = sanitizedItems;
    }

    // 2. Double-check and compress invoice image locally if it's still uncompressed base64
    if (sanitizedOrder.payment && sanitizedOrder.payment.invoiceImage && sanitizedOrder.payment.invoiceImage.startsWith('data:image/')) {
      try {
        sanitizedOrder.payment.invoiceImage = await compressImage(sanitizedOrder.payment.invoiceImage, 800, 800, 0.6);
      } catch (err) {
        console.warn("Could not compress invoiceImage in saveOrder failsafe:", err);
      }
    }

    // 3. Clean all undefined fields recursively to prevent any Firestore crash
    const finalCleanedOrder = cleanUndefined(sanitizedOrder);

    const docRef = doc(db, 'orders', finalCleanedOrder.id);
    await setDoc(docRef, finalCleanedOrder);

    // Kích hoạt đồng bộ hóa hóa đơn sang Google Sheets & gửi Gmail qua server (Đảm bảo hoạt động trên Serverless như Vercel)
    try {
      console.log("[Order Sync] Đang yêu cầu máy chủ đồng bộ hóa đơn hàng...");
      const res = await fetch('/api/orders/notify-new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: finalCleanedOrder })
      });
      if (res.ok) {
        const resData = await res.json();
        console.log("[Order Sync] Đồng bộ hóa từ máy chủ thành công:", resData);
      } else {
        console.warn("[Order Sync] Máy chủ trả về mã lỗi:", res.status);
      }
    } catch (err: any) {
      console.error("[Order Sync] Không thể gọi API đồng bộ hóa trên máy chủ:", err.message);
    }

    // Lưu vào localStorage cache
    try {
      const currentOrders = await getOrdersLocalFallback();
      const updatedOrders = [finalCleanedOrder, ...currentOrders.filter(o => o.id !== finalCleanedOrder.id)];
      saveOrdersToLocalStorage(updatedOrders);
      syncAllProductSpecificOrders();
    } catch (e) {}
  } catch (e: any) {
    console.error("Lỗi ghi order vào Firestore:", e);
    alert("Lỗi lưu đơn: " + (e.message || String(e)));
    // Ghi local cache làm cứu cánh
    try {
      const currentOrders = await getOrdersLocalFallback();
      const updatedOrders = [order, ...currentOrders.filter(o => o.id !== order.id)];
      saveOrdersToLocalStorage(updatedOrders);
      syncAllProductSpecificOrders();
    } catch (err) {}
    throw e; // Throw so that CheckoutPage is aware
  }
}

export async function updateOrderStatus(orderId: string, status: string): Promise<OrderPayload[]> {
  const normalizedStatus = normalizeOrderStatus(status);
  try {
    const docRef = doc(db, 'orders', orderId);
    await updateDoc(docRef, { status: normalizedStatus });
    return await getOrders();
  } catch (e) {
    console.error("Lỗi cập nhật trạng thái đơn hàng trên Firestore:", e);
    try {
      const currentOrders = await getOrdersLocalFallback();
      const updated = currentOrders.map(ord => 
        ord.id === orderId ? { ...ord, status: normalizedStatus } : ord
      );
      saveOrdersToLocalStorage(updated);
      syncAllProductSpecificOrders();
      return updated;
    } catch (err) {}
    return [];
  }
}

export async function updateOrderStatusAndPaidAmount(orderId: string, status: string, paidAmount: number): Promise<OrderPayload[]> {
  const normalizedStatus = normalizeOrderStatus(status);
  try {
    const docRef = doc(db, 'orders', orderId);
    await updateDoc(docRef, { status: normalizedStatus, paidAmount });
    return await getOrders();
  } catch (e) {
    console.error("Lỗi cập nhật trạng thái và số tiền đã thanh toán trên Firestore:", e);
    try {
      const currentOrders = await getOrdersLocalFallback();
      const updated = currentOrders.map(ord => 
        ord.id === orderId ? { ...ord, status: normalizedStatus, paidAmount } : ord
      );
      saveOrdersToLocalStorage(updated);
      syncAllProductSpecificOrders();
      return updated;
    } catch (err) {}
    return [];
  }
}

export async function updateOrderTrackingCode(orderId: string, trackingCode: string, newStatus?: string): Promise<OrderPayload[]> {
  try {
    const docRef = doc(db, 'orders', orderId);
    const updateData: any = { trackingCode };
    if (newStatus !== undefined) {
      updateData.status = normalizeOrderStatus(newStatus);
    }
    await updateDoc(docRef, updateData);
    return await getOrders();
  } catch (e) {
    console.error("Lỗi cập nhật mã vận đơn trên Firestore:", e);
    try {
      const currentOrders = await getOrdersLocalFallback();
      const updated = currentOrders.map(ord => {
        if (ord.id === orderId) {
          const finalStatus = newStatus !== undefined 
            ? normalizeOrderStatus(newStatus) 
            : normalizeOrderStatus(ord.status);
          return { ...ord, trackingCode, status: finalStatus };
        }
        return ord;
      });
      saveOrdersToLocalStorage(updated);
      syncAllProductSpecificOrders();
      return updated;
    } catch (err) {}
    return [];
  }
}

export async function updateOrderPaidAmount(orderId: string, paidAmount: number): Promise<OrderPayload[]> {
  try {
    const docRef = doc(db, 'orders', orderId);
    await updateDoc(docRef, { paidAmount });
    return await getOrders();
  } catch (e) {
    console.error("Lỗi cập nhật số tiền đã thanh toán trên Firestore:", e);
    try {
      const currentOrders = await getOrdersLocalFallback();
      const updated = currentOrders.map(ord => 
        ord.id === orderId ? { ...ord, paidAmount } : ord
      );
      saveOrdersToLocalStorage(updated);
      syncAllProductSpecificOrders();
      return updated;
    } catch (err) {}
    return [];
  }
}

export async function updateBulkOrdersTracking(updates: { orderId: string; trackingCode: string; status?: string }[]): Promise<OrderPayload[]> {
  try {
    const promises = updates.map(async (u) => {
      const docRef = doc(db, 'orders', u.orderId);
      const dataToUpdate: any = { trackingCode: u.trackingCode };
      if (u.status !== undefined) {
        dataToUpdate.status = normalizeOrderStatus(u.status);
      }
      return updateDoc(docRef, dataToUpdate);
    });
    await Promise.all(promises);
    return await getOrders();
  } catch (e) {
    console.error("Lỗi cập nhật hàng loạt mã vận đơn trên Firestore:", e);
    try {
      const currentOrders = await getOrdersLocalFallback();
      const updated = currentOrders.map(ord => {
        const match = updates.find(u => u.orderId === ord.id);
        if (match) {
          return { 
            ...ord, 
            trackingCode: match.trackingCode,
            status: match.status !== undefined ? normalizeOrderStatus(match.status) : normalizeOrderStatus(ord.status) 
          };
        }
        return ord;
      });
      saveOrdersToLocalStorage(updated);
      syncAllProductSpecificOrders();
      return updated;
    } catch (err) {}
    return [];
  }
}

export async function deleteOrder(orderId: string): Promise<OrderPayload[]> {
  try {
    const docRef = doc(db, 'orders', orderId);
    await deleteDoc(docRef);
    return await getOrders();
  } catch (e) {
    console.error("Lỗi xóa đơn hàng trên Firestore:", e);
    try {
      const currentOrders = await getOrdersLocalFallback();
      const updated = currentOrders.filter(ord => ord.id !== orderId);
      saveOrdersToLocalStorage(updated);
      syncAllProductSpecificOrders();
      return updated;
    } catch (err) {}
    return [];
  }
}

export async function resetOrdersToDefault(): Promise<OrderPayload[]> {
  try {
    const initial = getInitialMockOrders();
    const promises = initial.map(order => {
      const docRef = doc(db, 'orders', order.id);
      return setDoc(docRef, order);
    });
    await Promise.all(promises);
    return await getOrders();
  } catch (e) {
    console.error("Lỗi đặt lại đơn hàng mặc định trên Firestore:", e);
    try {
      const initial = getInitialMockOrders();
      saveOrdersToLocalStorage(initial);
      syncAllProductSpecificOrders();
      return initial;
    } catch (err) {}
    return [];
  }
}

// === COUPON UTILITIES BACKED BY FIRESTORE ===

export async function getCoupons(): Promise<Coupon[]> {
  try {
    const q = collection(db, 'coupons');
    const querySnapshot = await getDocs(q);
    const list: Coupon[] = [];
    querySnapshot.forEach((doc) => {
      list.push(doc.data() as Coupon);
    });
    
    // Đồng bộ vào local cache
    localStorage.setItem('yeng_coupons', JSON.stringify(list));
    return list;
  } catch (e) {
    console.error("Lỗi getCoupons từ Firestore, sử dụng localStorage fallback:", e);
    try {
      const saved = localStorage.getItem('yeng_coupons');
      if (saved) return JSON.parse(saved);
    } catch (err) {}
    return [];
  }
}

export async function saveCoupon(coupon: Coupon): Promise<void> {
  try {
    const docRef = doc(db, 'coupons', coupon.code.toUpperCase());
    await setDoc(docRef, coupon);
    
    // Đồng bộ local cache
    try {
      const saved = localStorage.getItem('yeng_coupons');
      let list: Coupon[] = saved ? JSON.parse(saved) : [];
      list = list.filter(c => c.code.toUpperCase() !== coupon.code.toUpperCase());
      list.push(coupon);
      localStorage.setItem('yeng_coupons', JSON.stringify(list));
    } catch (e) {}
  } catch (e) {
    console.error("Lỗi lưu coupon lên Firestore:", e);
    try {
      const saved = localStorage.getItem('yeng_coupons');
      let list: Coupon[] = saved ? JSON.parse(saved) : [];
      list = list.filter(c => c.code.toUpperCase() !== coupon.code.toUpperCase());
      list.push(coupon);
      localStorage.setItem('yeng_coupons', JSON.stringify(list));
    } catch (err) {}
  }
}

export async function deleteCoupon(code: string): Promise<void> {
  try {
    const docRef = doc(db, 'coupons', code.toUpperCase());
    await deleteDoc(docRef);
    
    // Đồng bộ local cache
    try {
      const saved = localStorage.getItem('yeng_coupons');
      let list: Coupon[] = saved ? JSON.parse(saved) : [];
      list = list.filter(c => c.code.toUpperCase() !== code.toUpperCase());
      localStorage.setItem('yeng_coupons', JSON.stringify(list));
    } catch (e) {}
  } catch (e) {
    console.error("Lỗi xóa coupon trên Firestore:", e);
    try {
      const saved = localStorage.getItem('yeng_coupons');
      let list: Coupon[] = saved ? JSON.parse(saved) : [];
      list = list.filter(c => c.code.toUpperCase() !== code.toUpperCase());
      localStorage.setItem('yeng_coupons', JSON.stringify(list));
    } catch (err) {}
  }
}

export async function saveAllCoupons(couponsList: Coupon[]): Promise<void> {
  try {
    const q = collection(db, 'coupons');
    const querySnapshot = await getDocs(q);
    const existingCodes = new Set<string>();
    querySnapshot.forEach((docSnap) => {
      existingCodes.add(docSnap.id.toUpperCase());
    });

    const currentCodes = new Set(couponsList.map(c => c.code.toUpperCase()));

    for (const oldCode of existingCodes) {
      if (!currentCodes.has(oldCode)) {
        await deleteDoc(doc(db, 'coupons', oldCode));
      }
    }

    for (const coupon of couponsList) {
      const docRef = doc(db, 'coupons', coupon.code.toUpperCase());
      await setDoc(docRef, coupon);
    }

    localStorage.setItem('yeng_coupons', JSON.stringify(couponsList));
  } catch (e) {
    console.error("Lỗi lưu toàn bộ coupons lên Firestore:", e);
    localStorage.setItem('yeng_coupons', JSON.stringify(couponsList));
  }
}


