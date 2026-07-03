import { OrderPayload, CartItem, Product, Coupon } from '../types';
import { INITIAL_PRODUCTS } from '../data/products';
import { db } from './googleAuth';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

// Helper to generate some high-fidelity mock orders for first-time administration view
const getInitialMockOrders = (): OrderPayload[] => {
  const pNct = INITIAL_PRODUCTS.find(p => p.id === 1) || INITIAL_PRODUCTS[0];
  const pAespa = INITIAL_PRODUCTS.find(p => p.id === 2) || INITIAL_PRODUCTS[1];
  const pJacket = INITIAL_PRODUCTS.find(p => p.id === 3) || INITIAL_PRODUCTS[2];
  const pIllit = INITIAL_PRODUCTS.find(p => p.id === 5) || INITIAL_PRODUCTS[4];

  return [
    {
      id: "YENG26-8431",
      status: "Đang gom hàng",
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
      id: "YENG26-1940",
      status: "Đã bay kho Hàn",
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
      id: "YENG26-4712",
      status: "Đã về Sài Gòn",
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

const STORAGE_KEY = 'yeng_corner_orders_v1';

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
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith("orders_") && key !== STORAGE_KEY) {
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
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
}

export async function getOrders(): Promise<OrderPayload[]> {
  try {
    const q = collection(db, 'orders');
    const querySnapshot = await getDocs(q);
    const list: OrderPayload[] = [];
    querySnapshot.forEach((doc) => {
      list.push(doc.data() as OrderPayload);
    });
    
    // Sắp xếp đơn hàng giảm dần theo thời gian (mới nhất lên đầu)
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Đồng bộ vào localStorage cache để các tính năng offline/truy xuất nhanh hoạt động mượt mà
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return list;
  } catch (e) {
    console.warn("Lỗi đọc orders từ Firestore, sử dụng localStorage fallback:", e);
    const localList = await getOrdersLocalFallback();
    localList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return localList;
  }
}

export async function saveOrder(order: OrderPayload): Promise<void> {
  try {
    const docRef = doc(db, 'orders', order.id);
    await setDoc(docRef, order);
    
    // Lưu vào localStorage cache
    try {
      const currentOrders = await getOrdersLocalFallback();
      const updatedOrders = [order, ...currentOrders.filter(o => o.id !== order.id)];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedOrders));
      syncAllProductSpecificOrders();
    } catch (e) {}
  } catch (e) {
    console.error("Lỗi ghi order vào Firestore:", e);
    // Ghi local cache làm cứu cánh
    try {
      const currentOrders = await getOrdersLocalFallback();
      const updatedOrders = [order, ...currentOrders.filter(o => o.id !== order.id)];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedOrders));
      syncAllProductSpecificOrders();
    } catch (err) {}
  }
}

export async function updateOrderStatus(orderId: string, status: string): Promise<OrderPayload[]> {
  try {
    const docRef = doc(db, 'orders', orderId);
    await updateDoc(docRef, { status });
    return await getOrders();
  } catch (e) {
    console.error("Lỗi cập nhật trạng thái đơn hàng trên Firestore:", e);
    try {
      const currentOrders = await getOrdersLocalFallback();
      const updated = currentOrders.map(ord => 
        ord.id === orderId ? { ...ord, status } : ord
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      syncAllProductSpecificOrders();
      return updated;
    } catch (err) {}
    return [];
  }
}

export async function updateOrderTrackingCode(orderId: string, trackingCode: string): Promise<OrderPayload[]> {
  try {
    const docRef = doc(db, 'orders', orderId);
    await updateDoc(docRef, { trackingCode });
    return await getOrders();
  } catch (e) {
    console.error("Lỗi cập nhật mã vận đơn trên Firestore:", e);
    try {
      const currentOrders = await getOrdersLocalFallback();
      const updated = currentOrders.map(ord => 
        ord.id === orderId ? { ...ord, trackingCode } : ord
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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
        dataToUpdate.status = u.status;
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
            status: match.status !== undefined ? match.status : ord.status 
          };
        }
        return ord;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
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
    // Lưu tạm vào local cache làm cứu cánh
    try {
      const saved = localStorage.getItem('yeng_coupons');
      let list: Coupon[] = saved ? JSON.parse(saved) : [];
      list = list.filter(c => c.code.toUpperCase() !== coupon.code.toUpperCase());
      list.push(coupon);
      localStorage.setItem('yeng_coupons', JSON.stringify(list));
    } catch (err) {}
  }
}

