import { OrderPayload } from '../types';
import { db } from './googleAuth'; // Đảm bảo đường dẫn này đúng với file chứa biến 'db' của bồ
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

// Tên bảng trên Firestore (bồ nhớ tạo bảng tên "orders" trên Firebase Console nhé)
const FIRESTORE_COLLECTION = 'orders';

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

// 1. Lấy danh sách đơn hàng từ Firestore
export async function getOrders(): Promise<OrderPayload[]> {
  try {
    const querySnapshot = await getDocs(collection(db, FIRESTORE_COLLECTION));
    const list: OrderPayload[] = [];
    querySnapshot.forEach((docSnap) => {
      list.push(docSnap.data() as OrderPayload);
    });
    // Sắp xếp đơn hàng mới nhất lên đầu dựa vào timestamp
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (e) {
    console.error("Lỗi đọc orders từ Firestore:", e);
    return [];
  }
}

// 2. Lưu hoặc cập nhật một đơn hàng lên Firestore
export async function saveOrder(order: OrderPayload): Promise<void> {
  try {
    // Dùng setDoc với ID cụ thể của đơn hàng (ví dụ: YENG26-8431) làm ID tài liệu trên Firestore
    const docRef = doc(db, FIRESTORE_COLLECTION, order.id);
    await setDoc(docRef, order);
  } catch (e) {
    console.error("Lỗi khi ghi order vào Firestore:", e);
  }
}

// 3. Cập nhật trạng thái một đơn hàng
export async function updateOrderStatus(orderId: string, status: string): Promise<OrderPayload[]> {
  try {
    const docRef = doc(db, FIRESTORE_COLLECTION, orderId);
    await updateDoc(docRef, { status });
    return await getOrders(); // Lấy lại danh sách mới sau khi cập nhật
  } catch (e) {
    console.error("Lỗi khi cập nhật trạng thái đơn hàng:", e);
    return [];
  }
}

// 4. Cập nhật mã vận đơn
export async function updateOrderTrackingCode(orderId: string, trackingCode: string): Promise<OrderPayload[]> {
  try {
    const docRef = doc(db, FIRESTORE_COLLECTION, orderId);
    await updateDoc(docRef, { trackingCode });
    return await getOrders();
  } catch (e) {
    console.error("Lỗi khi cập nhật mã vận đơn:", e);
    return [];
  }
}

// 5. Cập nhật hàng loạt mã vận đơn và trạng thái
export async function updateBulkOrdersTracking(updates: { orderId: string; trackingCode: string; status?: string }[]): Promise<OrderPayload[]> {
  try {
    for (const update of updates) {
      const docRef = doc(db, FIRESTORE_COLLECTION, update.orderId);
      const fieldsToUpdate: any = { trackingCode: update.trackingCode };
      if (update.status !== undefined) {
        fieldsToUpdate.status = update.status;
      }
      await updateDoc(docRef, fieldsToUpdate);
    }
    return await getOrders();
  } catch (e) {
    console.error("Lỗi khi cập nhật hàng loạt mã vận đơn:", e);
    return [];
  }
}

// 6. Xóa đơn hàng khỏi Firestore
export async function deleteOrder(orderId: string): Promise<OrderPayload[]> {
  try {
    const docRef = doc(db, FIRESTORE_COLLECTION, orderId);
    await deleteDoc(docRef);
    return await getOrders();
  } catch (e) {
    console.error("Lỗi khi xóa đơn hàng:", e);
    return [];
  }
}

// 7. Dummy function để giữ giao diện không bị lỗi import compile
export function syncAllProductSpecificOrders(): void {
  // Không cần xử lý dọn dẹp localStorage nữa vì đã chuyển sang Firestore hoàn toàn
}
export function resetOrdersToDefault(): OrderPayload[] {
  return [];
}
