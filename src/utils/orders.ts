import { OrderPayload, CartItem, Product, Coupon, ORDER_STATUSES, OrderStatus } from '../types';
import { INITIAL_PRODUCTS } from '../data/products';
import { db, compressImage, sanitizeProductForOrder } from './googleAuth';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';

// Tự động chuẩn hóa và chuyển đổi trạng thái cũ (ví dụ "Đã có mã vận đơn") thành "Đã về HCM"
export function normalizeOrderStatus(status?: string): string {
  if (!status) return "Chờ xác nhận";
  if (status === "Đã có mã vận đơn" || status === "Đã về Sài Gòn") {
    return "Đã về HCM";
  }
  return status;
}

// Kiểm tra đơn hàng thực tế còn hiệu lực: loại trừ đơn đã bị xóa vĩnh viễn, đơn rác hoặc bản ghi hỏng
export function isValidActiveOrder(ord: any): boolean {
  if (!ord || typeof ord !== 'object') return false;
  const id = typeof ord.id === 'string' ? ord.id.trim() : String(ord.id || '').trim();
  if (!id || id.length < 2) return false;

  // Lọc bỏ đơn hàng đã có trạng thái bị xóa hoặc hủy vĩnh viễn
  const status = String(ord.status || '').trim().toLowerCase();
  if (
    status === 'đã xóa' ||
    status === 'xóa vĩnh viễn' ||
    status === 'đã hủy vĩnh viễn' ||
    status === 'deleted' ||
    status === 'archived'
  ) {
    return false;
  }

  // Đảm bảo đơn hàng có danh sách sản phẩm hợp lệ, loại trừ bản ghi rác
  if (!Array.isArray(ord.items) || ord.items.length === 0) {
    return false;
  }

  return true;
}

// Helper to generate some high-fidelity mock orders ONLY when manually requested by admin for demo
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
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
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
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
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
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];
};

export const STORAGE_KEY = 'yeng_corner_orders_v1';
export const LEGACY_STORAGE_KEY = 'yeng_orders';

// In-memory RAM cache cho đơn hàng: Tuyệt đối KHÔNG lưu mảng đơn hàng vào localStorage nữa
let cachedOrders: OrderPayload[] = [];
let isOrdersInitialLoaded = false;

// Dọn dẹp sạch sẽ toàn bộ các key đơn hàng cũ khỏi localStorage khi khởi động để chặn đứng lỗi QuotaExceededError
try {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY + '_timestamp');
    localStorage.removeItem('yeng_orders_initialized');
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith("orders_") || key.startsWith("yeng_orders") || key.startsWith("yeng_corner_orders")) {
        try {
          localStorage.removeItem(key);
        } catch {}
      }
    });
  }
} catch (e) {}

const ORDERS_CACHE_MAX_AGE = 5 * 1000; // 5 seconds

export const isOrdersCacheExpired = (): boolean => {
  return !isOrdersInitialLoaded;
};

// Internal synchronous reader for raw orders in-memory
function getOrdersFromLocalSyncRaw(): OrderPayload[] {
  try {
    if (Array.isArray(cachedOrders)) {
      return [...cachedOrders];
    }
    return [];
  } catch (e) {
    return [];
  }
}

// Synchronous local orders getter (Đọc từ bộ nhớ RAM an toàn 100%)
export function getOrdersFromLocalSync(): OrderPayload[] {
  try {
    if (Array.isArray(cachedOrders) && cachedOrders.length > 0) {
      return [...cachedOrders].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    return [];
  } catch (e) {
    return [];
  }
}

/**
 * Sinh mã đơn hàng duy nhất có định dạng YENGXXXX (với 4 chữ số ngẫu nhiên từ 1000 đến 9999).
 * Đối chiếu với danh sách đơn hàng trong memory cache để đảm bảo tuyệt đối không trùng lặp mã đơn hàng cũ.
 */
export function generateUniqueOrderId(existingOrders?: OrderPayload[], prefix: string = "YENG"): string {
  const existingIds = new Set<string>();

  // 1. Quét danh sách truyền vào
  if (Array.isArray(existingOrders)) {
    existingOrders.forEach(o => {
      if (o && o.id) existingIds.add(String(o.id).trim().toUpperCase());
    });
  }

  // 2. Quét các đơn hàng đang lưu trữ trong memory cache
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

// CHẶN ĐỨNG HOÀN TOÀN VIỆC LƯU ORDERS VÀO LOCALSTORAGE:
// Cập nhật bộ nhớ RAM in-memory cache và phát sự kiện; TUYỆT ĐỐI KHÔNG dùng localStorage.setItem cho đơn hàng
export const saveOrdersToLocalStorage = (list: OrderPayload[], allowEmpty: boolean = false) => {
  try {
    if (!Array.isArray(list)) return;
    
    // Cập nhật in-memory cache
    cachedOrders = list;
    isOrdersInitialLoaded = true;

    // Phát sự kiện cập nhật tức thì toàn hệ thống để mọi component cập nhật state ngay lập tức
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('yeng_orders_updated', { detail: list }));
    }

    // Tự động dọn sạch các key cũ trong localStorage để giải phóng hoàn toàn dung lượng trình duyệt
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        localStorage.removeItem(STORAGE_KEY + '_timestamp');
        localStorage.removeItem('yeng_orders_initialized');
      }
    } catch (cleanErr) {}
  } catch (e) {
    // Luôn bọc try...catch an toàn tuyệt đối
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
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
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
    return getOrdersFromLocalSyncRaw();
  } catch (e) {
    return [];
  }
}

export async function getOrders(forceRefresh: boolean = false): Promise<OrderPayload[]> {
  // 1. Tải trực tiếp danh sách đơn hàng thực tế từ Cloud Firestore (Nguồn dữ liệu chân lý 100%)
  try {
    console.log("[getOrders] Đang tải danh sách đơn hàng thực tế từ Cloud Firestore...");
    const q = collection(db, 'orders');
    const querySnapshot = await getDocs(q);
    const firestoreList: OrderPayload[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as OrderPayload;
      if (data) {
        const item: OrderPayload = {
          ...data,
          id: data.id || docSnap.id,
          status: normalizeOrderStatus(data.status)
        };
        // Lọc nghiêm ngặt: Chỉ tải những đơn hàng thực tế còn hiệu lực
        if (isValidActiveOrder(item)) {
          firestoreList.push(item);
        } else {
          // Tự động dọn dẹp các bản ghi rác hoặc đã có trạng thái xóa vĩnh viễn trên Cloud Firestore
          const st = String(data.status || '').toLowerCase().trim();
          if (st === 'đã xóa' || st === 'xóa vĩnh viễn' || st === 'đã hủy vĩnh viễn' || st === 'deleted') {
            console.log(`[getOrders] Tự động dọn dẹp bản ghi rác/hủy trên Firestore: ${docSnap.id}`);
            deleteDoc(docSnap.ref).catch(() => {});
          }
        }
      }
    });

    firestoreList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // ĐỒNG BỘ 100% VỚI CLOUD: Ghi đè trực tiếp danh sách sạch xuống localStorage cache
    // Cờ allowEmpty=true đảm bảo khi Firestore rỗng thì cache cũng sạch, không bao giờ tự ý hồi sinh đơn cũ
    saveOrdersToLocalStorage(firestoreList, true);

    console.log(`[getOrders] Tải thành công ${firestoreList.length} đơn hàng thực tế từ Cloud Firestore.`);
    return firestoreList;
  } catch (err) {
    console.warn("[getOrders] Không thể kết nối trực tiếp Firestore, thử API máy chủ...", err);
  }

  // 2. Fallback to server API if direct client-side Firestore read fails
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
        const validList = list
          .filter(isValidActiveOrder)
          .map((ord: OrderPayload) => ({
            ...ord,
            status: normalizeOrderStatus(ord.status)
          }));
        validList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        saveOrdersToLocalStorage(validList, true);
        return validList;
      }
    }
  } catch (err) {
    console.warn("[getOrders] Lỗi tải từ API máy chủ dự phòng:", err);
  }

  // 3. Cuối cùng nếu mất mạng hoàn toàn: Đọc từ bộ nhớ đệm cục bộ
  const localList = getOrdersFromLocalSyncRaw();
  localList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return localList;
}

export function listenToOrders(callback: (orders: OrderPayload[]) => void): () => void {
  let isMounted = true;

  // 1. Lắng nghe sự kiện cập nhật cục bộ tức thì trên toàn ứng dụng
  const handleLocalUpdate = (e: any) => {
    if (!isMounted) return;
    if (e.detail && Array.isArray(e.detail)) {
      callback(e.detail);
    }
  };
  window.addEventListener('yeng_orders_updated', handleLocalUpdate);

  // 2. Chạy tải lần đầu từ Firestore
  getOrders(true).then(list => {
    if (isMounted) {
      callback(list);
    }
  }).catch(err => {
    console.warn("listenToOrders initial load fallback:", err);
  });

  // 3. Polling định kỳ mỗi 10 giây để đồng bộ hóa danh sách mới mà không duy trì gRPC Listen stream
  const intervalId = setInterval(() => {
    if (!isMounted) return;
    getOrders(true).then(list => {
      if (isMounted) {
        callback(list);
      }
    }).catch(() => {});
  }, 10000);

  return () => {
    isMounted = false;
    window.removeEventListener('yeng_orders_updated', handleLocalUpdate);
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
  const cleanId = (orderId || '').trim();
  if (!cleanId) return [];

  console.log(`[deleteOrder] Bắt đầu xóa vĩnh viễn đơn hàng #${cleanId} trên Cloud Firestore và bộ nhớ đệm...`);

  // 1. Cập nhật và đồng bộ ngay lập tức vào bộ nhớ RAM in-memory cache
  let updatedOrders: OrderPayload[] = [];
  try {
    const currentOrders = getOrdersFromLocalSyncRaw();
    updatedOrders = currentOrders.filter(
      ord => ord && ord.id && ord.id.trim().toUpperCase() !== cleanId.toUpperCase()
    );
    saveOrdersToLocalStorage(updatedOrders, true);
    syncAllProductSpecificOrders();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('yeng_orders_updated', { detail: updatedOrders }));
    }
  } catch (err) {
    // Luôn an toàn tuyệt đối
  }

  // 2. XÓA VĨNH VIỄN TRÊN CLOUD FIRESTORE BẰNG deleteDoc
  try {
    // 2.1 Xóa trực tiếp theo document ID
    const docRef = doc(db, 'orders', cleanId);
    await deleteDoc(docRef);

    // 2.2 Xóa theo phiên bản in hoa (nếu khác)
    if (cleanId.toUpperCase() !== cleanId) {
      await deleteDoc(doc(db, 'orders', cleanId.toUpperCase()));
    }

    // 2.3 Quét tìm và xóa triệt để nếu document có Firestore Auto-ID nhưng field `id` trùng cleanId
    try {
      const q = query(collection(db, 'orders'), where('id', '==', cleanId));
      const qSnap = await getDocs(q);
      for (const d of qSnap.docs) {
        await deleteDoc(d.ref);
      }
      if (cleanId.toUpperCase() !== cleanId) {
        const qUpper = query(collection(db, 'orders'), where('id', '==', cleanId.toUpperCase()));
        const qSnapUpper = await getDocs(qUpper);
        for (const d of qSnapUpper.docs) {
          await deleteDoc(d.ref);
        }
      }
    } catch (queryErr) {
      console.warn("Lỗi query xóa đơn hàng theo field id:", queryErr);
    }

    console.log(`[deleteOrder] Đã xóa thành công đơn hàng #${cleanId} khỏi Cloud Firestore!`);
  } catch (e) {
    console.error("Lỗi xóa đơn hàng trên Firestore:", e);
  }

  // 3. Gọi thêm DELETE API server như lớp bảo vệ kép
  try {
    await fetch(`/api/orders/${encodeURIComponent(cleanId)}`, {
      method: 'DELETE',
      headers: { 'Cache-Control': 'no-cache' }
    });
  } catch (apiErr) {
    console.warn("Lỗi gọi DELETE /api/orders:", apiErr);
  }

  return updatedOrders;
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
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('yeng_coupons', JSON.stringify(list));
      }
    } catch (e) {}
    return list;
  } catch (e) {
    console.error("Lỗi getCoupons từ Firestore, sử dụng localStorage fallback:", e);
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('yeng_coupons');
        if (saved) return JSON.parse(saved);
      }
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
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('yeng_coupons');
        let list: Coupon[] = saved ? JSON.parse(saved) : [];
        list = list.filter(c => c.code.toUpperCase() !== coupon.code.toUpperCase());
        list.push(coupon);
        localStorage.setItem('yeng_coupons', JSON.stringify(list));
      }
    } catch (e) {}
  } catch (e) {
    console.error("Lỗi lưu coupon lên Firestore:", e);
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('yeng_coupons');
        let list: Coupon[] = saved ? JSON.parse(saved) : [];
        list = list.filter(c => c.code.toUpperCase() !== coupon.code.toUpperCase());
        list.push(coupon);
        localStorage.setItem('yeng_coupons', JSON.stringify(list));
      }
    } catch (err) {}
  }
}

export async function deleteCoupon(code: string): Promise<void> {
  const cleanCode = (code || '').trim();
  if (!cleanCode) return;

  // 1. Đồng bộ local cache ngay lập tức
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('yeng_coupons');
      let list: Coupon[] = saved ? JSON.parse(saved) : [];
      list = list.filter(c => c.code.toUpperCase() !== cleanCode.toUpperCase());
      localStorage.setItem('yeng_coupons', JSON.stringify(list));
      localStorage.setItem('yeng_coupons_initialized', 'true');
    }
  } catch (e) {}

  // 2. Xóa khỏi Firestore
  try {
    const docRef = doc(db, 'coupons', cleanCode.toUpperCase());
    await deleteDoc(docRef);
    if (cleanCode !== cleanCode.toUpperCase()) {
      try {
        await deleteDoc(doc(db, 'coupons', cleanCode));
      } catch (err) {}
    }
  } catch (e) {
    console.error("Lỗi xóa coupon trên Firestore:", e);
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

    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('yeng_coupons', JSON.stringify(couponsList));
      }
    } catch (e) {}
  } catch (e) {
    console.error("Lỗi lưu toàn bộ coupons lên Firestore:", e);
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('yeng_coupons', JSON.stringify(couponsList));
      }
    } catch (err) {}
  }
}


