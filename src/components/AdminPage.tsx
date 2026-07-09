import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Lock, CheckCircle2, TrendingUp, Coins, Trash2, 
  RefreshCw, X, Eye, User, Phone, Mail, Link, Calendar, 
  DollarSign, FileText, PlusCircle, HelpCircle, Truck, Package, ShieldCheck,
  Download, Database, Save, Ticket, Percent, FileSpreadsheet, Send, Loader2, Upload
} from 'lucide-react';
import { OrderPayload, Product, CartItem, Coupon } from '../types';
import { getOrders, updateOrderStatus, updateOrderTrackingCode, updateOrderPaidAmount, updateBulkOrdersTracking, deleteOrder, resetOrdersToDefault, saveOrder, slugify, syncAllProductSpecificOrders, getCoupons, saveCoupon, listenToOrders } from '../utils/orders';
import { getProducts, saveProduct as saveAdminProduct, deleteProduct as deleteAdminProduct, resetProductsToDefault as resetAdminProducts, subscribeProducts } from '../utils/products';
import { initAuth, googleSignIn, logout as googleLogout, db } from '../utils/googleAuth';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
export const dynamic = 'force-dynamic';

interface AdminPageProps {
  setCurrentPage: (page: string) => void;
}

export default function AdminPage({ setCurrentPage }: AdminPageProps) {
  // Authentication status state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('yeng_admin_logged') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Tab state between orders, products, and coupons management
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'coupons' | 'gmail'>('orders');

  // Gmail States
  const [gmailUser, setGmailUser] = useState<any>(null);
  const [gmailToken, setGmailToken] = useState<string | null>(null);
  const [gmailMessagesLoading, setGmailMessagesLoading] = useState(false);
  const [gmailMessages, setGmailMessages] = useState<any[]>([]);
  const [selectedGmailMsg, setSelectedGmailMsg] = useState<any>(null);

  // Gmail Sender States
  const [emailFormTo, setEmailFormTo] = useState('');
  const [emailFormSubject, setEmailFormSubject] = useState('');
  const [emailFormBody, setEmailFormBody] = useState('');
  const [emailSendLoading, setEmailSendLoading] = useState(false);
  const [emailSendSuccess, setEmailSendSuccess] = useState<string | null>(null);
  const [emailSendError, setEmailSendError] = useState<string | null>(null);

  // Bulk Email selection states
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [productFilterText, setProductFilterText] = useState<string>('');
  const [bulkTemplateType, setBulkTemplateType] = useState<string>('deposit');

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGmailUser(user);
        setGmailToken(token);
        // Auto-fetch messages
        fetchGmailMessages(token);
        // Synchronize token with backend server
        try {
          fetch('/api/gmail/store-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: token, email: user?.email })
          }).catch(err => console.error("Failed to sync Gmail token with backend:", err));
        } catch (syncErr) {
          console.error("Failed to sync Gmail token with backend synchronously:", syncErr);
        }
      },
      () => {
        setGmailUser(null);
        setGmailToken(null);
        setGmailMessages([]);
      }
    );
    return () => unsubscribe();
  }, []);

  const fetchGmailMessages = async (token: string) => {
    setGmailMessagesLoading(true);
    try {
      const listRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=8', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (listRes.status === 401) {
        console.warn("Gmail token is expired. Setting empty messages list.");
        setGmailMessages([]);
        showToast("⚠️ Phiên kết nối Gmail đã hết hạn. Vui lòng nhấn nút 'Kết nối Gmail' để làm mới.", "info");
        return;
      }
      
      if (!listRes.ok) throw new Error('Không thể tải danh sách email.');
      const listData = await listRes.json();
      
      if (listData.messages && listData.messages.length > 0) {
        const detailedMsgs = await Promise.all(
          (listData.messages || []).map(async (msg: any) => {
            const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (detailRes.ok) {
              const detail = await detailRes.json();
              const headers = detail.payload.headers || [];
              const subject = headers.find((h: any) => h.name && h.name.toLowerCase() === 'subject')?.value || '(Không có chủ đề)';
              const from = headers.find((h: any) => h.name && h.name.toLowerCase() === 'from')?.value || 'Không rõ';
              const date = headers.find((h: any) => h.name && h.name.toLowerCase() === 'date')?.value || '';
              return {
                id: msg.id,
                snippet: detail.snippet,
                subject,
                from,
                date,
                body: detail.snippet
              };
            }
            return null;
          })
        );
        setGmailMessages(detailedMsgs.filter(m => m !== null));
      } else {
        setGmailMessages([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGmailMessagesLoading(false);
    }
  };

  const handleAdminGmailLogin = async () => {
    try {
      await googleSignIn();
    } catch (err: any) {
      console.error(err);
      const isIframe = window.self !== window.top;
      if (isIframe || err?.code === 'auth/cancelled-popup-request' || err?.message?.includes('cancelled-popup-request')) {
        alert(
          "⚠️ ĐĂNG NHẬP THẤT BẠI DO HẠN CHẾ IFRAME (BẢO MẬT TRÌNH DUYỆT)\n\n" +
          "Trình duyệt đã chặn hoặc tự động hủy yêu cầu của Firebase Auth vì ứng dụng đang chạy bên trong khung xem thử (Iframe).\n\n" +
          "HƯỚNG DẪN KHẮC PHỤC:\n" +
          "1. Hãy nhấn vào nút \"Mở trong tab mới\" (Open in a new tab) ở góc trên cùng bên phải màn hình xem thử để chạy ứng dụng độc lập.\n" +
          "2. Ở tab mới đó, bạn bấm lại nút \"Kết nối Gmail\" để thực hiện kết nối.\n" +
          "3. Đăng nhập sẽ thành công mượt mà!"
        );
      } else {
        alert(`Đăng nhập Google thất bại: ${err?.message || err}`);
      }
    }
  };

  const handleAdminGmailLogout = async () => {
    try {
      await googleLogout();
      setGmailUser(null);
      setGmailToken(null);
      setGmailMessages([]);
      // Clear on server
      await fetch('/api/gmail/clear-token', { method: 'POST' });
    } catch (err) {
      console.error(err);
    }
  };

  const getEmailContentForOrder = (order: OrderPayload, templateType: string, weightFee = 0) => {
    let subject = '';
    let body = '';
    
    if (templateType === 'deposit') {
      subject = `[Yeng Corner] Xác nhận đơn hàng #${order.id}`;
      const pMethod = order.payment?.method || "";
      const isHalfDeposit = pMethod.toLowerCase().includes("50%") || pMethod.toLowerCase().includes("cọc");
      const displayPaymentMethod = isHalfDeposit ? "Cọc 50%" : "Thanh toán 100%";
      const subtotalVal = order.subtotal ?? 0;
      const paidAmount = isHalfDeposit ? Math.round(subtotalVal * 0.5) : subtotalVal;
      const remainingAmount = subtotalVal - paidAmount;

      body = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
  <div style="margin-bottom: 20px;">
    <p>Xin chào <strong>${order.shipping?.receiverName || 'Khách hàng'}</strong>,</p>
    <p>Đơn hàng <strong>#${order.id}</strong> của bạn đã được khởi tạo thành công trên hệ thống. Dưới đây là thông tin chi tiết đơn hàng của bạn:</p>
  </div>
  
  <div style="margin-bottom: 20px;">
    <h3 style="font-size: 13px; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin: 0 0 12px 0; font-weight: 700;">THÔNG TIN ĐẶT HÀNG</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 12.5px; color: #374151;">
      <tbody>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 6px 0; color: #64748b; font-weight: 500; width: 180px;">Tên người nhận:</td>
          <td style="padding: 6px 0; font-weight: 600; color: #1e293b;">${order.shipping?.receiverName}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Số điện thoại:</td>
          <td style="padding: 6px 0; font-weight: 600; color: #1e293b; font-family: monospace;">${order.shipping.phone}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Phương thức thanh toán:</td>
          <td style="padding: 6px 0; font-weight: 600; color: #b45309;">${displayPaymentMethod}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 0; color: #1e293b; font-weight: 700; font-size: 13px;">TỔNG GIÁ TRỊ ĐƠN HÀNG: </td>
          <td style="padding: 8px 0; font-weight: 800; color: #1e3a8a; font-size: 14px; font-family: monospace;">${(order.subtotal ?? 0).toLocaleString('vi-VN')} VND</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Số tiền đã thanh toán:</td>
          <td style="padding: 6px 0; font-weight: 600; color: #047857; font-family: monospace;">${paidAmount.toLocaleString('vi-VN')} VND</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Số tiền còn lại:</td>
          <td style="padding: 6px 0; font-weight: 600; color: #dc2626; font-family: monospace;">${remainingAmount.toLocaleString('vi-VN')} VND</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0;">
    <h3 style="margin-top: 0; color: #1e293b; font-size: 13px; font-weight: 700; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">DANH SÁCH SẢN PHẨM</h3>
    <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
      <thead>
        <tr style="border-bottom: 1px solid #cbd5e1; text-align: left; color: #64748b;">
          <th style="padding: 6px 0;">Sản phẩm</th>
          <th style="padding: 6px 0;">Phiên bản</th>
          <th style="padding: 6px 0; text-align: right;">Số lượng</th>
        </tr>
      </thead>
      <tbody>
        ${(order?.items ?? []).map(item => `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; font-weight: bold;">${item?.product?.name || "Sản phẩm"}</td>
            <td style="padding: 8px 0; color: #475569;">${item?.version || ""}</td>
            <td style="padding: 8px 0; text-align: right;">${item?.quantity || 1}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <!-- Nhắc nhở quan trọng -->
  <div style="margin-bottom: 25px; padding: 15px; border: 1px solid #fed7aa; background-color: #fff7ed; border-radius: 12px; font-size: 12px; color: #9a3412; line-height: 1.5;">
    <strong style="color: #ea580c; display: block; margin-bottom: 4px; font-size: 12.5px;">⚠️ NHẮC NHỞ QUAN TRỌNG:</strong>
    Bạn kiểm tra lại thông tin 1 lần nữa, nếu có sai sót hãy chụp màn hình và liên hệ shop để shop hỗ trợ sửa thông tin.<br/>
    Các đơn cọc 50% - hoàn cọc theo deadline, bạn vui lòng ghi nhớ hạn chuyển khoản và thanh toán phần còn lại để tránh trường hợp bị hủy đơn.
  </div>
  
  <p style="font-size: 11px; color: #64748b; text-align: center; margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 10px; font-weight: 500;">Đây là thư một chiều. Vui lòng không trả lời thư này! Nếu khách muốn thay đổi thông tin cá nhân, hãy liên hệ qua facebook của shop!</p>
</div>
      `.trim();
    } else if (templateType === 'shipping') {
      subject = `[Yeng Corner] Thông báo vận chuyển đơn hàng #${order.id}`;
      body = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1a202c; line-height: 1.6;">
  <div style="margin-bottom: 20px;">
    <p>Xin chào <strong>${order.shipping?.receiverName}</strong>,</p>
    <p>Đơn hàng của bạn đã được bàn giao cho đơn vị vận chuyển <strong>${order.shipping?.method ?? ""}</strong>.</p>
    
    <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 8px; margin: 20px 0; color: #1e40af; font-size: 13.5px; font-weight: 600;">
      Mã vận đơn của bạn là: <strong style="font-family: monospace; color: #1e3a8a; font-size: 16px;">${order.trackingCode || ''}</strong>
    </div>

    <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #e2e8f0;">
      <h3 style="margin-top: 0; color: #1e293b; font-size: 13px; font-weight: 700; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">DANH SÁCH SẢN PHẨM ĐÃ MUA</h3>
      <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 1px solid #cbd5e1; text-align: left; color: #64748b;">
            <th style="padding: 6px 0;">Sản phẩm</th>
            <th style="padding: 6px 0;">Phiên bản</th>
            <th style="padding: 6px 0; text-align: right;">Số lượng</th>
          </tr>
        </thead>
        <tbody>
          ${(order?.items ?? []).map(item => `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; font-weight: bold;">${item?.product?.name || "Sản phẩm"}</td>
              <td style="padding: 8px 0; color: #475569;">${item?.version || "—"}</td>
              <td style="padding: 8px 0; text-align: right;">${item?.quantity || 1}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <p style="font-size: 14px; color: #374151;">
      Tất cả đơn có thu COD, shop đi tất cả qua SPX nên mã vận đơn có thể khác với ĐVVC bạn đã chọn nếu bạn thu COD.<br/>
      Bạn có thể theo dõi hành trình đơn hàng với mã vận đơn trên qua trang web của các đơn vị vận chuyển!<br/>
      Sau khi nhận hàng thành công, cho shop xin feedback qua facebook/ instagram hoặc thread của shop nhé.<br/>
      Cảm ơn bạn đã ủng hộ Yeng corner!
    </p>
  </div>
  
  <p style="font-size: 11px; color: #64748b; text-align: center; margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 10px; font-weight: 500;">Đây là thư một chiều. Vui lòng không trả lời thư này! Nếu khách muốn thay đổi thông tin cá nhân, hãy liên hệ qua facebook của shop!</p>
</div>
      `.trim();
    } else if (templateType === 'arrival') {
      subject = `[YENG CORNER] THÔNG BÁO HÀNG VỀ & THANH TOÁN ĐƠN HÀNG #${order.id}`;
      
      const subtotalVal = order.subtotal ?? 0;
      const pMethod = order.payment?.method || "";
      const isHalfDeposit = pMethod.toLowerCase().includes("50%") || pMethod.toLowerCase().includes("cọc");
      const paidAmount = order.paidAmount !== undefined ? order.paidAmount : (isHalfDeposit ? Math.round(subtotalVal * 0.5) : subtotalVal);
      const remainingAmount = subtotalVal - paidAmount;
      const totalToPay = remainingAmount + weightFee;

      body = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b; line-height: 1.6;">
  <div style="margin-bottom: 20px;">
    <p>Xin chào <strong>${order.shipping?.receiverName || 'Khách hàng'}</strong>,</p>
    <p>YENG CORNER xin thông báo: Các sản phẩm trong đơn hàng <strong>#${order.id}</strong> của bạn đã về tới kho Việt Nam an toàn. Dưới đây là chi tiết thanh toán cho phần còn lại của đơn hàng:</p>
  </div>
  
  <!-- Chi tiết thanh toán -->
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
    <h3 style="font-size: 13px; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin: 0 0 12px 0; font-weight: 700;">THÔNG TIN THANH TOÁN CÒN LẠI</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #374151;">
      <tbody>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Giá trị đơn hàng:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #1e293b; font-family: monospace; text-align: right;">${subtotalVal.toLocaleString('vi-VN')} VND</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Số tiền đã thanh toán (Đã chuyển):</td>
          <td style="padding: 8px 0; font-weight: 600; color: #047857; font-family: monospace; text-align: right;">${paidAmount.toLocaleString('vi-VN')} VND</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 0; color: #dc2626; font-weight: 700;">Số tiền còn lại (chưa tính cân nặng):</td>
          <td style="padding: 8px 0; font-weight: 700; color: #dc2626; font-family: monospace; text-align: right;">${remainingAmount.toLocaleString('vi-VN')} VND</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 0; color: #1e3a8a; font-weight: 500;">Phí vận chuyển Hàn - Việt (Cân nặng):</td>
          <td style="padding: 8px 0; font-weight: 700; color: #1e3a8a; font-family: monospace; text-align: right;">${weightFee.toLocaleString('vi-VN')} VND</td>
        </tr>
        <tr style="border-bottom: 2px solid #cbd5e1; background-color: #eff6ff;">
          <td style="padding: 10px 8px; color: #1e3a8a; font-weight: 800; font-size: 14px;">TỔNG THANH TOÁN THỰC TẾ:</td>
          <td style="padding: 10px 8px; font-weight: 800; color: #1e3a8a; font-size: 15px; font-family: monospace; text-align: right;">${totalToPay.toLocaleString('vi-VN')} VND</td>
        </tr>
      </tbody>
    </table>
    
    <!-- Công thức tính -->
    <div style="margin-top: 15px; font-size: 11px; color: #475569; background-color: #ffffff; padding: 10px; border-radius: 6px; border: 1px dashed #bfdbfe; line-height: 1.4;">
      <strong>💡 CÔNG THỨC TÍNH:</strong><br/>
      Tổng số tiền cần chuyển khoản còn lại = [Số tiền còn lại của đơn hàng] + [Phí vận chuyển Hàn - Việt (Cân nặng)]
    </div>
  </div>

  <!-- Danh sách sản phẩm -->
  <div style="background-color: #ffffff; padding: 15px; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 20px;">
    <h3 style="margin-top: 0; color: #1e293b; font-size: 13px; font-weight: 700; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">DANH SÁCH SẢN PHẨM TRONG ĐƠN</h3>
    <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
      <thead>
        <tr style="border-bottom: 1px solid #cbd5e1; text-align: left; color: #64748b;">
          <th style="padding: 6px 0;">Sản phẩm</th>
          <th style="padding: 6px 0;">Phiên bản</th>
          <th style="padding: 6px 0; text-align: right;">Số lượng</th>
        </tr>
      </thead>
      <tbody>
        ${(order?.items ?? []).map(item => `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; font-weight: bold; color: #1e293b;">${item?.product?.name || "Sản phẩm"}</td>
            <td style="padding: 8px 0; color: #475569;">${item?.version || "Mặc định"}</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${item?.quantity || 1}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <!-- QR và thông tin chuyển khoản -->
  <div style="border: 1px solid #bfdbfe; background-color: #eff6ff; border-radius: 12px; padding: 15px; margin-bottom: 20px; text-align: center;">
    <h4 style="margin: 0 0 10px 0; color: #1e3a8a; font-size: 13px; font-weight: 700;">QUÉT MÃ QR ĐỂ CHUYỂN KHOẢN NHANH</h4>
    
    <div style="display: inline-block; background-color: #ffffff; padding: 8px; border-radius: 8px; border: 1px solid #bfdbfe; margin-bottom: 10px;">
      <img 
        src="https://img.vietqr.io/image/vietcombank-1017217975-compact2.png?amount=${totalToPay}" 
        alt="Vietcombank QR Code" 
        style="width: 180px; height: 180px; object-fit: contain;"
      />
    </div>
    
    <div style="font-size: 12px; color: #1e40af; line-height: 1.5; text-align: left; max-width: 280px; margin: 0 auto;">
      Ngân hàng: <strong>Vietcombank (VCB)</strong><br/>
      Số tài khoản: <strong style="font-family: monospace; font-size: 13px;">1017217975</strong><br/>
      Chủ tài khoản: <strong>LÊ THỊ HỒNG NGỌC</strong><br/>
      Nội dung CK: <strong style="font-family: monospace; font-size: 13px; color: #dc2626; background-color: #ffffff; padding: 2px 6px; border-radius: 4px; border: 1px solid #bfdbfe;">YENG CORNER ${order.id}</strong>
    </div>
  </div>

  <!-- Nhắc nhở gửi bill -->
  <div style="border: 1px solid #fed7aa; background-color: #ffedd5; border-radius: 12px; padding: 15px; font-size: 12px; color: #ea580c; line-height: 1.6; margin-bottom: 20px; text-align: left; font-weight: bold; border-left: 5px solid #ea580c;">
    Các bạn chuyển khoản nốt vui lòng liên hệ shop qua FB/IG/THR gửi bill chuyển khoản kèm mã đơn hàng "YENG${order.id}" để shop cập nhật đơn hàng.
  </div>

  <!-- Quy định nhận chuyển khoản -->
  <div style="border: 1px solid #fecaca; background-color: #fef2f2; border-radius: 12px; padding: 15px; font-size: 12px; color: #991b1b; line-height: 1.5; margin-bottom: 20px; text-align: left;">
    <p style="margin: 0; font-weight: bold;">⚠️ QUY ĐỊNH CHUYỂN KHOẢN THANH TOÁN:</p>
    <p style="margin: 5px 0 0 0; font-weight: 800;">
      Shop chỉ nhận chuyển khoản phần còn lại trong 24 giờ kể từ lúc gửi mail thông báo hàng về. Các đơn còn 50% còn lại hoặc phí vận chuyển Hàn - Việt cần thu, shop sẽ tự động thu COD phần còn lại.
    </p>
  </div>
  
  <p style="font-size: 11px; color: #64748b; text-align: center; margin-top: 25px; border-top: 1px solid #f1f5f9; padding-top: 15px; font-weight: 500;">
    Đây là thư một chiều được tự động gửi từ hệ thống Yeng Corner. Vui lòng không phản hồi trực tiếp email này. Nếu có bất kỳ thắc mắc hoặc cần sửa đổi thông tin, vui lòng nhắn tin trực tiếp qua Fanpage Facebook của Shop để được hỗ trợ kịp thời nhất!
  </p>
</div>
`.trim();
    }
    
    return { subject, body };
  };

  const handleSendAdminEmail = async () => {
    // Determine if we are doing bulk sending (selectedOrderIds is not empty)
    if (selectedOrderIds.length > 0) {
      const confirmed = window.confirm(`Bạn có chắc chắn muốn gửi hàng loạt ${selectedOrderIds.length} email cho các đơn hàng đã tích chọn?`);
      if (!confirmed) return;

      setEmailSendLoading(true);
      setEmailSendSuccess(null);
      setEmailSendError(null);

      let successCount = 0;
      let failureCount = 0;
      let lastError = '';

      for (let i = 0; i < selectedOrderIds.length; i++) {
        const orderId = selectedOrderIds[i];
        const order = orders.find(o => o.id === orderId);
        if (!order) continue;

        const recipientEmail = order.contact?.email ?? "";
        if (!recipientEmail) {
          failureCount++;
          continue;
        }

        let subject = emailFormSubject;
        let body = emailFormBody;

        // If a specific template is chosen for bulk dispatch, generate dynamically
        if (bulkTemplateType !== 'custom') {
          const generated = getEmailContentForOrder(order, bulkTemplateType);
          subject = generated.subject;
          body = generated.body;
        }

        try {
          const response = await fetch('/api/gmail/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              to: recipientEmail,
              subject,
              bodyHtml: body
            })
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || `Gmail API returned status ${response.status}`);
          }
          successCount++;
        } catch (err: any) {
          console.error(`Failed to send bulk email to ${recipientEmail}:`, err);
          failureCount++;
          lastError = err.message || err;
        }

        // Small delay to prevent API rate limitation
        await new Promise(resolve => setTimeout(resolve, 350));
      }

      setEmailSendLoading(false);
      if (failureCount === 0) {
        setEmailSendSuccess(`🎉 Gửi thành công toàn bộ ${successCount}/${selectedOrderIds.length} email hóa đơn chăm sóc!`);
        showToast(`🎉 Đã gửi thành công ${successCount} email!`, 'success');
        setSelectedOrderIds([]); // Reset selection
      } else {
        setEmailSendError(`⚠️ Đã gửi thành công ${successCount} email, thất bại ${failureCount} email. Lỗi gần nhất: ${lastError}`);
        showToast(`⚠️ Thất bại ${failureCount} email`, 'error');
      }
      return;
    }

    // Default single email logic
    const confirmed = window.confirm(`Bạn có chắc chắn muốn gửi email này từ hòm thư Gmail của bạn tới "${emailFormTo}"?`);
    if (!confirmed) return;

    setEmailSendLoading(true);
    setEmailSendSuccess(null);
    setEmailSendError(null);

    try {
      const response = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: emailFormTo,
          subject: emailFormSubject,
          bodyHtml: emailFormBody
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Không thể gửi email.');
      }

      setEmailSendSuccess(`Đã gửi email thành công tới "${emailFormTo}" qua API Gmail!`);
      setEmailFormBody('');
    } catch (err: any) {
      console.error(err);
      setEmailSendError("Lỗi khi gửi email: " + err.message);
    } finally {
      setEmailSendLoading(false);
    }
  };

  const applyEmailTemplate = (order: OrderPayload, templateType: string) => {
    const content = getEmailContentForOrder(order, templateType);
    setEmailFormSubject(content.subject);
    setEmailFormBody(content.body);
  };

// Coupons state - Ban đầu để mảng rỗng, dữ liệu sẽ được tải từ Firebase về sau
  const [coupons, setCoupons] = useState<Coupon[]>([]);

  // 🔄 Tự động tải danh sách Coupon từ Firebase khi mở trang Admin (Gộp chung vào useEffect có sẵn của bồ)
  useEffect(() => {
    if (isAuthenticated) {
      getCoupons().then((data) => {
        // Nếu trên Firebase chưa có coupon nào, nạp mã mặc định YENGNEW cho bồ luôn
        if (data.length === 0) {
          const defaultCoupon: Coupon = {
            code: 'YENGNEW',
            expiryDate: '2026-12-31',
            applicableProducts: 'Tất cả danh mục',
            maxUsage: 100,
            discountType: 'percentage',
            discountValue: 10,
            usedCount: 0
          };
          saveCoupon(defaultCoupon).then(() => setCoupons([defaultCoupon]));
        } else {
          setCoupons(data);
        }
      });
    }
  }, [isAuthenticated]);

  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [couponForm, setCouponForm] = useState({
    code: '',
    expiryDate: '',
    applicableProducts: 'Tất cả danh mục',
    maxUsage: 100,
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 10
  });

  // ➕ Hàm xử lý Thêm Coupon mới lên Firebase
  const handleAddCoupon = async (e: React.FormEvent) => { // 👈 Đã thêm async
    e.preventDefault();
    if (!couponForm.code.trim()) {
      showToast('❌ Vui lòng nhập mã giảm giá!', 'error');
      return;
    }
    const dup = coupons.find(c => c.code.toUpperCase() === couponForm.code.toUpperCase());
    if (dup) {
      showToast('❌ Mã giảm giá này đã tồn tại!', 'error');
      return;
    }
    const newCoupon: Coupon = {
      code: couponForm.code.toUpperCase().replace(/\s+/g, ''),
      expiryDate: couponForm.expiryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      applicableProducts: couponForm.applicableProducts,
      maxUsage: Number(couponForm.maxUsage) || 100,
      discountType: couponForm.discountType,
      discountValue: Number(couponForm.discountValue) || 0,
      usedCount: 0
    };

    // Lưu thẳng lên mạng Firebase Firestore và đợi xong
    await saveCoupon(newCoupon); 
    
    // Tải lại danh sách mới từ Firebase để cập nhật giao diện
    const freshCoupons = await getCoupons();
    setCoupons(freshCoupons);

    setIsCouponModalOpen(false);
    setCouponForm({
      code: '',
      expiryDate: '',
      applicableProducts: 'Tất cả danh mục',
      maxUsage: 100,
      discountType: 'percentage',
      discountValue: 10
    });
    showToast('🎉 Thêm mã giảm giá thành công!', 'success');
  };

  // 🗑️ Hàm xử lý Xóa Coupon khỏi Firebase
  const handleDeleteCoupon = async (code: string) => { // 👈 Đã thêm async
    if (window.confirm(`⚠️ Bạn có chắc chắn muốn xóa mã giảm giá ${code}?`)) {
      try {
        // Gọi thẳng lệnh xóa tài liệu trên Firebase Firestore
        const { deleteDoc, doc } = await import('firebase/firestore');
        await deleteDoc(doc(db, 'coupons', code.toUpperCase()));
        
        // Cập nhật lại giao diện ngay lập tức
        setCoupons(coupons.filter(c => c.code !== code));
        showToast('🗑️ Đã xóa mã giảm giá!', 'info');
      } catch (e) {
        console.error("Lỗi khi xóa coupon:", e);
        showToast('❌ Xóa mã giảm giá thất bại!', 'error');
      }
    }
  };

  // Orders and filter states
  const [orders, setOrders] = useState<OrderPayload[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState('All');

  const [isBulkSending, setIsBulkSending] = useState(false);
  const [bulkSendProgress, setBulkSendProgress] = useState(0);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFileError, setImportFileError] = useState('');
  const [parsedImports, setParsedImports] = useState<{ orderId: string; trackingCode: string }[]>([]);

  // CSV/Excel line parser helper
  const parseCSVContent = (text: string): { orderId: string; trackingCode: string }[] => {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length === 0) return [];

    const rows = lines.map(line => {
      const row: string[] = [];
      let insideQuote = false;
      let currentCell = '';
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          insideQuote = !insideQuote;
        } else if ((char === ',' || char === ';' || char === '\t') && !insideQuote) {
          row.push(currentCell.trim().replace(/^"|"$/g, ''));
          currentCell = '';
        } else {
          currentCell += char;
        }
      }
      row.push(currentCell.trim().replace(/^"|"$/g, ''));
      return row;
    });

    if (rows.length === 0) return [];

    const headers = rows[0].map(h => String(h || '').toLowerCase());
    let idIdx = 0;
    let codeIdx = 1;

    headers.forEach((h, idx) => {
      if (h.includes('id') || h.includes('đơn') || h.includes('don') || h.includes('order')) {
        idIdx = idx;
      }
      if (h.includes('vận') || h.includes('van') || h.includes('tracking') || h.includes('code') || h.includes('ma_vd') || h.includes('mã')) {
        codeIdx = idx;
      }
    });

    const startIndex = (idIdx === 0 && codeIdx === 1 && !rows[0][0].match(/yeng/i)) ? 1 : 0;
    const results: { orderId: string; trackingCode: string }[] = [];

    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i];
      if (row.length > Math.max(idIdx, codeIdx)) {
        const orderId = row[idIdx]?.trim();
        const trackingCode = row[codeIdx]?.trim();
        if (orderId && trackingCode) {
          results.push({ orderId, trackingCode });
        }
      }
    }

    return results;
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setImportFileError('❌ Không thể đọc nội dung tệp tin.');
        return;
      }

      try {
        const results = parseCSVContent(text);
        if (results.length === 0) {
          setImportFileError('❌ Không tìm thấy mã vận đơn hợp lệ trong tệp tin. Đảm bảo tệp tin có cột Mã đơn và Mã vận đơn.');
          setParsedImports([]);
        } else {
          setImportFileError('');
          setParsedImports(results);
        }
      } catch (err) {
        setImportFileError('❌ Đã xảy ra lỗi khi phân tích cú pháp tệp tin CSV.');
        setParsedImports([]);
      }
    };
    reader.readAsText(file);
  };

  const handleApplyImports = async () => { // 👈 Thêm chữ async ở đây
    if (parsedImports.length === 0) return;

    const updates = parsedImports.map(item => ({
      orderId: item.orderId,
      trackingCode: item.trackingCode
    }));

    // 🔄 Thêm chữ await và đợi Firebase xử lý xong rồi lấy data mới set vào giao diện
    const updated = await updateBulkOrdersTracking(updates);
    setOrders(updated);
    showToast(`✅ Đã nhập thành công ${parsedImports.length} mã vận đơn từ file!`, 'success');
    setIsImportModalOpen(false);
    setParsedImports([]);
  };

  const handleBulkConfirmShipAndEmail = async () => {
    const candidates = orders.filter(o => 
      o.trackingCode && 
      o.trackingCode.trim() !== '' && 
      o.status !== "Đã giao cho đơn vị vận chuyển" &&
      o.status !== "Đã hủy" &&
      o.status !== "Đã hoàn thành"
    );

    if (candidates.length === 0) {
      showToast('⚠️ Không tìm thấy đơn hàng mới nào có mã vận đơn cần ship hàng hàng loạt!', 'info');
      return;
    }

    if (!window.confirm(`📦 Xác nhận cập nhật trạng thái của ${candidates.length} đơn hàng thành "Đã giao cho đơn vị vận chuyển" và gửi email thông báo hàng loạt?`)) {
      return;
    }

    setIsBulkSending(true);
    setBulkSendProgress(0);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < candidates.length; i++) {
      const order = candidates[i];
      
      const updated = await updateOrderStatus(order.id, "Đã giao cho đơn vị vận chuyển");
      setOrders(updated);

      try {
        const subject = `ĐƠN HÀNG ${order.id} CỦA BẠN ĐÃ ĐƯỢC GIAO CHO ĐVVC!`;
        const bodyHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1a202c; line-height: 1.6;">
            <p style="margin-top: 0; font-size: 14px;">Chào bạn, đơn hàng của bạn đã được Yeng Corner chuẩn bị xong và bàn giao cho đơn vị vận chuyển.</p>
            
            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 8px; margin: 20px 0; color: #1e40af; font-size: 13.5px; font-weight: 600;">
              📍 Mã vận đơn của bạn là: <strong style="font-family: monospace; color: #1e3a8a; font-size: 16px;">${order.trackingCode || ''}</strong>
            </div>

            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #e2e8f0;">
              <h3 style="margin-top: 0; color: #1e293b; font-size: 13px; font-weight: 700; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">DANH SÁCH SẢN PHẨM</h3>
              <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                <thead>
                  <tr style="border-bottom: 1px solid #cbd5e1; text-align: left; color: #64748b;">
                    <th style="padding: 6px 0;">Sản phẩm</th>
                    <th style="padding: 6px 0;">Phiên bản</th>
                    <th style="padding: 6px 0; text-align: right;">Số lượng</th>
                  </tr>
                </thead>
                <tbody>
                  ${(order?.items ?? []).map(item => `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                      <td style="padding: 8px 0; font-weight: bold;">${item?.product?.name || "Sản phẩm"}</td>
                      <td style="padding: 8px 0; color: #475569;">${item?.version || "—"}</td>
                      <td style="padding: 8px 0; text-align: right;">${item?.quantity || 1}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <p style="font-size: 14px; color: #374151; margin-bottom: 24px;">
              Bạn có thể theo dõi hành trình đơn hàng với mã vận đơn trên qua trang web của đơn vị vận chuyển bạn chọn!<br/>
              Sau khi nhận hàng thành công, hãy cho shop xin feedback qua facebook/ instagram hoặc thread của shop nhé.<br/>
              Cảm ơn bạn đã ủng hộ Yeng corner!
            </p>
            <div style="text-align: center; font-size: 11px; color: #a0aec0; border-top: 1px solid #edf2f7; padding-top: 16px;">
              <p style="margin: 0; font-weight: 500;">Đây là thư một chiều. Vui lòng không trả lời thư này! Nếu khách muốn thay đổi thông tin cá nhân, hãy liên hệ qua facebook của shop!</p>
            </div>
          </div>
        `;

        const response = await fetch('/api/gmail/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: order.contact?.email ?? "",
            subject,
            bodyHtml
          })
        });

        if (response.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        console.error(`Error sending bulk mail to ${order.contact?.email ?? "unknown"}:`, err);
        failCount++;
      }

      setBulkSendProgress(Math.round(((i + 1) / candidates.length) * 100));
    }

    setIsBulkSending(false);
    showToast(`🎉 Đã giao và gửi email thành công cho ${successCount} đơn hàng!${failCount > 0 ? ` (Thất bại ${failCount} đơn)` : ''}`, 'success');
  };

  // Products management state
  const [products, setProducts] = useState<Product[]>([]);
  const [editedProductIds, setEditedProductIds] = useState<Set<number>>(new Set());
  const [newProductIds, setNewProductIds] = useState<Set<number>>(new Set());
  const editedProductIdsRef = React.useRef<Set<number>>(new Set());
  const newProductIdsRef = React.useRef<Set<number>>(new Set());

  const trackEdit = (id: number) => {
    setEditedProductIds(prev => {
      const next = new Set(prev);
      next.add(id);
      editedProductIdsRef.current = next;
      return next;
    });
  };

  const trackNew = (id: number) => {
    setNewProductIds(prev => {
      const next = new Set(prev);
      next.add(id);
      newProductIdsRef.current = next;
      return next;
    });
  };

  const clearTracking = () => {
    setEditedProductIds(new Set());
    setNewProductIds(new Set());
    editedProductIdsRef.current = new Set();
    newProductIdsRef.current = new Set();
  };

  // Unique list of product names for dropdown filtering
  const uniqueProductNames = useMemo(() => {
    const names = new Set<string>();
    products?.forEach(p => {
      if (p.name) names.add(p.name);
    });
    orders?.forEach(o => {
      o.items?.forEach(item => {
        if (item.product?.name) {
          names.add(item.product.name);
        }
      });
    });
    return Array.from(names).sort();
  }, [products, orders]);

  // Reactive message display for selections and filters
  const filterStatusMessage = useMemo(() => {
    if (selectedOrderIds.length === 0) {
      return "Chưa áp dụng bộ lọc";
    }
    if (productFilterText) {
      return `💡 Đang tích chọn ${selectedOrderIds.length} đơn hàng có chứa sản phẩm "${productFilterText}"`;
    }
    if (selectedOrderIds.length === orders.length && orders.length > 0) {
      return `💡 Đang tích chọn ${selectedOrderIds.length} đơn hàng (Tất cả đơn hàng)`;
    }
    return `💡 Đang tích chọn ${selectedOrderIds.length} đơn hàng`;
  }, [selectedOrderIds, productFilterText, orders.length]);

  // Reactive selection based on product name/category query
  useEffect(() => {
    if (!productFilterText) return;
    
    const query = productFilterText.trim().toLowerCase();
    const matchedIds = (orders ?? [])
      .filter(order => 
        (order?.items ?? []).some(item => 
          item?.product && item.product.name && (
            item.product.name.toLowerCase() === query || 
            item.product.name.toLowerCase().includes(query)
          )
        )
      )
      .map(o => o.id);
    
    setSelectedOrderIds(matchedIds);
  }, [productFilterText, orders]);

  const [productSearch, setProductSearch] = useState('');
  const [productCatFilter, setProductCatFilter] = useState('All');

  // Selected invoice image modal
  const [selectedInvoiceImg, setSelectedInvoiceImg] = useState<string | null>(null);

  // Manual offline order creation modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  // Arrival email states
  const [isArrivalModalOpen, setIsArrivalModalOpen] = useState(false);
  const [arrivalOrder, setArrivalOrder] = useState<OrderPayload | null>(null);
  const [weightFee, setWeightFee] = useState<number>(0);
  const [orderWeightFees, setOrderWeightFees] = useState<Record<string, number>>({});
  const [isSendingArrivalMail, setIsSendingArrivalMail] = useState(false);
  const [newOrderForm, setNewOrderForm] = useState({
    customerName: '',
    phone: '',
    email: '',
    snsLink: '',
    address: '',
    note: '',
    productId: 1,
    productVersion: 'Standard Version',
    quantity: 1,
    paymentMethod: 'Cọc 50%',
    shippingMethod: 'SPX',
    status: 'Chờ xác nhận'
  });

  // Product Add/Edit modal state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    id: 0,
    name: '',
    price: 350000,
    category: 'Pre-order',
    image: '',
    tag: 'Pre-order',
    info: '',
    detailedDesc: '',
    versionsText: '',
    weight: '0.45 kg',
    orderDeadline: '',
    releaseDate: '',
    preorderGift: '',
    artist: '',
    variationName: '',
    attribute1Name: '',
    attribute1OptionsText: '',
    attribute2Name: '',
    attribute2OptionsText: '',
    stock: 99,
    shippingFeeIncluded: ''
  });
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('yeng_custom_categories');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [customArtists, setCustomArtists] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('yeng_custom_artists');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);
  const [formVariations, setFormVariations] = useState<{ name: string; price: number; description?: string; stock?: number }[]>([]);
  const [variantMatrix, setVariantMatrix] = useState<any[]>([]);
  const [showSecondAttribute, setShowSecondAttribute] = useState(false);
  const [notifySubscribers, setNotifySubscribers] = useState(false);

  // Auto rebuild single-tier variations and multi-tier variant combinations
  useEffect(() => {
    if (!isProductModalOpen) return;
    
    const basePrice = Number(productForm.price) || 0;
    
    if (showSecondAttribute) {
      const keys1 = (productForm.versionsText || '').split(',').map(v => v.trim()).filter(v => v.length > 0);
      const keys2 = (productForm.attribute2OptionsText || '').split(',').map(v => v.trim()).filter(v => v.length > 0);
      
      setVariantMatrix(prev => {
        const prevArray = Array.isArray(prev) ? prev : [];
        const newMatrix: any[] = [];
        keys1.forEach(k1 => {
          keys2.forEach(k2 => {
            const existing = prevArray.find(v => v && v.option1 === k1 && v.option2 === k2);
            newMatrix.push({
              option1: k1,
              option2: k2,
              price: existing ? (Number(existing.price) || basePrice) : basePrice,
              pob: existing ? (existing.pob || '') : ''
            });
          });
        });
        return newMatrix;
      });
    } else {
      const keys = (productForm.versionsText || '').split(',').map(v => v.trim()).filter(v => v.length > 0);
      setFormVariations(prev => {
        const prevArray = Array.isArray(prev) ? prev : [];
        return keys.map(key => {
          const existing = prevArray.find(v => v && v.name === key);
          return {
            name: key,
            price: existing ? (Number(existing.price) || basePrice) : basePrice,
            description: existing ? (existing.description || '') : ''
          };
        });
      });
    }
  }, [
    isProductModalOpen,
    showSecondAttribute,
    productForm.versionsText,
    productForm.attribute2OptionsText,
    productForm.price
  ]);

  // Google Sheets integration state
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState(() => {
    return localStorage.getItem('yeng_google_sheets_url') || '';
  });
  const [showSheetsConfig, setShowSheetsConfig] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncTotal, setSyncTotal] = useState(0);
  const [exportTarget, setExportTarget] = useState<string>('all');
  const [hasUnsavedCatalogChanges, setHasUnsavedCatalogChanges] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' | null } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(prev => prev?.text === text ? null : prev);
    }, 4000);
  };

  // Load orders and products on authentication
  useEffect(() => {
    if (isAuthenticated) {
      // 🔄 1. Đọc ngay từ localStorage cache trước để tránh màn hình trắng khi tải trang
      try {
        const saved = localStorage.getItem('yeng_corner_orders_v1');
        if (saved) {
          setOrders(JSON.parse(saved));
        }
      } catch (e) {
        console.warn("Lỗi đọc cache ban đầu:", e);
      }

      // 🔄 2. Gọi API getOrders() tải trực tiếp từ Firestore ngay lập tức để đồng bộ nhanh nhất
      getOrders()
        .then((data) => {
          if (data && data.length > 0) {
            setOrders(data);
          }
        })
        .catch((err) => {
          console.error("Lỗi getOrders khi khởi tạo AdminPage:", err);
        });

      // 🔄 3. Đăng ký lắng nghe biến động thời gian thực (real-time) từ Firestore
      const unsubscribeOrders = listenToOrders((data) => {
        console.log("[Firestore Sync] Đã nhận dữ liệu đơn hàng thời gian thực mới:", data.length, "đơn");
        setOrders(data);
      });
      
      const unsubscribeProducts = subscribeProducts((list) => {
        setProducts((prev) => {
          const hasDrafts = prev.length > 0 && (editedProductIdsRef.current.size > 0 || newProductIdsRef.current.size > 0);
          if (hasDrafts) {
            return prev;
          }
          return list;
        });
        if (list.length > 0) {
          setNewOrderForm(prev => ({
            ...prev,
            productId: list[0].id,
            productVersion: list[0].versions && list[0].versions.length > 0 ? list[0].versions[0] : ''
          }));
        }
      });
      
      try {
        syncAllProductSpecificOrders();
      } catch (err) {
        console.warn("Failed to trigger initial sync list:", err);
      }

      // 🔄 4. Đọc Google Sheets URL trực tiếp từ Firestore "gmail/settings"
      getDoc(doc(db, "gmail", "settings"))
        .then((docSnap) => {
          if (docSnap.exists()) {
            const configData = docSnap.data();
            const fetchedUrl = configData.googleSheetsUrl || configData.googleSheetUrl || "";
            if (fetchedUrl) {
              setGoogleSheetsUrl(fetchedUrl);
              localStorage.setItem('yeng_google_sheets_url', fetchedUrl);
            }
          }
        })
        .catch((err) => {
          console.error("Lỗi đọc Google Sheets URL từ Firestore settings:", err);
        });

      return () => {
        unsubscribeOrders();
        unsubscribeProducts();
      };
    }
  }, [isAuthenticated]);

  // Authenticate Admin
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'yengadmin2026') {
      setIsAuthenticated(true);
      sessionStorage.setItem('yeng_admin_logged', 'true');
      setAuthError('');
    } else {
      setAuthError('❌ Mật khẩu chính sách bảo mật quản trị viên không chính xác!');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('yeng_admin_logged');
  };

  // Change order status action handler
  const handleUpdateStatus = async (id: string, newStatus: string) => { // 👈 Thêm chữ async
    const updated = await updateOrderStatus(id, newStatus);               // 👈 Thêm chữ await
    setOrders(updated);
  };

  // Update paid amount of a specific order
  const handleUpdatePaidAmount = async (id: string, amount: number) => {
    try {
      const updated = await updateOrderPaidAmount(id, amount);
      setOrders(updated);
      showToast("💵 Cập nhật số tiền đã thanh toán thành công!", "success");
      
      const updatedOrder = updated.find(o => o.id === id);
      if (updatedOrder) {
        syncOrderToGoogleSheets(updatedOrder);
      }
    } catch (err: any) {
      showToast(`⚠️ Lỗi cập nhật số tiền: ${err.message || err}`, "error");
    }
  };
  
  // Confirm order and send automatic confirmation email
  const handleConfirmOrder = async (orderId: string) => {
  // 1. Update order status to "Đã xác nhận"
  const updated = await updateOrderStatus(orderId, "Đã xác nhận"); // 👈 Thêm chữ await ở đây
  setOrders(updated);
  showToast(`✅ Đã duyệt đơn hàng #${orderId} và cập nhật trạng thái thành "Đã xác nhận"!`, "success");

  // 2. Trigger automatic confirmation email
  const order = updated.find(o => o.id === orderId);
  if (!order) return;

  try {
    // Generate email body using 'deposit' template (the main confirmation email template)
    const { subject, body } = getEmailContentForOrder(order, 'deposit');
    
    const response = await fetch('/api/gmail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: order.contact?.email ?? "",
        subject,
        bodyHtml: body
      })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || `Gmail API returned status ${response.status}`);
    }

    showToast(`✉️ Đã gửi email xác nhận tự động tới ${order.contact?.email ?? ""} thành công!`, "success");

  } catch (err: any) { // 👈 Thêm block catch bọc đúng chỗ này
    console.error(`Failed to send auto confirmation email for order #${orderId}:`, err);
    showToast(`⚠️ Không thể gửi email tự động: ${err.message || err}`, "error");
  }
};
  // Send shipping notification email
  const handleSendShippingEmail = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    if (!order.trackingCode) {
      showToast("⚠️ Vui lòng nhập Mã vận đơn (Tracking Code) trước khi gửi mail vận chuyển!", "error");
      return;
    }

    try {
      showToast(`✉️ Đang chuẩn bị gửi mail vận chuyển đơn hàng #${orderId}...`, "info");
      const { subject, body } = getEmailContentForOrder(order, 'shipping');
      
      const response = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: order.contact?.email ?? "",
          subject,
          bodyHtml: body
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Gmail API returned status ${response.status}`);
      }

      showToast(`✉️ Đã gửi email thông báo vận chuyển tới ${order.contact?.email ?? ""} thành công!`, "success");
    } catch (err: any) {
      console.error(`Failed to send shipping email for order #${orderId}:`, err);
      showToast(`⚠️ Không thể gửi email: ${err.message || err}`, "error");
    }
  };

  // Send arrival notification email
  const handleSendArrivalEmailDirect = async (orderId: string, currentWeightFee: number) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    try {
      setIsSendingArrivalMail(true);
      showToast(`✉️ Đang chuẩn bị gửi mail thông báo hàng về đơn hàng #${orderId}...`, "info");
      const { subject, body } = getEmailContentForOrder(order, 'arrival', currentWeightFee);
      
      const response = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: order.contact?.email ?? "",
          subject,
          bodyHtml: body
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Gmail API returned status ${response.status}`);
      }

      showToast(`✉️ Đã gửi email thông báo hàng về tới ${order.contact?.email ?? ""} thành công!`, "success");
      setIsArrivalModalOpen(false);
      setArrivalOrder(null);
      setWeightFee(0);
    } catch (err: any) {
      console.error(`Failed to send arrival email for order #${orderId}:`, err);
      showToast(`⚠️ Không thể gửi email: ${err.message || err}`, "error");
    } finally {
      setIsSendingArrivalMail(false);
    }
  };

  // Delete order action handler
  const handleDeleteOrder = async (id: string) => {
    if (window.confirm("⚠️ Bạn có chắc chắn muốn xóa đơn hàng này? Hành động này không thể hoàn tác!")) {
      try {
        const updated = await deleteOrder(id);
        setOrders(updated);
        showToast("🗑️ Đã xóa đơn hàng thành công khỏi Firestore!", "success");
      } catch (err: any) {
        showToast(`⚠️ Lỗi khi xóa đơn hàng: ${err.message || err}`, "error");
      }
    }
  };

  // Reset order tracking lists
  const handleResetData = async () => {
    if (window.confirm("🔄 Bạn muốn khôi phục danh sách đơn hàng về dữ liệu mẫu ban đầu để kiểm thử / demo?")) {
      const def = await resetOrdersToDefault();
      setOrders(def);
    }
  };

  // Add a manual custom order
  const handleAddManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find(p => p.id === Number(newOrderForm.productId)) || products[0];
    if (!product) return;
    
    const manualOrder: OrderPayload = {
      id: "YENG-OFF-" + Math.floor(1000 + Math.random() * 9000),
      status: newOrderForm.status,
      items: [
        {
          product: product,
          quantity: Number(newOrderForm.quantity),
          version: newOrderForm.productVersion
        }
      ],
      subtotal: product.price * Number(newOrderForm.quantity),
      contact: {
        email: newOrderForm.email || "offline-sales@yengcorner.vn",
        snsLink: newOrderForm.snsLink || "Không có"
      },
      payment: {
        method: newOrderForm.paymentMethod,
        invoiceImage: null
      },
      shipping: {
        receiverName: newOrderForm.customerName,
        phone: newOrderForm.phone,
        address: newOrderForm.address || "Nhận trực tiếp tại kho Sài Gòn",
        method: newOrderForm.shippingMethod
      },
      note: newOrderForm.note || "Đơn đặt thủ công từ trang Admin",
      timestamp: new Date().toISOString()
    };

    await saveOrder(manualOrder);
    getOrders().then((data) => {
      setOrders(data);
    });
    setIsCreateModalOpen(false);
    // Reset manual form
    setNewOrderForm({
      customerName: '',
      phone: '',
      email: '',
      snsLink: '',
      address: '',
      note: '',
      productId: products[0]?.id || 1,
      productVersion: products[0]?.versions && products[0].versions.length > 0 ? products[0].versions[0] : '',
      quantity: 1,
      paymentMethod: 'Cọc 50%',
      shippingMethod: 'SPX',
      status: 'Chờ xác nhận'
    });
  };

  // Synchronize a specific order to Google Sheets
  const syncOrderToGoogleSheets = (ord: OrderPayload) => {
    const sheetsUrl = localStorage.getItem('yeng_google_sheets_url');
    if (!sheetsUrl) return;

    const itemsFormatted = (ord.items ?? []).map(item => 
      `${item.product?.name || 'Sản phẩm'} (Phân loại: ${item.version || '—'}) x${item.quantity}`
    ).join(", ");

    const totalQty = ord.items.reduce((sum, item) => sum + item.quantity, 0);
    const paymentMethod = ord.payment?.method || '';
    const isHalfDeposit = paymentMethod.toLowerCase().includes('50%') || 
                          paymentMethod.toLowerCase().includes('cọc') || 
                          paymentMethod.toLowerCase().includes('đặt cọc');
    const subtotalVal = ord.subtotal ?? 0;
    const calculatedPaid = ord.paidAmount !== undefined ? ord.paidAmount : (isHalfDeposit ? Math.round(subtotalVal * 0.5) : subtotalVal);

    const payload = {
      timestamp: new Date(ord.timestamp).toLocaleString('vi-VN'),
      email: ord.contact?.email ?? "",
      snsLink: ord.contact?.snsLink,
      quantity: totalQty,
      invoiceImage: ord.payment?.invoiceImage || "",
      customerName: ord.shipping?.receiverName || '',
      phone: ord.shipping?.phone || "",
      address: ord.shipping?.address || "",
      shippingMethod: ord.shipping?.method ?? "",
      note: ord.note && ord.note !== "Không có" ? `[Sản phẩm: ${itemsFormatted}] | ${ord.note}` : itemsFormatted,
      paidAmount: calculatedPaid,
      totalAmount: subtotalVal,
      items: (ord.items ?? []).map(item => ({
        name: item.product?.name || 'Sản phẩm',
        version: item.version || 'Mặc định',
        quantity: item.quantity || 1
      })),
      cartItems: (ord.items ?? []).map(item => ({
        productName: item.product?.name || 'Sản phẩm',
        version: item.version || 'Mặc định',
        quantity: item.quantity || 1
      })),
      productName: ord.items?.[0]?.product?.name || "",
      version: ord.items?.[0]?.version || "",
      
      // Backward compatibility fields
      orderId: ord.id,
      products: itemsFormatted,
      paymentMethod: ord.payment?.method || "Chưa xác định"
    };

    fetch(sheetsUrl, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })
    .then(() => console.log(`Google Sheets sync triggered for order ${ord.id}`))
    .catch(err => console.error("Error syncing to Google Sheets:", err));
  };

  // Synchronize ALL orders in system manually to Google Sheets
  const handleSyncAllToGoogleSheets = async () => {
    const sheetsUrl = googleSheetsUrl || localStorage.getItem('yeng_google_sheets_url');
    if (!sheetsUrl) {
      alert("⚠️ Vui lòng cấu hình và lưu URL kết nối Google Sheets trước!");
      return;
    }

    if (orders.length === 0) {
      alert("Không có đơn hàng nào trong hệ thống để đồng bộ.");
      return;
    }

    // Filter out orders that have already been synchronized (avoid duplicate submissions)
    const unsyncedOrders = orders.filter(o => !o.googleSheetsSynced);
    
    let ordersToSync = [...unsyncedOrders];
    let isForceSyncAll = false;

    if (unsyncedOrders.length === 0) {
      const confirmForce = window.confirm(`✨ Tuyệt vời! Toàn bộ đơn hàng (${orders.length}/${orders.length}) đều đã được đồng bộ lên Google Sheets trước đó rồi!\n\nBạn có muốn BẮT BUỘC ĐỒNG BỘ LẠI toàn bộ đơn hàng từ trước đến nay không? (Lưu ý: Có thể gây lặp lại dòng trên Google Sheets nếu bạn chưa dọn dẹp trang tính).`);
      if (!confirmForce) return;
      ordersToSync = [...orders];
      isForceSyncAll = true;
    } else {
      const confirmSync = window.confirm(`⚡ Phát hiện ${unsyncedOrders.length} đơn hàng mới CHƯA ĐỒNG BỘ lên Google Sheets (trong tổng số ${orders.length} đơn hàng trong hệ thống).\n\nHệ thống sẽ tự động lọc và chỉ đồng bộ thêm ${unsyncedOrders.length} đơn hàng này để tránh trùng lặp.\n\nBạn có muốn bắt đầu đồng bộ không?`);
      if (!confirmSync) return;
    }

    setIsSyncingAll(true);
    setSyncTotal(ordersToSync.length);
    setSyncProgress(0);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < ordersToSync.length; i++) {
      const ord = ordersToSync[i];
      try {
        const itemsFormatted = (ord.items ?? []).map(item => 
          `${item.product?.name || 'Sản phẩm'} (Phân loại: ${item.version || '—'}) x${item.quantity}`
        ).join(", ");

        const totalQty = (ord.items ?? []).reduce((sum, item) => sum + item.quantity, 0);
        const paymentMethod = ord.payment?.method || '';
        const isHalfDeposit = paymentMethod.toLowerCase().includes('50%') || 
                              paymentMethod.toLowerCase().includes('cọc') || 
                              paymentMethod.toLowerCase().includes('đặt cọc');
        const subtotalVal = ord.subtotal ?? 0;
        const calculatedPaid = ord.paidAmount !== undefined ? ord.paidAmount : (isHalfDeposit ? Math.round(subtotalVal * 0.5) : subtotalVal);

        const payload = {
          timestamp: ord.timestamp ? new Date(ord.timestamp).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN'),
          email: ord.contact?.email ?? "",
          snsLink: ord.contact?.snsLink ?? "",
          quantity: totalQty,
          invoiceImage: ord.payment?.invoiceImage || "",
          customerName: ord.shipping?.receiverName || '',
          phone: ord.shipping?.phone || "",
          address: ord.shipping?.address || "",
          shippingMethod: ord.shipping?.method ?? "",
          note: ord.note && ord.note !== "Không có" ? `[Sản phẩm: ${itemsFormatted}] | ${ord.note}` : itemsFormatted,
          paidAmount: calculatedPaid,
          totalAmount: subtotalVal,
          items: (ord.items ?? []).map(item => ({
            name: item.product?.name || 'Sản phẩm',
            version: item.version || 'Mặc định',
            quantity: item.quantity || 1
          })),
          cartItems: (ord.items ?? []).map(item => ({
            productName: item.product?.name || 'Sản phẩm',
            version: item.version || 'Mặc định',
            quantity: item.quantity || 1
          })),
          productName: ord.items?.[0]?.product?.name || "",
          version: ord.items?.[0]?.version || "",
          orderId: ord.id,
          products: itemsFormatted,
          paymentMethod: ord.payment?.method || "Chưa xác định"
        };

        // Standard fetch POST mimicking live client trigger
        await fetch(sheetsUrl, {
          method: "POST",
          mode: "no-cors",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        // Save synchronization state permanently in Firestore so we don't sync it again
        await setDoc(doc(db, "orders", ord.id), { googleSheetsSynced: true }, { merge: true });

        successCount++;
      } catch (err) {
        console.error(`Lỗi đồng bộ đơn hàng #${ord.id}:`, err);
        failCount++;
      }
      setSyncProgress(i + 1);
      // Wait slightly between iterations to avoid Google Sheets API rate limit
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    setIsSyncingAll(false);
    showToast(`Đã đồng bộ thành công ${successCount} đơn hàng lên Google Sheets!`, 'success');
    alert(`🎉 Đồng bộ hoàn tất!\n- Thành công: ${successCount}/${ordersToSync.length} đơn hàng\n- Thất bại: ${failCount} đơn hàng`);
  };

  // Export orders tracking list to offline CSV / Excel file
  const handleExportToCSV = (target: string = 'all') => {
    let ordersToExport = orders;
    let fileNameLabel = "TAT_CA_DON_HANG";

    if (target !== 'all') {
      try {
        // Filter dynamically from active orders list
        ordersToExport = orders.filter(ord => 
          ord.items.some(item => `orders_${slugify(item.product.name)}` === target)
        );
        
        const matchedProduct = products.find(p => `orders_${slugify(p.name)}` === target);
        if (matchedProduct) {
          fileNameLabel = `SP_${slugify(matchedProduct.name).toUpperCase()}`;
        } else {
          fileNameLabel = target.toUpperCase();
        }
      } catch (err) {
        console.error("Lỗi lọc dữ liệu phân loại để xuất:", err);
      }
    }

    if (ordersToExport.length === 0) {
      alert("⚠️ Không có đơn hàng nào của sản phẩm này để xuất!");
      return;
    }

    const headers = [
      "Mã Đơn Hàng",
      "Thời Gian",
      "Trạng Thái",
      "Khách Hàng (Người Nhận)",
      "Số Điện Thoại",
      "Địa Chỉ Giao Hàng",
      "Sản Phẩm Đặt",
      "Hình Thức",
      "Tổng Tiền (VND)",
      "Email",
      "SNS Link",
      "Đơn Vị VC",
      "Ghi Chú"
    ];

    const rows = (ordersToExport || []).map(ord => {
      const itemsDetail = (ord?.items ?? []).map(item => 
        `${item?.product?.name || "Sản phẩm"} (Phân loại: ${item?.version || ""}) x${item?.quantity || 1}`
      ).join(" | ");

      return [
        ord.id,
        new Date(ord.timestamp).toLocaleString('vi-VN'),
        ord.status,
        ord.shipping?.receiverName,
        `="${ord.shipping?.phone || ''}"`,
        ord.shipping?.address || "",
        itemsDetail,
        ord.payment?.method || "Chưa xác định",
        ord.subtotal ?? 0,
        ord.contact?.email || "",
        ord.contact?.snsLink || "",
        ord.shipping?.method ?? "",
        ord.note || ""
      ];
    });

    // We add "sep=," as the first line of the document to force Excel to parse it as standard comma-separated.
    // Also, we use the BOM (\ufeff) and protect cell structure from internal newlines.
    const csvContent = "sep=,\n" + [
      headers.join(","),
      ...(rows || []).map(row => (row || []).map(val => `"${String(val).replace(/\r?\n|\r/g, " ").replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `YENG_CORNER_DON_${fileNameLabel}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Safe product selection in manual order creation
  const handleProductChange = (productId: number) => {
    const selected = products.find(p => p.id === productId);
    setNewOrderForm({
      ...newOrderForm,
      productId: productId,
      productVersion: selected?.versions && selected.versions.length > 0 ? selected.versions[0] : ''
    });
  };

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setFormVariations([]);
    setVariantMatrix([]);
    setAdditionalImages([]);
    setProductForm({
      id: 0,
      name: '',
      price: 250000,
      category: 'Album',
      image: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800&q=80',
      tag: 'Pre-order',
      info: 'Đặt trước nhận ưu đãi quà POB độc quyền từ Hàn Quốc',
      detailedDesc: 'Mô tả chi tiết sản phẩm album nhập khẩu chính hãng...',
      versionsText: '',
      weight: '0.45 kg',
      orderDeadline: '',
      releaseDate: '',
      preorderGift: '',
      artist: '',
      variationName: 'VERSION',
      attribute1Name: '',
      attribute1OptionsText: '',
      attribute2Name: '',
      attribute2OptionsText: '',
      stock: 99
    });
    setNotifySubscribers(false);
    setIsProductModalOpen(true);
  };

  // Open product modal for Edit
  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setNotifySubscribers(false);
    setAdditionalImages(Array.isArray(prod.images) ? [...prod.images] : []);
    
    const isMulti = !!(prod.attribute1Name && Array.isArray(prod.attribute1Options) && prod.attribute1Options.length > 0);
    const has2Tiers = !!prod.attribute2Name;

    setShowSecondAttribute(has2Tiers);

    if (isMulti) {
      setFormVariations([]);
      setVariantMatrix(Array.isArray(prod.variantMatrix) ? [...prod.variantMatrix] : []);
      
      setProductForm({
        id: prod.id || 0,
        name: prod.name || '',
        price: Number(prod.price) || 0,
        category: prod.category || '',
        image: prod.image || '',
        tag: prod.tag ?? 'Pre-order',
        info: prod.info || '',
        detailedDesc: prod.detailedDesc ?? '',
        versionsText: Array.isArray(prod.attribute1Options) ? prod.attribute1Options.join(', ') : '',
        weight: prod.weight ?? '0.50 kg',
        orderDeadline: prod.orderDeadline ?? '',
        releaseDate: prod.releaseDate ?? '',
        preorderGift: prod.preorderGift ?? '',
        artist: prod.artist ?? '',
        variationName: prod.attribute1Name ?? '',
        attribute1Name: prod.attribute1Name ?? '',
        attribute1OptionsText: Array.isArray(prod.attribute1Options) ? prod.attribute1Options.join(', ') : '',
        attribute2Name: prod.attribute2Name ?? '',
        attribute2OptionsText: Array.isArray(prod.attribute2Options) ? prod.attribute2Options.join(', ') : '',
        stock: prod.stock ?? 99,
        shippingFeeIncluded: prod.shippingFeeIncluded || ''
      });
    } else {
      setFormVariations(Array.isArray(prod.variations) ? [...prod.variations] : []);
      setVariantMatrix([]);
      
      const versionsStr = Array.isArray(prod.variations)
        ? (prod.variations || []).map(v => v && typeof v === 'object' ? (v.name || '') : String(v)).filter(Boolean).join(', ') 
        : (Array.isArray(prod.versions) ? prod.versions.join(', ') : (prod.versions || ''));

      setProductForm({
        id: prod.id || 0,
        name: prod.name || '',
        price: Number(prod.price) || 0,
        category: prod.category || '',
        image: prod.image || '',
        tag: prod.tag ?? 'Pre-order',
        info: prod.info || '',
        detailedDesc: prod.detailedDesc ?? '',
        versionsText: versionsStr,
        weight: prod.weight ?? '0.50 kg',
        orderDeadline: prod.orderDeadline ?? '',
        releaseDate: prod.releaseDate ?? '',
        preorderGift: prod.preorderGift ?? '',
        artist: prod.artist ?? '',
        variationName: prod.variationName ?? '',
        attribute1Name: '',
        attribute1OptionsText: '',
        attribute2Name: '',
        attribute2OptionsText: '',
        stock: prod.stock ?? 99,
        shippingFeeIncluded: prod.shippingFeeIncluded || ''
      });
    }
    setIsProductModalOpen(true);
  };

  // Save/Update product handler
  const handleSaveProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let generatedVersions: string[] = [];
    let productPayload: Product;

    // Automatically learn Category and Artist/Brand
    const enteredCategory = (productForm.category || '').trim();
    if (enteredCategory && !customCategories.includes(enteredCategory)) {
      const nextCats = [...customCategories, enteredCategory];
      setCustomCategories(nextCats);
      localStorage.setItem('yeng_custom_categories', JSON.stringify(nextCats));
    }
    const enteredArtist = (productForm.artist || '').trim();
    if (enteredArtist) {
      if (!customArtists.includes(enteredArtist)) {
        const nextArts = [...customArtists, enteredArtist];
        setCustomArtists(nextArts);
        localStorage.setItem('yeng_custom_artists', JSON.stringify(nextArts));
      }
    }

    // Safe ID generation: filter out non-numeric, null or undefined IDs to prevent NaN
    const getNextId = () => {
      const validIds = (products || []).map(p => Number(p?.id)).filter(id => !isNaN(id) && isFinite(id));
      return validIds.length > 0 ? Math.max(...validIds) + 1 : 1;
    };
    const targetId = editingProduct ? editingProduct.id : getNextId();

    if (showSecondAttribute) {
      const opts1 = (productForm.versionsText || '')
        .split(',')
        .map(v => v.trim())
        .filter(v => v.length > 0);
      const opts2 = (productForm.attribute2OptionsText || '')
        .split(',')
        .map(v => v.trim())
        .filter(v => v.length > 0);

      generatedVersions = (variantMatrix || []).map(v => `${v?.option1 || ""} - ${v?.option2 || ""}`);

      productPayload = {
        id: targetId,
        name: productForm.name,
        price: Number(productForm.price),
        category: productForm.category,
        image: productForm.image || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800&q=80",
        images: additionalImages,
        tag: productForm.tag,
        info: productForm.info || "Sản phẩm phân phối chính hãng.",
        detailedDesc: productForm.detailedDesc,
        versions: generatedVersions.length > 0 ? generatedVersions : undefined,
        weight: productForm.weight || "0.45 kg",
        orderDeadline: productForm.orderDeadline,
        releaseDate: productForm.releaseDate,
        preorderGift: productForm.preorderGift,
        artist: productForm.artist,
        attribute1Name: productForm.variationName,
        attribute1Options: opts1,
        attribute2Name: productForm.attribute2Name,
        attribute2Options: opts2,
        variantMatrix: variantMatrix,
        stock: productForm.stock,
        shippingFeeIncluded: productForm.shippingFeeIncluded || ""
      };
    } else {
      // Parse versions
      const parsedVersions = (productForm.versionsText || '')
         .split(',')
         .map(v => v.trim())
         .filter(v => v.length > 0);
      
      generatedVersions = formVariations.length > 0 
         ? (formVariations || []).map(v => v?.name || "") 
         : parsedVersions;

      productPayload = {
        id: targetId,
        name: productForm.name,
        price: Number(productForm.price),
        category: productForm.category,
        image: productForm.image || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800&q=80",
        images: additionalImages,
        tag: productForm.tag,
        info: productForm.info || "Sản phẩm phân phối chính hãng.",
        detailedDesc: productForm.detailedDesc,
        versions: generatedVersions.length > 0 ? generatedVersions : undefined,
        weight: productForm.weight || "0.45 kg",
        orderDeadline: productForm.orderDeadline,
        releaseDate: productForm.releaseDate,
        preorderGift: productForm.preorderGift,
        artist: productForm.artist,
        variationName: productForm.variationName,
        variations: formVariations.length > 0 ? formVariations : undefined,
        stock: productForm.stock,
        shippingFeeIncluded: productForm.shippingFeeIncluded || ""
      };
    }

    // Save locally and track change
    try {
      setProducts((prev) => {
        const exists = prev.some(p => Number(p.id) === Number(targetId));
        if (exists) {
          return (prev || []).map(p => Number(p?.id) === Number(targetId) ? productPayload : p);
        } else {
          return [productPayload, ...prev];
        }
      });

      if (editingProduct) {
        trackEdit(Number(targetId));
      } else {
        trackNew(Number(targetId));
      }

      setHasUnsavedCatalogChanges(true);
      setIsProductModalOpen(false);
      showToast(`✨ Đã thêm/chỉnh sửa sản phẩm "${productForm.name}" vào danh sách tạm thời. Vui lòng bấm nút "Lưu thay đổi" bên ngoài để đồng bộ vĩnh viễn lên cơ sở dữ liệu!`, "info");
    } catch (err: any) {
      console.error("Error preparing product changes:", err);
      showToast(`⚠️ Lỗi khi cập nhật sản phẩm: ${err.message}`, "error");
    }
  };

  // Delete product action handler
  const handleDeleteProduct = (productId: number, productName: string) => {
    if (window.confirm(`⚠️ Bạn có chắc chắn muốn XÓA SẢN PHẨM "${productName}" không?`)) {
      deleteAdminProduct(productId).catch(err => {
        console.error("Error deleting product from Firestore:", err);
        showToast(`⚠️ Lỗi đồng bộ xóa sản phẩm lên cơ sở dữ liệu: ${err.message}`, "error");
      });
      setHasUnsavedCatalogChanges(false);
      showToast(`❌ Đã xóa sản phẩm "${productName}" thành công!`, "success");
    }
  };

  // Save changes immediately & sync catalog to Firestore
  const handlePersistCatalogChanges = async () => {
    const productsToSave = products.filter(p => 
      editedProductIds.has(Number(p.id)) || newProductIds.has(Number(p.id))
    );

    if (productsToSave.length === 0) {
      showToast("ℹ️ Không có sản phẩm nào thay đổi hoặc thêm mới để lưu.", "info");
      return;
    }

    try {
      // 3. Clear existing list from the UI before rendering updated database data to avoid duplication
      setProducts([]);

      // 1 & 2. Perform updates for edited products or additions for new ones
      for (const p of productsToSave) {
        const isNew = newProductIds.has(Number(p.id));
        await saveAdminProduct(p);

        // Trigger email notification for new products if notifySubscribers was selected
        if (notifySubscribers && isNew) {
          try {
            let subscriberEmails: string[] = [];
            const snap = await getDocs(collection(db, "subscriber_emails"));
            snap.forEach((docSnap) => {
              const data = docSnap.data();
              if (data && data.email) {
                subscriberEmails.push(data.email);
              }
            });

            if (subscriberEmails.length > 0) {
              const res = await fetch("/api/subscribers/notify-new-product", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ product: p, emails: subscriberEmails }),
              });
              const data = await res.json();
              if (data.success && data.sentCount > 0) {
                showToast(`📢 Đã gửi email thông báo sản phẩm mới "${p.name}" tới ${data.sentCount} khách hàng đăng ký!`, "success");
              }
            }
          } catch (err: any) {
            console.error("Lỗi gửi email thông báo sản phẩm mới:", err);
          }
        }
      }

      // Clear tracking states
      clearTracking();
      setHasUnsavedCatalogChanges(false);
      setNotifySubscribers(false);

      // Re-render fresh list cleanly from database cache
      setTimeout(() => {
        const refreshedList = getProducts();
        setProducts(refreshedList);
        showToast("✨ Cập nhật và đồng bộ sản phẩm lên Firestore thành công!", "success");
      }, 400);

    } catch (e: any) {
      console.error("Lỗi đồng bộ sản phẩm:", e);
      showToast(`⚠️ Đã có lỗi xảy ra khi lưu sản phẩm: ${e.message}`, "error");
      // Restore products list from local cache if database update failed
      setProducts(getProducts());
    }
  };

  // Reset products list
  const handleResetProducts = () => {
    if (window.confirm("🔄 Bạn có chắc chắn muốn xóa mọi chỉnh sửa và khôi phục danh mục sản phẩm về mặc định ban đầu?")) {
      resetAdminProducts().then((refreshed) => {
        setProducts(refreshed);
        setHasUnsavedCatalogChanges(false);
        showToast(" Danh mục sản phẩm đã được reset thành công.", "info");
      }).catch(err => {
        console.error("Error resetting products on Firestore:", err);
        showToast(`⚠️ Không thể reset sản phẩm trên Firestore: ${err.message}`, "error");
      });
    }
  };

  // Filter & Search Logic
  const filteredOrders = orders.filter(ord => {
    const matchesSearch = 
      (ord.shipping?.receiverName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ord.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ord.shipping?.phone || '').includes(searchQuery) ||
      (ord.contact?.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.items.some(it => it.product && it.product.name && it.product.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'All' || ord.status === statusFilter;
    const matchesPayment = paymentFilter === 'All' || (ord.payment?.method || '').includes(paymentFilter);

    return matchesSearch && matchesStatus && matchesPayment;
  });

  // Filter products logic
  const filteredProducts = products.filter(p => {
    const matchesProductSearch = 
      (p.name || '').toLowerCase().includes(productSearch.toLowerCase()) ||
      (p.info && p.info.toLowerCase().includes(productSearch.toLowerCase())) ||
      (p.category && p.category.toLowerCase().includes(productSearch.toLowerCase()));

    const matchesCat = productCatFilter === 'All' || p.category === productCatFilter;

    return matchesProductSearch && matchesCat;
  });

  // Calculate high quality stats widgets
  const totalSales = orders.reduce((sum, ord) => sum + (ord.status !== "Đã hủy" ? (ord.subtotal ?? 0) : 0), 0);
  const totalReceivedDeposit = orders.reduce((sum, ord) => {
    if (ord.status === "Đã hủy") return sum;
    const pMethod = ord.payment?.method || '';
    return sum + (pMethod.includes('50%') ? ((ord.subtotal ?? 0) * 0.5) : (ord.subtotal ?? 0));
  }, 0);
  const countPending = orders.filter(ord => ord.status === 'Chờ xác nhận').length;

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-12">
        <div className="bg-white border border-blue-200 rounded-2xl p-6 sm:p-8 shadow-md space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-[#e8f0ff] border border-blue-300 rounded-xl text-blue-900 flex items-center justify-center mx-auto shadow-sm">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-display font-bold text-neutral-900 tracking-tight uppercase">BẢO MẬT QUẢN TRỊ</h2>
            <p className="text-xs text-neutral-500">
              Vui lòng nhập mã bảo mật (yêu cầu mật khẩu chuyên biệt YENG CORNER) để quản trị và theo dõi đơn vận.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-[10px] font-mono font-bold text-neutral-400 tracking-wider block mb-1 uppercase">Mật khẩu admin:</label>
              <input 
                type="password" 
                placeholder="Nhập mật khẩu (Mặc định: yengadmin2026)"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-neutral-300 rounded-xl text-sm focus:ring-1 focus:ring-blue-400 focus:outline-none bg-neutral-50"
                autoFocus
              />
              {authError && (
                <p className="text-[11px] text-red-600 font-medium mt-1.5">{authError}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#e8f0ff] border border-blue-400 text-blue-950 font-display font-bold text-xs tracking-widest uppercase rounded-xl hover:bg-blue-100 transition-colors shadow-sm"
            >
              UỶ QUYỀN ĐĂNG NHẬP
            </button>
          </form>

          <div className="border-t border-neutral-100 pt-4 text-center">
            <button 
              onClick={() => setCurrentPage('home')}
              className="text-xs text-neutral-400 hover:text-blue-600 font-medium transition-colors"
            >
              ← Quay về trang chủ mua sắm
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Visual Toast Notification Banner */}
      {toastMessage && (
        <div className={`fixed top-6 right-6 z-[9999] max-w-sm w-full bg-white border shadow-2xl rounded-2xl p-4 flex items-start space-x-3 border-l-4 transition-all duration-300 transform translate-y-0 opacity-100 ${
          toastMessage.type === 'error'
            ? 'border-red-500 border-red-200'
            : toastMessage.type === 'info'
            ? 'border-blue-500 border-blue-200'
            : 'border-emerald-600 border-emerald-250'
        }`}>
          <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
            toastMessage.type === 'error'
              ? 'bg-red-50 text-red-600'
              : toastMessage.type === 'info'
              ? 'bg-blue-50 text-blue-600'
              : 'bg-emerald-50 text-emerald-600'
          }`}>
            {toastMessage.type === 'error' ? (
              <X className="w-5 h-5" />
            ) : toastMessage.type === 'info' ? (
              <HelpCircle className="w-5 h-5" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-neutral-900 text-xs uppercase tracking-wider">
              {toastMessage.type === 'error' ? 'Hệ thống báo lỗi' : 'Hệ thống thông báo'}
            </p>
            <p className="text-xs text-neutral-600 leading-relaxed mt-1 break-words font-medium">{toastMessage.text}</p>
          </div>
          <button 
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-neutral-400 hover:text-neutral-600 shrink-0 self-start p-1 hover:bg-neutral-100 rounded-lg transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Admin Headline */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
            <h2 className="text-2xl font-display font-bold text-[#1e40af] tracking-tight uppercase">YENG CORNER WORKSPACE</h2>
          </div>
          <p className="text-sm text-neutral-500 mt-1">Hệ thống theo dõi đơn đặt mua K-Pop & Logistics nội địa Hàn Việt của đại lý.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {activeTab === 'orders' && (
            <>
              <div className="flex items-center gap-1.5 border border-blue-200 bg-blue-50/40 p-1 rounded-xl">
                <select
                  value={exportTarget}
                  onChange={(e) => setExportTarget(e.target.value)}
                  className="bg-white text-[11px] font-sans font-bold text-neutral-800 border border-neutral-200 px-2.5 py-1.5 rounded-lg focus:outline-none cursor-pointer text-ellipsis max-w-[150px] sm:max-w-[200px]"
                  title="Chọn danh mục sản phẩm để xuất dữ liệu độc lập"
                >
                  <option value="all">📁 Tất cả các đơn</option>
                  {(products || []).map(p => (
                    <option key={p?.id} value={`orders_${slugify(p?.name || "")}`}>
                      📦 Hộp đơn: {p?.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleExportToCSV(exportTarget)}
                  className="px-3 py-1.5 bg-blue-900 border border-blue-900 hover:bg-blue-950 text-white text-[11px] font-display font-bold uppercase rounded-lg flex items-center space-x-1.5 transition-all shadow-sm"
                  title="Bấm để tải file trang tính được lựa chọn"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Xuất file</span>
                </button>
              </div>

              <button
                onClick={() => setShowSheetsConfig(p => !p)}
                className={`px-4 py-2 border text-xs font-display font-bold tracking-wider uppercase rounded-xl flex items-center space-x-1.5 transition-all shadow-sm ${
                  googleSheetsUrl 
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100' 
                    : 'bg-yellow-50 border-yellow-300 text-yellow-900 hover:bg-yellow-105'
                }`}
                title="Cấu hình tự động đồng bộ hóa đơn hàng sang Google Sheets thời gian thực"
              >
                <Database className="w-4 h-4" />
                <span>Đồng bộ Sheets</span>
              </button>
            </>
          )}

          <button
            onClick={activeTab === 'orders' ? handleResetData : handleResetProducts}
            className="p-2 border border-blue-200 bg-[#e8f0ff] hover:bg-blue-100 text-blue-900 rounded-xl transition-all shadow-sm"
            title={activeTab === 'orders' ? "Khôi phục danh sách đơn hàng mẫu ban đầu" : "Khôi phục danh mục sản phẩm gốc"}
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-neutral-700 text-xs font-display font-bold tracking-wider uppercase rounded-xl transition-colors"
          >
            Thoát Admin
          </button>
        </div>
      </div>

      {/* COLLAPSIBLE CONFIGURATION DRAWER: Google Sheets Logging Web App */}
      {showSheetsConfig && (
        <div className="bg-white border-2 border-dashed border-blue-200 rounded-2xl p-6 sm:p-8 space-y-6 animate-fade-in shadow-sm">
          <div className="flex items-center space-x-2.5">
            <Database className="w-5 h-5 text-blue-950" />
            <h3 className="text-sm font-display font-bold text-blue-950 uppercase tracking-wider">CẤU HÌNH TỰ ĐỘNG ĐƠN HÀNG SANG GOOGLE SHEETS</h3>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed max-w-3xl">
            Tích hợp này cho phép hệ thống tự động lưu trữ thông tin đơn hàng của khách hàng (Tên, SĐT, Sản phẩm, Tổng tiền, Ảnh minh chứng chuyển khoản) trực tiếp thành một hàng mới trên trang tính Google Sheets của bạn ngay tại thời gian thực.
          </p>

          <div className="space-y-2">
            <label className="text-[10.5px] font-mono font-bold text-neutral-500 block uppercase">Địa chỉ Google Web App API URL của bạn:</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="url"
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                value={googleSheetsUrl}
                onChange={(e) => {
                  const url = e.target.value.trim();
                  setGoogleSheetsUrl(url);
                  if (url) {
                    localStorage.setItem('yeng_google_sheets_url', url);
                  } else {
                    localStorage.removeItem('yeng_google_sheets_url');
                  }
                }}
                className="flex-1 px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-neutral-50 font-mono text-xs text-neutral-800 placeholder-neutral-400"
              />
              <button
                onClick={async () => {
                  try {
                    const gmailDocRef = doc(db, "gmail", "settings");
                    const snap = await getDoc(gmailDocRef);
                    const existingData = snap.exists() ? snap.data() : {};
                    await setDoc(gmailDocRef, {
                      ...existingData,
                      googleSheetsUrl: googleSheetsUrl,
                      googleSheetUrl: googleSheetsUrl
                    });
                    alert("🎉 Lưu cổng kết nối Google Sheets thành công và đồng bộ lên hệ thống cloud!");
                  } catch (err: any) {
                    console.error("Lỗi khi đồng bộ Google Sheets URL lên Firestore:", err);
                    alert("Đã lưu local, nhưng không đồng bộ được lên hệ thống: " + err.message);
                  }
                }}
                className="px-6 py-2.5 bg-blue-900 hover:bg-blue-950 text-white font-display font-bold text-xs rounded-lg uppercase tracking-wider transition-all"
              >
                Lưu kết nối
              </button>
            </div>
            {googleSheetsUrl ? (
              <div className="space-y-3">
                <span className="text-[10px] text-emerald-600 font-bold font-mono block">● CỔNG KẾT NỐI SHEETS ĐANG HOẠT ĐỘNG THỜI GIAN THỰC</span>
                
                {/* Manual Bulk Sync Section */}
                <div className="mt-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h5 className="font-bold text-xs text-emerald-950 uppercase font-display flex items-center gap-1.5">
                        <span>⚡ ĐỒNG BỘ TOÀN BỘ ĐƠN HÀNG LÊN GOOGLE SHEETS</span>
                      </h5>
                      <p className="text-[11px] text-neutral-600 mt-0.5">
                        <strong>Ghi chú:</strong> Hệ thống luôn tự động đồng bộ đơn hàng theo thời gian thực (real-time) khi khách đặt hàng thành công. Nút này dùng để đồng bộ thủ công các đơn mới hoặc đơn chưa đồng bộ từ các thiết bị khác sang file Google Sheets để không bỏ sót bất kỳ ai. Hệ thống sẽ tự động lọc các đơn đã đồng bộ trước đó để tránh trùng lặp.
                      </p>
                    </div>
                    <button
                      onClick={handleSyncAllToGoogleSheets}
                      disabled={isSyncingAll}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-display font-bold text-xs rounded-lg uppercase tracking-wider transition-all shadow-sm flex items-center justify-center space-x-1.5 whitespace-nowrap self-start sm:self-center"
                    >
                      <span>{isSyncingAll ? "Đang đồng bộ..." : "Bắt đầu đồng bộ"}</span>
                    </button>
                  </div>
                  {isSyncingAll && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-[11px] font-bold font-mono text-emerald-900">
                        <span>Đang xử lý đơn hàng...</span>
                        <span>{syncProgress} / {syncTotal} ({Math.round((syncProgress / syncTotal) * 100)}%)</span>
                      </div>
                      <div className="w-full bg-emerald-100 h-2.5 rounded-full overflow-hidden border border-emerald-300">
                        <div 
                          className="bg-emerald-500 h-full transition-all duration-300" 
                          style={{ width: `${(syncProgress / syncTotal) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <span className="text-[10px] text-amber-600 font-bold font-mono block">○ CHƯA CẤU HÌNH - KHÁCH ĐẶT HÀNG CHỈ LƯU TRỮ TRÊN LOCAL STORAGE MÁY NÀY</span>
            )}
          </div>

          <div className="bg-neutral-50 rounded-xl p-4 sm:p-5 border space-y-3.5 text-xs">
            <h4 className="font-bold text-blue-900 flex items-center space-x-1.5 uppercase font-display">
              <span>🛠️ Hướng dẫn tích hợp 60 giây (Copy-Paste)</span>
            </h4>
            <ol className="list-decimal pl-4 space-y-2.5 text-neutral-700 leading-relaxed">
              <li>Mở một file <strong>Google Sheets (Trang tính)</strong> trắng hoàn toàn trên máy bạn.</li>
              <li>Tại thanh công cụ phía trên, click chọn <strong>Tiện ích mở rộng (Extensions)</strong> &rarr; <strong>Apps Script</strong>.</li>
              <li>Xóa mọi mã mặc định trong khung cửa sổ Code hiện ra và dán đè toàn bộ đoạn Scripts dưới đây:
                <pre className="p-3 bg-neutral-900 text-neutral-200 rounded-lg text-[10.5px] font-mono overflow-x-auto mt-2 select-all whitespace-pre leading-normal shadow-inner max-h-48 overflow-y-auto">
{`function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Tìm hoặc tạo sheet chính để ghi đơn hàng (Tránh ghi nhầm vào tab "CHÚ THÍCH" trống)
  var mainSheet = ss.getSheetByName("DANH SÁCH ĐƠN HÀNG");
  if (!mainSheet) {
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].getName() !== "CHÚ THÍCH") {
        mainSheet = sheets[i];
        break;
      }
    }
    if (!mainSheet) {
      mainSheet = ss.insertSheet("DANH SÁCH ĐƠN HÀNG");
    }
  }

  var data = JSON.parse(e.postData.contents);
  
  var timestamp = data.timestamp || new Date().toLocaleString("vi-VN");
  var orderId = data.orderId || data.id || data.orderNumber || ""; 
  var email = data.email || "";
  var snsLink = data.snsLink || "";
  var customerName = data.customerName || "";
  var phone = data.phone || "";
  var address = data.address || "";
  var shippingMethod = data.shippingMethod || "";
  var note = data.note || "";
  var paidAmount = Number(data.paidAmount) || 0;
  var totalAmount = Number(data.totalAmount) || 0;
  
  var productNames = [];
  var productVersions = [];
  var productQuantities = [];
  
  if (data.items && data.items.length > 0) {
    data.items.forEach(function(item) {
      productNames.push(item.productName || item.name || "Sản phẩm ẩn");
      productVersions.push(item.version || "Mặc định");
      productQuantities.push(item.quantity || 1);
    });
  } else {
    productNames.push(data.productName || "Sản phẩm ẩn");
    productVersions.push(data.version || "Mặc định");
    productQuantities.push(data.quantity || 1);
  }
  
  var prodNameStr = productNames.join(", ");
  var prodVerStr = productVersions.join(", ");
  var prodQtyStr = productQuantities.join(", ");

  // Mảng định nghĩa tiêu đề chuẩn theo cấu trúc mới
  var standardHeaders = [
    "Dấu thời gian", "Mã đơn hàng", "Địa chỉ email", "Link facebook/ instagram/ thread", 
    "Tên sản phẩm", "Phân loại", "Số lượng/ Q", 
    "Bill chuyển khoản/ Proof transfer money (Link ảnh)", "Tên người nhận", 
    "Số điện thoại người nhận", "Địa chỉ người nhận", "Hình thức nhận", 
    "Ghi chú/ Note", "ĐÃ CHUYỂN", "TỔNG ĐƠN HÀNG", "CÂN", "CÒN LẠI", "NOTE"
  ];

  // Khởi tạo hàng tiêu đề nếu mainSheet trống
  if (mainSheet.getLastRow() === 0) {
    mainSheet.appendRow(standardHeaders);
    SpreadsheetApp.flush();
  }

  // Tự động đồng bộ và chèn các cột mới nếu sheet cũ chưa cập nhật cấu trúc
  var headers = mainSheet.getRange(1, 1, 1, mainSheet.getLastColumn()).getValues()[0];
  if (!headers || headers.join("").trim() === "") {
    mainSheet.getRange(1, 1, 1, standardHeaders.length).setValues([standardHeaders]);
    SpreadsheetApp.flush();
    headers = standardHeaders;
  }

  if (headers.indexOf("Mã đơn hàng") === -1) {
    var tsIndex = headers.indexOf("Dấu thời gian");
    if (tsIndex !== -1) {
      mainSheet.insertColumnAfter(tsIndex + 1);
      mainSheet.getRange(1, tsIndex + 2).setValue("Mã đơn hàng");
    }
    SpreadsheetApp.flush();
  }

  headers = mainSheet.getRange(1, 1, 1, mainSheet.getLastColumn()).getValues()[0];
  if (headers.indexOf("Phân loại") === -1) {
    var prodIndex = headers.indexOf("Tên sản phẩm");
    if (prodIndex !== -1) {
      mainSheet.insertColumnAfter(prodIndex + 1);
      mainSheet.getRange(1, prodIndex + 2).setValue("Phân loại");
    }
    SpreadsheetApp.flush();
  }

  var currentHeaders = mainSheet.getRange(1, 1, 1, mainSheet.getLastColumn()).getValues()[0];
  if (!currentHeaders || currentHeaders.join("").trim() === "") {
    currentHeaders = standardHeaders;
  }

  var lastRow = mainSheet.getLastRow() + 1;

  var idxTotal = currentHeaders.indexOf("TỔNG ĐƠN HÀNG");
  var idxPaid = currentHeaders.indexOf("ĐÃ CHUYỂN");
  var idxRemaining = currentHeaders.indexOf("CÒN LẠI");

  var formulaRemaining = "";
  if (idxTotal !== -1 && idxPaid !== -1) {
    formulaRemaining = "=" + getColumnLetter(idxTotal + 1) + lastRow + "-" + getColumnLetter(idxPaid + 1) + lastRow;
  }

  var rowData = new Array(currentHeaders.length);
  for (var k = 0; k < currentHeaders.length; k++) {
    rowData[k] = "";
  }

  function safeSet(colName, value) {
    var idx = currentHeaders.indexOf(colName);
    if (idx !== -1) {
      rowData[idx] = value;
    }
  }

  safeSet("Dấu thời gian", timestamp);
  safeSet("Mã đơn hàng", orderId);
  safeSet("Địa chỉ email", email);
  safeSet("Link facebook/ instagram/ thread", snsLink);
  safeSet("Tên sản phẩm", prodNameStr);
  safeSet("Số lượng/ Q", prodQtyStr);
  safeSet("Bill chuyển khoản/ Proof transfer money (Link ảnh)", data.invoiceImage || "");
  safeSet("Tên người nhận", customerName);
  safeSet("Số điện thoại người nhận", phone);
  safeSet("Địa chỉ người nhận", address);
  safeSet("Hình thức nhận", shippingMethod);
  safeSet("Ghi chú/ Note", note);
  safeSet("ĐÃ CHUYỂN", paidAmount);
  safeSet("TỔNG ĐƠN HÀNG", totalAmount);
  safeSet("CÂN", "");
  safeSet("CÒN LẠI", formulaRemaining);
  safeSet("NOTE", "");
  safeSet("Phân loại", prodVerStr);

  mainSheet.appendRow(rowData);
  
  var range = mainSheet.getRange(lastRow, 1, 1, currentHeaders.length);
  if (paidAmount === totalAmount) {
    range.setBackground("#ffc9c9");
  } else if (paidAmount < totalAmount) {
    range.setBackground("#dbebff");
  }

  // --- Xử lý tách sheet phụ theo sản phẩm ---
  try {
    var targetTabName = prodNameStr.split(new RegExp('\\\\s*[\\\\[\\\\-(]\\\\s*'))[0].trim(); 
    if (targetTabName.length > 30) {
      targetTabName = targetTabName.substring(0, 27) + "...";
    }
    if (!targetTabName) targetTabName = "Đơn Khác";

    var targetSheet = ss.getSheetByName(targetTabName);
    if (!targetSheet) {
      targetSheet = ss.insertSheet(targetTabName);
      targetSheet.appendRow(standardHeaders);
      SpreadsheetApp.flush();
    }
    
    // Đọc lại tiêu đề thực tế của sheet phụ để đổ data khớp cột
    var subHeaders = targetSheet.getRange(1, 1, 1, targetSheet.getLastColumn()).getValues()[0];
    if (!subHeaders || subHeaders.join("").trim() === "") {
      targetSheet.getRange(1, 1, 1, standardHeaders.length).setValues([standardHeaders]);
      SpreadsheetApp.flush();
      subHeaders = standardHeaders;
    }

    var subRowData = new Array(subHeaders.length);
    for (var i = 0; i < subHeaders.length; i++) {
      var headerName = subHeaders[i];
      var mainIdx = currentHeaders.indexOf(headerName);
      if (mainIdx !== -1) {
        subRowData[i] = rowData[mainIdx];
      } else {
        subRowData[i] = "";
      }
    }

    targetSheet.appendRow(subRowData);
    var subLastRow = targetSheet.getLastRow();
    
    var subIdxTotal = subHeaders.indexOf("TỔNG ĐƠN HÀNG");
    var subIdxPaid = subHeaders.indexOf("ĐÃ CHUYỂN");
    var subIdxRemaining = subHeaders.indexOf("CÒN LẠI");
    
    if (subIdxTotal !== -1 && subIdxPaid !== -1 && subIdxRemaining !== -1) {
      var subFormula = "=" + getColumnLetter(subIdxTotal + 1) + subLastRow + "-" + getColumnLetter(subIdxPaid + 1) + subLastRow;
      targetSheet.getRange(subLastRow, subIdxRemaining + 1).setValue(subFormula);
    }
    
    var subRange = targetSheet.getRange(subLastRow, 1, 1, subHeaders.length);
    if (paidAmount === totalAmount) {
      subRange.setBackground("#ffc9c9");
    } else {
      subRange.setBackground("#dbebff");
    }
  } catch(err) {}

  return ContentService.createTextOutput("SUCCESS").setMimeType(ContentService.MimeType.TEXT);
}

function getColumnLetter(colIndex) {
  var temp, letter = '';
  while (colIndex > 0) {
    temp = (colIndex - 1) % 26;
    letter = String.fromCharCode(65 + temp) + letter;
    colIndex = (colIndex - temp - 1) / 26;
  }
  return letter;
}}`}
                </pre>
              </li>
              <li>Nhấp biểu tượng <strong>💾 Lưu (Save)</strong>, sau đó nhấn nút <strong>Deploy (Triển khai)</strong> ở góc phải phía trên &rarr; Chọn <strong>New deployment (Triển khai mới)</strong>.</li>
              <li>Chọn loại là <strong>Web app (Ứng dụng web)</strong> và thiết lập:
                <ul className="list-disc pl-5 mt-1 space-y-1 font-semibold text-neutral-800 text-[11px]">
                  <li>Execute as (Chạy dưới dạng): <span className="text-blue-900 font-bold">Me (Tôi)</span></li>
                  <li>Who has access (Ai có quyền truy cập): <span className="text-blue-900 font-bold">Anyone (Bất kỳ ai / Kể cả không tài khoản)</span></li>
                </ul>
              </li>
              <li>Nhấn <strong>Deploy</strong> &rarr; Google sẽ hiện cửa sổ hỏi cấp quyền truy cập, hãy nhấn <strong>Authorize Access (Cấp quyền)</strong> và cho phép tất cả. Sau đó copy phần <strong>Web App URL</strong> màu xanh hiện ra và dán vào ô nhập bên trên!</li>
            </ol>
          </div>
        </div>
      )}

      {/* Main interactive Tab controller bar */}
      <div className="flex bg-neutral-100 p-1.5 rounded-xl border max-w-2xl select-none">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex-1 py-2.5 text-center text-[11px] sm:text-xs font-display font-medium tracking-wide uppercase rounded-lg transition-all ${
            activeTab === 'orders' 
              ? 'bg-white text-[#1e40af] shadow-sm font-bold border border-neutral-200/80' 
              : 'text-neutral-500 hover:text-neutral-800'
          }`}
        >
          📂 Đơn hàng ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`flex-1 py-2.5 text-center text-[11px] sm:text-xs font-display font-medium tracking-wide uppercase rounded-lg transition-all ${
            activeTab === 'products' 
              ? 'bg-white text-[#1e40af] shadow-sm font-bold border border-neutral-200/80' 
              : 'text-neutral-500 hover:text-neutral-800'
          }`}
        >
          📦 Catalog ({products.length})
        </button>
        <button
          onClick={() => setActiveTab('coupons')}
          className={`flex-1 py-2.5 text-center text-[11px] sm:text-xs font-display font-medium tracking-wide uppercase rounded-lg transition-all ${
            activeTab === 'coupons' 
              ? 'bg-white text-[#1e40af] shadow-sm font-bold border border-neutral-200/80' 
              : 'text-neutral-500 hover:text-neutral-800'
          }`}
        >
          🎟️ Mã giảm ({coupons.length})
        </button>
        <button
          onClick={() => setActiveTab('gmail')}
          className={`flex-1 py-2.5 text-center text-[11px] sm:text-xs font-display font-medium tracking-wide uppercase rounded-lg transition-all ${
            activeTab === 'gmail' 
              ? 'bg-white text-[#1e40af] shadow-sm font-bold border border-neutral-200/80' 
              : 'text-neutral-500 hover:text-neutral-800'
          }`}
        >
          📧 Gmail Center
        </button>
      </div>

      {/* Contextual Views rendering */}
      {activeTab === 'orders' ? (
        <>
          {/* Filters bar controllers */}
          <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-sm flex flex-col md:flex-row gap-4 items-center">
            {/* Search */}
            <div className="relative flex-1 w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Tìm theo tên KH, mã đơn, SĐT, hoặc tên album..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-neutral-300 rounded-lg text-xs bg-neutral-50 placeholder-neutral-400 text-neutral-800 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-black"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Status */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wide">Trạng thái:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs font-medium border border-neutral-300 rounded-lg py-1.5 px-3 focus:outline-none bg-neutral-50 focus:ring-1 focus:ring-blue-400 text-neutral-800 cursor-pointer"
              >
                <option value="All">Tất cả các trạng thái</option>
                <option value="Chờ xác nhận">Chờ xác nhận</option>
                <option value="Đã xác nhận">Đã xác nhận</option>
                <option value="Đang gom hàng">Đang gom hàng</option>
                <option value="Đã bay kho Hàn">Đã bay kho Hàn</option>
                <option value="Đã về Sài Gòn">Đã về Sài Gòn</option>
                <option value="Đã giao cho đơn vị vận chuyển">Đã giao cho đơn vị vận chuyển</option>
                <option value="Đã hoàn thành">Đã hoàn thành</option>
                <option value="Đã hủy">Đã hủy</option>
              </select>
            </div>

            {/* Filter Payment */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wide">Hình thức:</span>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="text-xs font-medium border border-neutral-300 rounded-lg py-1.5 px-3 focus:outline-none bg-neutral-50 focus:ring-1 focus:ring-blue-400 text-neutral-800 cursor-pointer"
              >
                <option value="All">Tất cả thanh toán</option>
                <option value="50%">Đặt cọc 50%</option>
                <option value="100%">Dốc 100%</option>
              </select>
            </div>
          </div>

          {/* Orders counts text with Add Offline Order button right-aligned */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-1 my-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="text-xs text-neutral-500 font-mono">
                Đang tìm thấy: <strong>{filteredOrders.length}</strong> / <strong>{orders.length}</strong> tổng đơn
              </div>
              {(() => {
                const unapprovedCount = orders.filter((ord: any) => ord.status === "Chờ xác nhận").length;
                if (unapprovedCount === 0) return null;
                return (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-display font-bold uppercase tracking-wider rounded-lg animate-pulse">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full inline-block" />
                    <span>Tổng đơn chưa duyệt: {unapprovedCount}</span>
                  </span>
                );
              })()}
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-900 text-xs font-display font-bold tracking-wider uppercase rounded-xl flex items-center space-x-1.5 transition-colors shadow-sm self-end sm:self-auto"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Thêm Đơn Offline</span>
            </button>
          </div>

          {/* Bulk Ship & Automatic Email Notification Control Panel */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-4 sm:p-5 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-neutral-900 font-display uppercase tracking-wider flex items-center space-x-1.5">
                <Truck className="w-4 h-4 text-blue-600" />
                <span>📦 QUẢN LÝ SHIP HÀNG & GỬI MAIL HÀNG LOẠT</span>
              </h3>
              <p className="text-[11px] text-neutral-500">Nhập mã vận đơn nhanh cho các đơn hàng bên dưới, sau đó click nút xác nhận để chuyển trạng thái giao hàng và gửi email hàng loạt.</p>
            </div>
            <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 border border-neutral-300 text-neutral-700 text-xs font-bold tracking-wide rounded-xl flex items-center space-x-1.5 transition-all shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Nhập Excel/CSV</span>
              </button>

              <button
                onClick={handleBulkConfirmShipAndEmail}
                disabled={isBulkSending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-bold tracking-wide uppercase rounded-xl flex items-center space-x-1.5 transition-all shadow-sm"
              >
                {isBulkSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang gửi mail... ({bulkSendProgress}%)</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Xác nhận Ship & Gửi Mail hàng loạt</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Orders List cards flow layout */}
          {filteredOrders.length === 0 ? (
  <div className="text-center py-16 bg-white border border-neutral-200 rounded-xl max-w-sm mx-auto shadow-sm space-y-3">
    <p className="text-sm font-semibold text-neutral-500">🔍 Không tìm thấy đơn hàng nào phù hợp</p>
    <p className="text-xs text-neutral-400">Hãy thử nhập từ khóa tìm kiếm khác hoặc thay đổi bộ lọc trạng thái.</p>
  </div>
) : (
  <div className="space-y-6">
    {/* Thay (orders ?? []) bằng filteredOrders để đồng bộ với điều kiện check trống ở trên */}
    {filteredOrders.map((ord) => {
      // Đống khai báo biến phải nằm TRONG vòng lặp .map() và TRƯỚC lệnh return
      const shipping = ord.shipping || { receiverName: 'Chưa có tên', phone: 'Chưa có SĐT', address: '' };
      const contact = ord.contact || { email: 'Chưa có email', phone: 'Chưa có SĐT' };

      const statusColors: Record<string, string> = {
        "Chờ xác nhận": "bg-yellow-50 text-yellow-700 border-yellow-200",
        "Đã xác nhận": "bg-emerald-50 text-emerald-700 border-emerald-200",
        "Đã vận chuyển": "bg-blue-50 text-blue-700 border-blue-200",
        "Đang gom hàng": "bg-blue-50 text-blue-700 border-blue-200 animate-pulse", // Đã sửa màu bg-blue-55 lỗi thành bg-blue-50
        "Đã bay kho Hàn": "bg-indigo-50 text-indigo-700 border-indigo-200",
        "Đã về Sài Gòn": "bg-emerald-50 text-emerald-700 border-emerald-200",
        "Đã giao cho đơn vị vận chuyển": "bg-amber-50 text-amber-700 border-amber-200",
        "Đã hoàn thành": "bg-neutral-100 text-neutral-700 border-neutral-300", // Đã sửa màu bg-neutral-105 lỗi thành bg-neutral-100
        "Đã hủy": "bg-red-50 text-red-700 border-red-200"
      };

                return (
                  <div 
                    key={ord.id} 
                    className={`bg-white border rounded-2xl shadow-sm overflow-hidden transition-all duration-300 ${
                      ord.status === "Chờ xác nhận" ? 'border-amber-300 ring-2 ring-amber-300/10' : 'border-neutral-200/90'
                    }`}
                  >
                    {/* Header card of Order */}
                    <div className="p-4 sm:p-5 bg-neutral-50 border-b border-neutral-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="flex items-center space-x-3">
                        <span className="font-mono text-sm font-extrabold text-[#1e40af]">{ord.id}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border ${statusColors[ord.status] || "bg-neutral-50 border-neutral-200 text-neutral-700"}`}>
                          {ord.status}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-[11px] text-neutral-400 font-mono w-full sm:w-auto justify-between sm:justify-end">
                        <div className="flex items-center space-x-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{new Date(ord.timestamp).toLocaleString('vi-VN')}</span>
                        </div>
                        
                        <button
                          onClick={() => handleDeleteOrder(ord.id)}
                          className="px-2.5 py-1 text-red-600 bg-red-50 hover:bg-red-100 hover:text-red-700 rounded-lg transition-colors flex items-center space-x-1.5 border border-red-200 font-sans font-bold"
                          title="Xóa vĩnh viễn đơn hàng này"
                        >
                          <Trash2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-[10px] uppercase tracking-wider">Xóa đơn</span>
                        </button>
                      </div>
                    </div>

                    {/* Body Core Grid segments */}
                    <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Left segment specs: Customer Details config */}
                      <div className="lg:col-span-4 space-y-4 font-sans text-xs border-b lg:border-b-0 lg:border-r border-neutral-100 pb-5 lg:pb-0 lg:pr-5">
                        <h4 className="text-[10px] font-mono font-bold text-neutral-400 tracking-widest uppercase mb-1">👤 THÔNG TIN KHÁCH HÀNG:</h4>
                        
                        <div className="space-y-2.5 text-neutral-700">
                          <div className="flex items-center space-x-2">
                            <User className="w-4 h-4 text-neutral-400 shrink-0" />
                            <span className="font-bold text-neutral-900">{ord.shipping?.receiverName || 'Chưa có tên'}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Phone className="w-4 h-4 text-neutral-400 shrink-0" />
                            <span>SĐT: <a href={`tel:${shipping.phone}`} className="font-mono font-bold text-blue-700 hover:underline">{shipping.phone}</a></span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Mail className="w-4 h-4 text-neutral-400 shrink-0" />
                            <span className="text-ellipsis overflow-hidden block">Mail: <a href={`mailto:${ord.contact?.email ?? ""}`} className="text-blue-700 hover:underline">{ord.contact?.email ?? ""}</a></span>
                          </div>
                          {ord.contact?.snsLink && ord.contact?.snsLink !== 'Không có' && (
                            <div className="flex items-center space-x-2">
                              <Link className="w-4 h-4 text-blue-400 shrink-0" />
                              <span className="text-ellipsis overflow-hidden block">SNS: <a href={ord.contact?.snsLink.startsWith('http') ? ord.contact?.snsLink : `https://${ord.contact?.snsLink}`} target="_blank" rel="noreferrer" className="text-blue-700 font-semibold hover:underline flex items-center space-x-0.5 inline-flex">{ord.contact?.snsLink.replace(/^(https?:\/\/)?(www\.)?/, '')}</a></span>
                            </div>
                          )}
                          
                          <div className="border-t border-dashed border-neutral-100 pt-2 space-y-1">
                            <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-wider block">📍 VẬN CHUYỂN TỚI:</span>
                            <p className="text-neutral-600 bg-neutral-50 p-2 rounded-lg text-[11px] leading-relaxed border">
                              {ord.shipping?.address || "Chưa có địa chỉ"}
                            </p>
                            <div className="flex items-center space-x-1.5 mt-1">
                              <span className="text-[10px] font-mono text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-semibold">Đơn vị: {ord.shipping?.method ?? ""}</span>
                            </div>
                          </div>

                          <div className="border-t border-dashed border-neutral-100 pt-2 mt-2 space-y-2.5">
                            {/* 1. Trên cùng: Ô nhập phí vận chuyển Hàn - Việt */}
                            <div className="space-y-1">
                              <span className="text-[9px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 uppercase tracking-wider inline-block font-semibold">⚖️ PHÍ VẬN CHUYỂN HÀN - VIỆT (CÂN NẶNG):</span>
                              <input
                                type="number"
                                min="0"
                                placeholder="Nhập phí cân nặng (đ)..."
                                value={orderWeightFees[ord.id] !== undefined ? orderWeightFees[ord.id] : ''}
                                onChange={(e) => {
                                  const val = Math.max(0, Number(e.target.value) || 0);
                                  setOrderWeightFees(prev => ({ ...prev, [ord.id]: val }));
                                }}
                                className="w-full px-2.5 py-1.5 border border-indigo-200 rounded-lg text-xs bg-indigo-50/30 placeholder-neutral-400 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 text-neutral-800 font-bold"
                              />
                            </div>

                            {/* 2. Ở giữa: Nút "GỬI MAIL THÔNG BÁO HÀNG VỀ" */}
                            <button
                              onClick={() => {
                                setArrivalOrder(ord);
                                setWeightFee(orderWeightFees[ord.id] || 0);
                                setIsArrivalModalOpen(true);
                              }}
                              className="w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold font-display uppercase tracking-wider text-[10px] rounded-lg shadow-sm flex items-center justify-center space-x-1.5 transition-all"
                              title="Gửi mail thông báo hàng về & yêu cầu thanh toán số tiền còn lại + phí cân nặng"
                            >
                              <Mail className="w-3.5 h-3.5 text-white" />
                              <span>GỬI MAIL THÔNG BÁO HÀNG VỀ</span>
                            </button>

                            {/* 3. Dưới cùng: Ô nhập mã vận đơn */}
                            <div className="space-y-1 pt-1.5 border-t border-neutral-100 border-dashed">
                              <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-wider block font-semibold">🚛 MÃ VẬN ĐƠN (TRACKING CODE):</span>
                              <input
                                type="text"
                                placeholder="Nhập mã vận đơn nhanh..."
                                value={ord.trackingCode || ''}
                                onChange={async (e) => {
                                  const newVal = e.target.value;
                                  // 1. Cập nhật UI cục bộ ngay lập tức để gõ phím mượt mà không bị giật
                                  setOrders(prev => prev.map(o => o.id === ord.id ? { ...o, trackingCode: newVal } : o));
                                  // 2. Lưu bất đồng bộ lên Firestore ngầm mà không gán Promise vào state
                                  await updateOrderTrackingCode(ord.id, newVal);
                                }}
                                className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-lg text-xs bg-neutral-50 placeholder-neutral-400 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 text-neutral-800"
                              />
                            </div>

                            {/* 4. Dưới nữa: Nút "GỬI MAIL SHIP HÀNG" */}
                            {((ord.status === "Đã vận chuyển") || (ord.trackingCode && ord.trackingCode.trim().length > 0)) && (
                              <button
                                onClick={() => handleSendShippingEmail(ord.id)}
                                className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold font-display uppercase tracking-wider text-[10px] rounded-lg shadow-sm flex items-center justify-center space-x-1.5 transition-all"
                                title="Gửi mail thông báo vận chuyển kèm mã vận đơn tới khách hàng"
                              >
                                <Mail className="w-3.5 h-3.5 text-white" />
                                <span>GỬI MAIL SHIP HÀNG</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Middle segment: Items Bought and Notes */}
                      <div className="lg:col-span-5 space-y-4">
                        <h4 className="text-[10px] font-mono font-bold text-neutral-400 tracking-widest uppercase">📦 SẢN PHẨM KHÁCH ĐẶT:</h4>
                        <div className="space-y-3.5">
                          {(ord.items ?? []).map((item, idx) => {
                            const getPrice = (cItem: CartItem) => {
                              if (!cItem || !cItem.product) return 0;
                              if (cItem.product.variantMatrix && cItem.product.variantMatrix.length > 0) {
                                const matched = cItem.product.variantMatrix.find(v => {
                                  if (!v) return false;
                                  const combinedName = v.option2 ? `${v.option1} - ${v.option2}` : v.option1;
                                  return combinedName === cItem.version;
                                });
                                if (matched) return matched.price;
                              }
                              if (cItem.product.variations && cItem.product.variations.length > 0) {
                                const variation = cItem.product.variations.find(v => v && v.name === cItem.version);
                                if (variation) return variation.price;
                              }
                              return cItem.product.price || 0;
                            };
                            const itemPrice = Number(getPrice(item)) || 0;
                            return (
                              <div key={idx} className="flex items-start space-x-3 bg-neutral-50 border p-2.5 rounded-xl text-xs">
                                {item?.product?.image && (
                                  <img 
                                    src={item.product.image} 
                                    alt={item.product.name} 
                                    className="w-11 h-11 object-cover rounded-lg border bg-white shrink-0"
                                    referrerPolicy="no-referrer"
                                  />
                                )}
                                <div className="flex-1 min-w-0 space-y-1">
                                  <h5 className="font-bold text-neutral-900 truncate" title={item?.product?.name || "Sản phẩm"}>{item?.product?.name || "Sản phẩm"}</h5>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[10px] font-semibold text-neutral-500 bg-white border px-1.5 py-0.5 rounded">
                                      {item?.version || ""}
                                    </span>
                                    <span className="text-[10px] font-mono text-neutral-500 font-bold bg-white border px-1.5 py-0.5 rounded">
                                      Qty: {item?.quantity || 1}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="font-mono text-neutral-900 block font-bold">{((itemPrice * (item?.quantity || 1)) || 0).toLocaleString('vi-VN')} đ</span>
                                  <span className="text-[9px] font-mono text-neutral-400 block font-semibold">{(itemPrice || 0).toLocaleString('vi-VN')} đ/cái</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Customer Notes block */}
                        <div className="space-y-1">
                          <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-wider block">📝 GHI CHÚ TỪ KHÁCH:</span>
                          <p className="bg-amber-50/40 text-amber-900 border border-amber-200 p-3 rounded-xl text-[11px] leading-relaxed italic">
                            "{ord.note}"
                          </p>
                        </div>
                      </div>

                      {/* Right segment: Billing & Admin quick Status setters */}
                      <div className="lg:col-span-3 space-y-4 lg:pl-4 flex flex-col justify-between">
                        <div>
                          <h4 className="text-[10px] font-mono font-bold text-neutral-400 tracking-widest uppercase block mb-1">💵 THANH TOÁN & HÓA ĐƠN:</h4>
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-neutral-500 font-sans">Tổng giá trị đơn:</span>
                              <strong className="font-mono text-neutral-900 font-extrabold">{(ord.subtotal ?? 0).toLocaleString('vi-VN')} đ</strong>
                            </div>
                            <div className="flex justify-between items-center text-xs pb-2 border-b">
                              <span className="text-neutral-500 font-sans">Hình thức GD:</span>
                              <span className="font-mono text-[10px] font-bold text-blue-800 bg-blue-5 px-2 py-0.5 rounded border border-blue-200">{ord.payment?.method || "Chưa xác định"}</span>
                            </div>

                            {/* Cập nhật Số tiền đã chuyển (paidAmount) */}
                            <div className="pt-2 pb-2 border-b space-y-1.5">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-neutral-500 font-sans">Đã chuyển:</span>
                                <strong className="font-mono text-emerald-700 font-extrabold">
                                  {(ord.paidAmount !== undefined 
                                    ? ord.paidAmount 
                                    : (ord.payment?.method?.toLowerCase().includes('50%') || 
                                       ord.payment?.method?.toLowerCase().includes('cọc') || 
                                       ord.payment?.method?.toLowerCase().includes('đặt cọc') 
                                        ? Math.round((ord.subtotal ?? 0) * 0.5) 
                                        : (ord.subtotal ?? 0))
                                  ).toLocaleString('vi-VN')} đ
                                </strong>
                              </div>
                              <div className="flex items-center space-x-1.5">
                                <input
                                  type="number"
                                  placeholder="Sửa số tiền..."
                                  id={`paid-amount-${ord.id}`}
                                  defaultValue={ord.paidAmount !== undefined 
                                    ? ord.paidAmount 
                                    : (ord.payment?.method?.toLowerCase().includes('50%') || 
                                       ord.payment?.method?.toLowerCase().includes('cọc') || 
                                       ord.payment?.method?.toLowerCase().includes('đặt cọc') 
                                        ? Math.round((ord.subtotal ?? 0) * 0.5) 
                                        : (ord.subtotal ?? 0))}
                                  className="w-full px-2 py-1 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-neutral-800"
                                />
                                <button
                                  onClick={async () => {
                                    const inputEl = document.getElementById(`paid-amount-${ord.id}`) as HTMLInputElement;
                                    if (inputEl) {
                                      const val = Number(inputEl.value);
                                      if (!isNaN(val)) {
                                        await handleUpdatePaidAmount(ord.id, val);
                                      }
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase font-bold rounded transition-colors whitespace-nowrap shadow-sm active:scale-95"
                                >
                                  Cập nhật
                                </button>
                              </div>
                            </div>

                            {/* Invoice payment proof screenshot widget display check */}
                            <div className="pt-1.5">
                              <span className="text-[9px] font-mono text-neutral-400 block mb-1 uppercase">ẢNH CHỤP GIAO DỊCH (PROOF):</span>
                              {ord.payment?.invoiceImage ? (
                                <button
                                  onClick={() => setSelectedInvoiceImg(ord.payment?.invoiceImage || "")}
                                  className="relative group block w-full h-16 border border-neutral-300 rounded-lg overflow-hidden focus:outline-none focus:ring-1 focus:ring-blue-400"
                                >
                                  <img 
                                    src={ord.payment?.invoiceImage || ""} 
                                    alt="Payment proof upload screen" 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center text-white text-[10px] font-mono opacity-100 tracking-widest uppercase transition-colors">
                                    <Eye className="w-3.5 h-3.5 mr-0.5" /> Phóng To
                                  </div>
                                </button>
                              ) : (
                                <div className="text-[10px] p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-400 text-center italic">
                                  ⚠️ Đơn Offline / Không có ảnh bill tải lên
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status updater action blocks */}
                        <div className="pt-2 space-y-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-wider block">CẬP NHẬT TRẠNG THÁI:</span>
                            <select
                              value={ord.status}
                              onChange={(e) => handleUpdateStatus(ord.id, e.target.value)}
                              className="text-xs font-semibold border border-neutral-300 rounded-lg py-1 px-2 focus:outline-none bg-neutral-50 text-neutral-800 cursor-pointer"
                            >
                              <option value="Chờ xác nhận">Chờ xác nhận</option>
                              <option value="Đã xác nhận">Đã xác nhận</option>
                              <option value="Đã vận chuyển">Đã vận chuyển</option>
                              {ord.status !== "Chờ xác nhận" && ord.status !== "Đã xác nhận" && ord.status !== "Đã vận chuyển" && (
                                <option value={ord.status}>{ord.status}</option>
                              )}
                            </select>
                          </div>

                          <div className="flex justify-between items-center gap-2 pt-1 border-t border-neutral-100">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleUpdateStatus(ord.id, "Đã hủy")}
                                className="text-[10px] font-display text-neutral-400 hover:text-red-700 font-semibold mr-2"
                                title="Hủy đơn hàng này"
                              >
                                🚫 Hủy Đơn
                              </button>

                              {ord.status === "Chờ xác nhận" && (
                                <button
                                  onClick={() => handleConfirmOrder(ord.id)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold font-display uppercase tracking-wider text-[9px] rounded-lg shadow-sm flex items-center space-x-1 transition-all"
                                  title="Duyệt đơn hàng và gửi email tự động"
                                >
                                  <CheckCircle2 className="w-3 h-3 text-white" />
                                  <span>Duyệt Đơn</span>
                                </button>
                              )}
                            </div>

                            <button
                              onClick={() => handleDeleteOrder(ord.id)}
                              className="text-[10px] font-display text-neutral-400 hover:text-red-700 flex items-center space-x-0.5 hover:underline"
                              title="Xóa vĩnh viễn"
                            >
                              <Trash2 className="w-3 h-3 text-red-600/80" />
                              <span>Xóa đơn</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : activeTab === 'products' ? (
        /* PRODUCT CATALOG MANAGEMENT TAB */
        <>
          {/* Controls Panel */}
          <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-sm flex flex-col md:flex-row gap-4 items-center">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Tìm sản phẩm theo tên, danh mục hoặc spec..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-neutral-300 rounded-lg text-xs bg-neutral-50 placeholder-neutral-400 text-neutral-800 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              {productSearch && (
                <button 
                  onClick={() => setProductSearch('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-black"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Category */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wide">Danh mục:</span>
              <select
                value={productCatFilter}
                onChange={(e) => setProductCatFilter(e.target.value)}
                className="text-xs font-medium border border-neutral-300 rounded-lg py-1.5 px-3 focus:outline-none bg-neutral-50 focus:ring-1 focus:ring-blue-400 text-neutral-800 cursor-pointer"
              >
                <option value="All">Tất cả danh mục</option>
                {Array.from(new Set((products || []).map(p => p?.category).filter(Boolean))).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Table display list of Catalog */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-1 my-3">
            <div className="text-xs text-neutral-500 font-mono">
              Đang tìm thấy: <strong>{filteredProducts.length}</strong> / <strong>{products.length}</strong> sản phẩm
            </div>
            
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={handlePersistCatalogChanges}
                className={`px-4 py-2 border text-xs font-display font-bold tracking-wider uppercase rounded-xl flex items-center space-x-1.5 transition-all shadow-sm ${
                  hasUnsavedCatalogChanges
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 border-amber-600 hover:from-amber-600 hover:to-orange-700 text-white animate-pulse'
                    : 'bg-[#e8f0ff] border-blue-300 text-blue-900 hover:bg-blue-105'
                }`}
                title="Bấm để lưu vĩnh viễn danh sách sản phẩm mới vào LocalStorage"
              >
                <Save className="w-4 h-4" />
                <span>Lưu thay đổi</span>
              </button>

              <button
                onClick={handleOpenAddProduct}
                className="px-4 py-2 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-900 text-xs font-display font-bold tracking-wider uppercase rounded-xl flex items-center space-x-1.5 transition-colors shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Thêm Sản Phẩm</span>
              </button>
            </div>
          </div>

          <div className="bg-white border rounded-2xl shadow-sm overflow-hidden border-neutral-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans border-collapse">
                <thead className="bg-neutral-50 border-b font-mono text-[10px] text-neutral-400 uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Ảnh</th>
                    <th className="p-4">Tên Sản Phẩm</th>
                    <th className="p-4">Danh Mục</th>
                    <th className="p-4">Trạng Thái (Tag)</th>
                    <th className="p-4 text-right">Đơn Giá (đ)</th>
                    <th className="p-4">Phân Loại / Size</th>
                    <th className="p-4 text-center">Hành Động</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-neutral-700">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-neutral-400 italic">
                        🔍 Không có sản phẩm nào phù hợp với bộ lọc tìm kiếm.
                      </td>
                    </tr>
                  ) : (
                    (filteredProducts || []).map((p) => (
                      <tr key={p.id} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="p-4">
                          <img 
                            src={p.image} 
                            alt={p.name} 
                            className="w-10 h-10 object-cover rounded-lg border bg-white shrink-0" 
                            referrerPolicy="no-referrer"
                          />
                        </td>
                        <td className="p-4 max-w-[220px]">
                          <div className="font-semibold text-neutral-900 truncate" title={p.name}>{p.name}</div>
                          <div className="text-[10px] text-neutral-400 font-mono mt-0.5">ID: {p.id} | Nhóm: {p.artist || 'Chưa phân loại'}</div>
                        </td>
                        <td className="p-4">
                          <span className="bg-neutral-100 text-neutral-600 px-2 py-0.5 border rounded-md text-[10.5px]">
                            {p.category}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase border ${
                            p.tag?.toLowerCase() === 'sẵn hàng' ? 'bg-emerald-50 text-emerald-700 border-emerald-250' :
                            p.tag?.toLowerCase() === 'pre-order' ? 'bg-blue-50 text-blue-700 border-blue-250' : 'bg-amber-50 text-amber-700 border-amber-250'
                          }`}>
                            {p.tag}
                          </span>
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-neutral-900">
                          {(Number(p.price) || 0).toLocaleString('vi-VN')} đ
                        </td>
                        <td className="p-4 max-w-[180px]">
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(p.versions) && p.versions.length > 0 ? (
                              (p.versions || []).map((v, i) => (
                                <span key={i} className="bg-neutral-50 border text-neutral-500 px-1 py-0.5 rounded text-[9.5px]">
                                  {v}
                                </span>
                              ))
                            ) : (
                              <span className="text-neutral-400 text-[10.5px] font-mono">—</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center items-center gap-2">
                            <button
                              onClick={() => handleOpenEditProduct(p)}
                              className="px-2.5 py-1.5 border border-blue-300 text-blue-900 bg-blue-50 hover:bg-blue-100 font-display font-bold text-[10px] uppercase rounded-lg transition-colors"
                              title="Sửa thông tin sản phẩm"
                            >
                              Sửa
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p.id, p.name)}
                              className="p-1.5 hover:bg-red-50 text-red-650 rounded-lg hover:text-red-700 transition-colors border border-transparent hover:border-red-200"
                              title="Xóa vĩnh viễn"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-neutral-50 p-4 border-t flex flex-col sm:flex-row justify-between items-center text-[11px] text-neutral-400 gap-2">
              <span>Đang hiển thị {filteredProducts.length} trên tổng số {products.length} dòng sản phẩm</span>
              <span>* Catalog được đồng bộ toàn diện trên LocalStorage và phản ánh lập tức tại trang chủ khách</span>
            </div>
          </div>
        </>
      ) : activeTab === 'coupons' ? (
        /* COUPONS MANAGEMENT TAB */
        <>
          {/* Header Controls */}
          <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="text-sm font-display font-bold text-blue-900 uppercase">Quản lý mã giảm giá (Coupons)</h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">Thêm hoặc xóa các mã giảm giá áp dụng khi khách hàng thanh toán.</p>
            </div>
            <button
              onClick={() => setIsCouponModalOpen(true)}
              className="w-full sm:w-auto px-5 py-2.5 bg-blue-900 text-white font-display font-bold text-xs uppercase tracking-wide rounded-xl shadow-md hover:bg-blue-950 transition-all flex items-center justify-center space-x-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Thêm mã giảm giá mới</span>
            </button>
          </div>

          {/* Table display list of Coupons */}
          <div className="bg-white border rounded-2xl shadow-sm overflow-hidden border-neutral-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans border-collapse">
                <thead className="bg-neutral-50 border-b font-mono text-[10px] text-neutral-400 uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Tên Mã (Code)</th>
                    <th className="p-4">Mức Giảm</th>
                    <th className="p-4">Danh Mục / Sản Phẩm Áp Dụng</th>
                    <th className="p-4 text-center">Lượt Sử Dụng Tối Đa</th>
                    <th className="p-4">Hạn Áp Dụng (Expiry Date)</th>
                    <th className="p-4 text-center">Hành Động</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-neutral-700">
                  {coupons.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-neutral-400 italic">
                        🎟️ Chưa có mã giảm giá nào được tạo.
                      </td>
                    </tr>
                  ) : (
                    (coupons || []).map((c) => (
                      <tr key={c.code} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="p-4 font-mono font-bold text-blue-900 text-sm">
                          {c.code}
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-1 bg-emerald-50 text-emerald-800 rounded-md font-semibold font-mono">
                            {c.discountType === 'percentage' ? `${c.discountValue}%` : `${(c.discountValue ?? 0).toLocaleString('vi-VN')} đ`}
                          </span>
                        </td>
                        <td className="p-4 text-neutral-650 font-medium">
                          {c.applicableProducts}
                        </td>
                        <td className="p-4 text-center font-mono font-bold">
                          {c.usedCount} / {c.maxUsage}
                        </td>
                        <td className="p-4 font-mono">
                          {c.expiryDate}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleDeleteCoupon(c.code)}
                            className="p-1.5 hover:bg-red-50 text-red-650 rounded-lg hover:text-red-700 transition-colors border border-transparent hover:border-red-200"
                            title="Xóa vĩnh viễn"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-650" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="bg-neutral-50 p-4 border-t text-[11px] text-neutral-400">
              * Mã giảm giá hoạt động theo thời gian thực và được lưu trữ trên LocalStorage của hệ thống.
            </div>
          </div>
        </>
      ) : (
        /* GMAIL CENTER TAB */
        <>
          {window.self !== window.top && (
            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-start space-x-2.5 shadow-sm leading-relaxed animate-fade-in mb-4">
              <span className="text-base shrink-0">⚠️</span>
              <div>
                <strong className="block mb-0.5 font-display text-amber-900 uppercase tracking-wide">Môi trường Xem thử (Iframe) phát hiện:</strong>
                Đăng nhập Google (Firebase Auth) có thể bị trình duyệt chặn do chính sách bảo mật bảo vệ iframe chéo nguồn. Nếu gặp lỗi khi kết nối, vui lòng click nút <strong className="text-blue-900 font-extrabold uppercase">"Mở trong tab mới" (Open in a new tab)</strong> ở góc trên cùng bên phải cửa sổ xem thử để chạy ứng dụng độc lập, sau đó thực hiện kết nối Gmail bình thường.
              </div>
            </div>
          )}

          {/* Header Controls */}
          <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-sm font-display font-bold text-blue-900 uppercase flex items-center space-x-1.5 select-none">
                <Mail className="w-4 h-4 text-blue-900" />
                <span>Trung tâm quản lý Gmail (Gmail Center)</span>
              </h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">Kết nối Gmail cá nhân để quản trị hòm thư, gửi hóa đơn thanh toán & cập nhật trạng thái đơn cho khách.</p>
            </div>
            {gmailUser ? (
              <div className="flex items-center space-x-3 bg-neutral-50 p-2 rounded-xl border border-neutral-200">
                <div className="w-8 h-8 rounded-full bg-blue-100 overflow-hidden border border-neutral-300">
                  {gmailUser.photoURL ? (
                    <img src={gmailUser.photoURL} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-xs text-blue-900">
                      {gmailUser.displayName?.charAt(0) || "G"}
                    </div>
                  )}
                </div>
                <div className="text-left text-xs">
                  <span className="font-semibold text-neutral-800 block leading-tight">{gmailUser.displayName || "Admin"}</span>
                  <span className="text-[10px] text-neutral-400 font-mono block">
  {gmailUser?.email || "Chưa kết nối Gmail"}
</span>
                </div>
                <button
                  onClick={handleAdminGmailLogout}
                  className="px-2.5 py-1.5 border border-red-250 text-red-750 bg-red-50 hover:bg-red-100 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all"
                >
                  Đăng xuất
                </button>
              </div>
            ) : (
              <button
                onClick={handleAdminGmailLogin}
                className="w-full sm:w-auto px-5 py-2.5 bg-neutral-900 hover:bg-black text-white font-display font-bold text-xs uppercase tracking-wide rounded-xl shadow-md transition-all flex items-center justify-center space-x-1.5 border border-neutral-800"
              >
                <Mail className="w-4 h-4 text-red-400" />
                <span>KẾT NỐI TÀI KHOẢN GMAIL</span>
              </button>
            )}
          </div>



          {!gmailToken ? (
            /* Locked State */
            <div className="bg-white border rounded-2xl shadow-sm overflow-hidden border-neutral-200 p-10 text-center space-y-4">
              <div className="w-16 h-16 bg-blue-50 border border-blue-200 rounded-full flex items-center justify-center text-blue-900 mx-auto">
                <Lock className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-display font-bold text-neutral-800 uppercase tracking-wide">YÊU CẦU KẾT NỐI GMAIL</h4>
                <p className="text-xs text-neutral-500 max-w-md mx-auto">
                  Để xem danh sách email và sử dụng tính năng gửi email chăm sóc khách hàng qua Gmail API, bạn cần cấp quyền truy cập tài khoản Google Workspace của bạn.
                </p>
              </div>
              <button
                onClick={handleAdminGmailLogin}
                className="mx-auto px-6 py-2.5 bg-blue-900 hover:bg-blue-950 text-white font-display font-bold text-xs uppercase tracking-widest rounded-xl shadow transition-all flex items-center justify-center space-x-2"
              >
                <Mail className="w-4 h-4" />
                <span>Bắt đầu kết nối</span>
              </button>
            </div>
          ) : (
            /* Active Dashboard (Full width, focus on dispatching emails) */
            <div className="w-full space-y-6">
              
              {/* Sending Panel (Takes full width) */}
              <div className="bg-white border rounded-2xl shadow-sm border-neutral-250 p-6 space-y-4 text-left">
                <div className="border-b border-neutral-200 pb-3">
                  <h4 className="text-xs font-mono font-bold text-neutral-700 uppercase">GỬI EMAIL CHĂM SÓC KHÁCH HÀNG</h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">Soạn thư thủ công hoặc áp dụng nhanh mẫu thông báo đồng bộ trạng thái đơn hàng.</p>
                </div>

                {/* Advanced Multi-Select Order Section */}
                <div className="space-y-4 border border-neutral-200 p-4 rounded-xl bg-neutral-50/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Search & Filter Dropdown */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-bold text-neutral-500 block uppercase">
                        🔍 Lọc theo sản phẩm khách đặt:
                      </label>
                      <select
                        value={productFilterText}
                        onChange={(e) => setProductFilterText(e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white text-neutral-800"
                      >
                        <option value="">-- Chọn sản phẩm để lọc nhanh --</option>
                        {(uniqueProductNames || []).map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                      <p className="text-[9px] text-neutral-400">
                        * Tự động tích chọn toàn bộ đơn hàng có chứa sản phẩm đã chọn.
                      </p>
                    </div>

                    {/* Template selection & actions */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-bold text-neutral-500 block uppercase">
                        Chọn Mẫu Email (Template):
                      </label>
                      <select
                        value={bulkTemplateType}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBulkTemplateType(val);
                          // Sync preview to form input if at least one order is selected
                          if (selectedOrderIds.length > 0) {
                            const firstOrd = orders.find(o => o.id === selectedOrderIds[0]);
                            if (firstOrd && val !== 'custom') {
                              const content = getEmailContentForOrder(firstOrd, val);
                              setEmailFormSubject(content.subject);
                              setEmailFormBody(content.body);
                              setEmailFormTo(firstOrd.contact?.email ?? "");
                            }
                          }
                        }}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white text-neutral-800"
                      >
                        <option value="deposit">Mẫu 1: Xác nhận đơn hàng</option>
                        <option value="arrival">Mẫu 2: Thông báo hàng về & Thanh toán</option>
                        <option value="custom">Thư trống (Nhập tay bên dưới)</option>
                      </select>
                    </div>
                  </div>

                  {/* Filter Status Message Indicator Banner */}
                  <div className={`p-3 rounded-lg text-xs font-medium flex items-center space-x-2 border transition-all ${
                    selectedOrderIds.length > 0 
                      ? 'bg-blue-50/80 border-blue-200 text-blue-900 font-semibold' 
                      : 'bg-neutral-100 border-neutral-200 text-neutral-500'
                  }`}>
                    <span>{filterStatusMessage}</span>
                  </div>

                  {/* Scrollable Order List Selector */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono font-bold text-neutral-600">
                        DANH SÁCH ĐƠN HÀNG ({selectedOrderIds.length}/{orders.length} ĐÃ CHỌN)
                      </span>
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            const allIds = (orders ?? []).map(o => o.id);
                            setSelectedOrderIds(allIds);
                            // Set first recipient
                            if (allIds.length > 0) {
                              const firstOrd = orders.find(o => o.id === allIds[0]);
                              if (firstOrd) {
                                setEmailFormTo(firstOrd.contact?.email ?? "");
                                if (bulkTemplateType !== 'custom') {
                                  const content = getEmailContentForOrder(firstOrd, bulkTemplateType);
                                  setEmailFormSubject(content.subject);
                                  setEmailFormBody(content.body);
                                }
                              }
                            }
                          }}
                          className="px-2.5 py-1 bg-blue-900 hover:bg-blue-950 text-white text-[10px] font-bold uppercase rounded transition-colors"
                        >
                          CHỌN TẤT CẢ
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrderIds([]);
                            setEmailFormTo('');
                          }}
                          className="px-2.5 py-1 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 text-[10px] font-bold uppercase rounded transition-colors"
                        >
                          BỎ CHỌN TẤT CẢ
                        </button>
                      </div>
                    </div>

                    <div className="max-h-[160px] overflow-y-auto border border-neutral-200 rounded-lg bg-white divide-y divide-neutral-100 p-1">
                      {orders.length === 0 ? (
                        <div className="text-center py-6 text-xs text-neutral-400">Không tìm thấy đơn hàng nào</div>
                      ) : (
                        (orders ?? []).map((o) => {
                          const isChecked = selectedOrderIds.includes(o.id);
                          const productsSummary = (o?.items ?? []).map(i => `${i?.product?.name || "SP"} (x${i?.quantity || 1})`).join(', ');
                          return (
                            <label
                              key={o.id}
                              className={`flex items-start space-x-3 p-2.5 hover:bg-neutral-50 cursor-pointer rounded-md transition-colors ${isChecked ? 'bg-blue-50/40' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  let updated: string[];
                                  if (e.target.checked) {
                                    updated = [...selectedOrderIds, o.id];
                                  } else {
                                    updated = selectedOrderIds.filter(id => id !== o.id);
                                  }
                                  setSelectedOrderIds(updated);
                                  
                                  // Update template preview if there's any selection
                                  if (updated.length > 0) {
                                    const singleOrd = orders.find(ord => ord.id === updated[0]);
                                    if (singleOrd) {
                                      setEmailFormTo(singleOrd.contact?.email ?? "");
                                      if (bulkTemplateType !== 'custom') {
                                        const content = getEmailContentForOrder(singleOrd, bulkTemplateType);
                                        setEmailFormSubject(content.subject);
                                        setEmailFormBody(content.body);
                                      }
                                    }
                                  } else {
                                    setEmailFormTo('');
                                  }
                                }}
                                className="mt-0.5 rounded border-neutral-300 text-blue-900 focus:ring-blue-400"
                              />
                              <div className="flex-1 min-w-0 text-xs text-left">
                                <div className="flex justify-between">
                                  <span className="font-mono font-bold text-neutral-800">#{o.id}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                    o.status === 'Chờ xác nhận' ? 'bg-amber-100 text-amber-800' :
                                    o.status === 'Đã hoàn thành' ? 'bg-emerald-100 text-emerald-800' :
                                    'bg-blue-100 text-blue-800'
                                  }`}>{o.status}</span>
                                </div>
                                <div className="text-[11px] text-neutral-600 font-medium">
                                  {o.shipping?.receiverName || 'Chưa có tên'} • <span className="font-mono text-[10px]">{o.contact?.email || 'Chưa có email'}</span>
                                </div>
                                <div className="text-[10px] text-neutral-400 truncate mt-0.5">
                                  Sản phẩm: {productsSummary}
                                </div>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Email Fields Form */}
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-[10px] font-mono font-bold text-neutral-500 block mb-1 uppercase">
                      {selectedOrderIds.length > 1 ? `Email Người Nhận (Gửi hàng loạt ${selectedOrderIds.length} người):` : 'Email Người Nhận:'}
                    </label>
                    <input
                      type="email"
                      value={selectedOrderIds.length > 1 ? (selectedOrderIds ?? []).map(id => (orders || []).find(o => o.id === id)?.contact?.email).filter(Boolean).join(', ') : emailFormTo}
                      onChange={(e) => {
                        if (selectedOrderIds.length <= 1) {
                          setEmailFormTo(e.target.value);
                        }
                      }}
                      disabled={selectedOrderIds.length > 1}
                      placeholder="vd: khachhang@gmail.com"
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-neutral-50 font-medium font-mono disabled:opacity-70"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono font-bold text-neutral-500 block mb-1 uppercase">Tiêu Đề (Subject):</label>
                    <input
                      type="text"
                      value={emailFormSubject}
                      onChange={(e) => setEmailFormSubject(e.target.value)}
                      placeholder="Tiêu đề email..."
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-neutral-50 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono font-bold text-neutral-500 block mb-1 uppercase">Nội Dung Thư (HTML body):</label>
                    <textarea
                      rows={8}
                      value={emailFormBody}
                      onChange={(e) => setEmailFormBody(e.target.value)}
                      placeholder="Nhập nội dung HTML hoặc văn bản của email..."
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 bg-neutral-50 leading-relaxed"
                    />
                  </div>
                </div>

                {/* Action feedback */}
                {emailSendSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg font-medium">
                    {emailSendSuccess}
                  </div>
                )}
                {emailSendError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg font-medium">
                    {emailSendError}
                  </div>
                )}

                {/* Send action */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSendAdminEmail}
                    disabled={emailSendLoading || (selectedOrderIds.length === 0 && !emailFormTo) || !emailFormSubject || !emailFormBody}
                    className="w-full sm:w-auto px-6 py-2.5 bg-blue-900 hover:bg-blue-950 text-white font-display font-bold text-xs uppercase tracking-wider rounded-xl shadow transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {emailSendLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Đang thực thi gửi Gmail API...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        <span>
                          {selectedOrderIds.length > 1 
                            ? `Gửi hàng loạt (${selectedOrderIds.length} ĐƠN HÀNG)` 
                            : 'Xác nhận gửi email ngay'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          )}
        </>
      )}

      {/* MODAL: View Gmail Message Details */}
      {selectedGmailMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in">
          <div className="relative bg-white max-w-lg w-full rounded-2xl overflow-hidden shadow-2xl border border-neutral-200">
            <div className="p-4 border-b flex justify-between items-center bg-neutral-50">
              <span className="text-xs font-mono font-bold text-neutral-600 uppercase">CHI TIẾT EMAIL GMAIL</span>
              <button 
                onClick={() => setSelectedGmailMsg(null)}
                className="p-1 hover:bg-neutral-200 rounded-full transition-colors text-neutral-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-left">
              <div>
                <span className="text-[10px] font-mono text-neutral-400 block uppercase">Người gửi (From):</span>
                <strong className="text-neutral-800 text-xs">{selectedGmailMsg.from}</strong>
              </div>
              <div>
                <span className="text-[10px] font-mono text-neutral-400 block uppercase">Chủ đề (Subject):</span>
                <strong className="text-neutral-900 text-sm leading-tight block mt-0.5">{selectedGmailMsg.subject}</strong>
              </div>
              <div>
                <span className="text-[10px] font-mono text-neutral-400 block uppercase">Nội dung tóm lược (Snippet):</span>
                <p className="text-neutral-600 text-xs leading-relaxed bg-neutral-50 p-3 rounded-lg border border-neutral-100 mt-1 whitespace-pre-wrap">
                  {selectedGmailMsg.snippet}
                </p>
              </div>
            </div>
            <div className="p-4 bg-neutral-50 border-t flex justify-end">
              <button 
                onClick={() => setSelectedGmailMsg(null)}
                className="px-5 py-2 bg-neutral-200 text-neutral-700 hover:bg-neutral-300 rounded-xl text-xs font-bold font-display uppercase tracking-wider transition-colors"
              >
                Đóng lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Large full-sized transaction proof photo screenshot zoomer */}
      {selectedInvoiceImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-fade-in">
          <div className="relative bg-white max-w-lg w-full rounded-2xl overflow-hidden shadow-2xl border border-neutral-200">
            <div className="p-4 border-b flex justify-between items-center bg-neutral-50">
              <span className="text-xs font-mono font-bold text-neutral-600 uppercase">ẢNH CHỤP MINH CHỨNG THANH TOÁN</span>
              <button 
                onClick={() => setSelectedInvoiceImg(null)}
                className="p-1 hover:bg-neutral-200 rounded-full transition-colors text-neutral-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-neutral-100 flex items-center justify-center max-h-[70vh] overflow-y-auto">
              <img 
                src={selectedInvoiceImg} 
                alt="Expanded full proof print screen" 
                className="max-w-full h-auto rounded-lg shadow-md border bg-white"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="p-4 bg-neutral-50 text-center">
              <p className="text-[10px] text-neutral-500 italic">Luôn kiểm tra kỹ số dư hiển thị, mã tra cứu giao dịch và ngày giờ chuyển trước khi đổi status đơn.</p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Offline Manual order creation form pop-up */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto animate-fade-in">
          <div className="relative bg-white max-w-xl w-full rounded-2xl overflow-hidden shadow-2xl border border-neutral-300 my-8">
            <div className="p-4 sm:p-5 border-b flex justify-between items-center bg-blue-50">
              <div className="flex items-center space-x-2">
                <PlusCircle className="w-5 h-5 text-blue-900" />
                <h3 className="text-sm font-display font-bold text-blue-900 uppercase">KHỞI TẠO ĐƠN HÀNG OFFLINE THỦ CÔNG</h3>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 hover:bg-blue-100 text-blue-900 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddManualOrder} className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto font-sans text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10.5px] font-mono font-bold text-neutral-500 block mb-1 uppercase">Tên người nhận (Khách):</label>
                  <input
                    type="text"
                    required
                    value={newOrderForm.customerName}
                    onChange={(e) => setNewOrderForm({...newOrderForm, customerName: e.target.value})}
                    placeholder="Ví dụ: Nguyễn Văn A"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-neutral-50"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] font-mono font-bold text-neutral-500 block mb-1 uppercase">Số điện thoại:</label>
                  <input
                    type="text"
                    required
                    value={newOrderForm.phone}
                    onChange={(e) => setNewOrderForm({...newOrderForm, phone: e.target.value})}
                    placeholder="Ví dụ: 09xxxxxxxx"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-neutral-50 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10.5px] font-mono font-bold text-neutral-500 block mb-1 uppercase">Email:</label>
                  <input
                    type="email"
                    value={newOrderForm.email}
                    onChange={(e) => setNewOrderForm({...newOrderForm, email: e.target.value})}
                    placeholder="Ví dụ: khachhang@gmail.com"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-neutral-50"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] font-mono font-bold text-neutral-500 block mb-1 uppercase">SNS Link (Facebook / Ins...):</label>
                  <input
                    type="text"
                    value={newOrderForm.snsLink}
                    onChange={(e) => setNewOrderForm({...newOrderForm, snsLink: e.target.value})}
                    placeholder="Ví dụ: fb.com/idolsfan"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-neutral-50"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10.5px] font-mono font-bold text-neutral-500 block mb-1 uppercase">Địa chỉ nhận hàng:</label>
                <input
                  type="text"
                  required
                  value={newOrderForm.address}
                  onChange={(e) => setNewOrderForm({...newOrderForm, address: e.target.value})}
                  placeholder="Ví dụ: Số 12 Ba Đình, Hà Nội"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-neutral-50"
                />
              </div>

              <div className="border-t border-neutral-100 pt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10.5px] font-mono font-bold text-neutral-500 block mb-1 uppercase">Sản phẩm khách đặt:</label>
                  <select
                    value={newOrderForm.productId}
                    onChange={(e) => handleProductChange(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-800"
                  >
                    {(products || []).map(p => (
                      <option key={p?.id} value={p?.id}>{(p?.name || "").substring(0, 32)}...</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10.5px] font-mono font-bold text-neutral-500 block mb-1 uppercase">Phiên bản / Size:</label>
                  <select
                    value={newOrderForm.productVersion}
                    onChange={(e) => setNewOrderForm({...newOrderForm, productVersion: e.target.value})}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-800"
                  >
                    {(((products || []).find(p => p?.id === Number(newOrderForm.productId))?.versions || [""])).map((ver, i) => (
                      <option key={i} value={ver}>{ver || "—"}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10.5px] font-mono font-bold text-neutral-500 block mb-1 uppercase">Số lượng đặt:</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newOrderForm.quantity}
                    onChange={(e) => setNewOrderForm({...newOrderForm, quantity: Math.max(1, Number(e.target.value))})}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-neutral-50 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10.5px] font-mono font-bold text-neutral-500 block mb-1 uppercase">Hãng bưu phẩm gửi nội địa:</label>
                  <select
                    value={newOrderForm.shippingMethod}
                    onChange={(e) => setNewOrderForm({...newOrderForm, shippingMethod: e.target.value})}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-800"
                  >
                    <option value="SPX">SPX Express</option>
                    <option value="GHTK">Giaohangtietkiem</option>
                    <option value="Viettel Post">Viettel Post</option>
                    <option value="Nhận trực tiếp">Nhận tại Sài Gòn (Q2)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10.5px] font-mono font-bold text-neutral-500 block mb-1 uppercase">Thanh toán cọc:</label>
                  <select
                    value={newOrderForm.paymentMethod}
                    onChange={(e) => setNewOrderForm({...newOrderForm, paymentMethod: e.target.value})}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-800"
                  >
                    <option value="Cọc 50%">Cọc 50%</option>
                    <option value="Thanh toán 100%">Thanh toán 100%</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10.5px] font-mono font-bold text-neutral-500 block mb-1 uppercase">Trạng thái đặt đầu:</label>
                  <select
                    value={newOrderForm.status}
                    onChange={(e) => setNewOrderForm({...newOrderForm, status: e.target.value})}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-800 font-bold"
                  >
                    <option value="Chờ xác nhận">Chờ xác nhận</option>
                    <option value="Đã xác nhận">Đã xác nhận</option>
                    <option value="Đã hoàn thành">Đã hoàn thành</option>
                    <option value="Đã hủy">Đã hủy</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10.5px] font-mono font-bold text-neutral-500 block mb-1 uppercase">Ghi chú riêng của đơn:</label>
                <textarea
                  value={newOrderForm.note}
                  onChange={(e) => setNewOrderForm({...newOrderForm, note: e.target.value})}
                  placeholder="Ví dụ: Khách dặn lấy poster cuộn, hoặc hàng dễ vỡ..."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-neutral-50 text-neutral-900 resize-none leading-relaxed"
                  rows={2}
                />
              </div>

              <div className="pt-4 border-t flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-50 rounded-xl font-semibold transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white font-display font-bold tracking-wider uppercase rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Khởi Tạo Đơn Hàng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Send Arrival Notification Email */}
      {isArrivalModalOpen && arrivalOrder && (() => {
        const subtotalVal = arrivalOrder.subtotal ?? 0;
        const pMethod = arrivalOrder.payment?.method || "";
        const isHalfDeposit = pMethod.toLowerCase().includes("50%") || pMethod.toLowerCase().includes("cọc");
        const paidAmount = arrivalOrder.paidAmount !== undefined ? arrivalOrder.paidAmount : (isHalfDeposit ? Math.round(subtotalVal * 0.5) : subtotalVal);
        const remainingAmount = subtotalVal - paidAmount;
        const totalToPay = remainingAmount + weightFee;
        const { subject, body } = getEmailContentForOrder(arrivalOrder, 'arrival', weightFee);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto animate-fade-in">
            <div className="relative bg-white max-w-3xl w-full rounded-2xl overflow-hidden shadow-2xl border border-neutral-300 my-8">
              <div className="p-4 sm:p-5 border-b flex justify-between items-center bg-indigo-50">
                <div className="flex items-center space-x-2">
                  <Mail className="w-5 h-5 text-indigo-900" />
                  <h3 className="text-sm font-display font-bold text-indigo-900 uppercase">GỬI EMAIL BÁO HÀNG VỀ & THANH TOÁN</h3>
                </div>
                <button 
                  onClick={() => {
                    setIsArrivalModalOpen(false);
                    setArrivalOrder(null);
                    setWeightFee(0);
                  }}
                  className="p-1 hover:bg-indigo-100 text-indigo-900 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto font-sans text-xs">
                {/* Recipient Details Summary Block */}
                <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 grid grid-cols-1 md:grid-cols-2 gap-4 text-neutral-800">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-neutral-400 block uppercase mb-1">MÃ ĐƠN HÀNG:</span>
                    <span className="font-mono text-sm font-extrabold text-[#1e40af]">#{arrivalOrder.id}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold text-neutral-400 block uppercase mb-1">KHÁCH HÀNG:</span>
                    <span className="text-sm font-bold text-neutral-800">{arrivalOrder.shipping?.receiverName} ({arrivalOrder.contact?.email})</span>
                  </div>
                </div>

                {/* Pricing / Fees Adjustment */}
                <div className="bg-indigo-50/55 p-4 rounded-xl border border-indigo-100 space-y-3">
                  <h4 className="text-[10.5px] font-mono font-bold text-indigo-900 block uppercase tracking-wide">CẤU HÌNH PHÍ CÂN NẶNG & SỐ TIỀN CẦN THU</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-neutral-500 block mb-1">SỐ TIỀN CÒN LẠI (CÒN LẠI):</span>
                      <div className="px-3 py-2 border bg-neutral-100 rounded-lg font-mono font-bold text-neutral-700">
                        {remainingAmount.toLocaleString('vi-VN')} đ
                      </div>
                    </div>
                    <div>
                      <label className="text-[10.5px] font-mono font-bold text-neutral-500 block mb-1 uppercase">PHÍ CÂN NẶNG (HÀN - VIỆT):</label>
                      <input
                        type="number"
                        min="0"
                        value={weightFee}
                        onChange={(e) => setWeightFee(Math.max(0, Number(e.target.value) || 0))}
                        placeholder="Nhập phí cân nặng..."
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 bg-white text-neutral-900 font-mono font-bold"
                      />
                    </div>
                    <div className="bg-indigo-900 text-white p-2.5 rounded-lg border border-indigo-950 flex flex-col justify-center">
                      <span className="text-[9px] font-mono font-bold text-indigo-300 block uppercase">TỔNG KHÁCH CẦN CHUYỂN:</span>
                      <span className="font-mono text-sm font-extrabold text-amber-300">
                        {totalToPay.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                  </div>
                  
                  {/* Calculation explanation warning */}
                  <div className="text-[10px] text-neutral-500 italic bg-white p-2.5 rounded border border-neutral-100 leading-relaxed">
                    💡 <strong>Tổng thanh toán thực tế</strong> sẽ được gửi cho khách bao gồm <strong>{remainingAmount.toLocaleString('vi-VN')} đ</strong> (Tiền còn lại của đơn) và <strong>{weightFee.toLocaleString('vi-VN')} đ</strong> (Phí cân nặng do Admin điền). Mã QR bên dưới sẽ tự động thay đổi giá trị theo số tiền này.
                  </div>
                </div>

                {/* Live Preview Email Subject and Body Frame */}
                <div className="space-y-2">
                  <h4 className="text-[10.5px] font-mono font-bold text-neutral-500 block uppercase tracking-wide">XEM TRƯỚC EMAIL TRỰC QUAN (LIVE PREVIEW)</h4>
                  
                  {/* Subject Line Display */}
                  <div className="p-3 border rounded-lg bg-neutral-50 flex items-center space-x-2 font-sans">
                    <span className="text-[10px] font-mono font-bold text-neutral-400 block shrink-0 uppercase">TIÊU ĐỀ:</span>
                    <span className="text-xs font-bold text-neutral-800">{subject}</span>
                  </div>

                  {/* Body IFrame Container */}
                  <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white">
                    <div className="bg-neutral-100 px-3 py-1.5 border-b text-[10px] text-neutral-500 font-mono flex items-center justify-between">
                      <span>NỘI DUNG THƯ (HTML RENDERED)</span>
                      <span>Hộp thư khách hàng preview</span>
                    </div>
                    <iframe 
                      srcDoc={body} 
                      title="Email live mockup view template"
                      className="w-full h-80 border-0 bg-neutral-50"
                    />
                  </div>
                </div>

                {/* Footer Submit and Cancel buttons */}
                <div className="pt-4 border-t flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsArrivalModalOpen(false);
                      setArrivalOrder(null);
                      setWeightFee(0);
                    }}
                    disabled={isSendingArrivalMail}
                    className="px-4 py-2 border border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-50 rounded-xl font-semibold transition-colors disabled:opacity-50"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendArrivalEmailDirect(arrivalOrder.id, weightFee)}
                    disabled={isSendingArrivalMail}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-display font-bold tracking-wider uppercase rounded-xl transition-all shadow-sm flex items-center space-x-2 disabled:bg-indigo-300"
                  >
                    {isSendingArrivalMail ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang gửi mail...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Gửi email thông báo</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: Product Add/Edit form pop-up */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto animate-fade-in">
          <div className="relative bg-white max-w-2xl w-full rounded-2xl overflow-hidden shadow-2xl border border-neutral-300 my-8">
            <div className="p-4 sm:p-5 border-b flex justify-between items-center bg-blue-50">
              <div className="flex items-center space-x-2">
                <PlusCircle className="w-5 h-5 text-blue-900" />
                <h3 className="text-sm font-display font-bold text-blue-900 uppercase">
                  {editingProduct ? 'CẬP NHẬT THÔNG TIN SẢN PHẨM' : 'THÊM SẢN PHẨM MỚI'}
                </h3>
              </div>
              <button 
                onClick={() => setIsProductModalOpen(false)}
                className="p-1 hover:bg-blue-100 text-blue-900 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProductSubmit} className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto font-sans text-xs">
              {/* PHẦN I: THÔNG TIN SẢN PHẨM & TRẠNG THÁI */}
              <div className="space-y-4 p-4 rounded-xl border border-blue-100 bg-blue-50/10">
                <div className="font-display font-bold text-blue-900 text-xs border-b pb-1.5 uppercase flex items-center space-x-1.5">
                  <span className="text-sm">📝</span>
                  <span>Phần I: Thông tin sản phẩm & Trạng thái</span>
                </div>

                {/* 1. TÊN SẢN PHẨM */}
                <div>
                  <label className="text-[10.5px] font-mono font-bold text-neutral-600 block mb-1 uppercase">Tên sản phẩm:</label>
                  <input
                    type="text"
                    value={productForm.name}
                    onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                    placeholder="Điền tên Album k-pop hoặc Merch idols..."
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white font-medium text-neutral-900"
                  />
                </div>

                {/* DANH MỤC SẢN PHẨM */}
                <div>
                  <label className="text-[10.5px] font-mono font-bold text-neutral-600 block mb-1 uppercase">Danh mục sản phẩm:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={productForm.category}
                      onChange={(e) => setProductForm({...productForm, category: e.target.value})}
                      placeholder="Nhập hoặc chọn danh mục..."
                      className="flex-1 min-w-0 px-3 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-800 text-xs focus:ring-1 focus:ring-blue-400 focus:border-blue-400 font-medium"
                    />
                    <select
                      onChange={(e) => {
                        if (e.target.value !== "") {
                          setProductForm({...productForm, category: e.target.value});
                        }
                      }}
                      className="border border-neutral-300 rounded-lg bg-white px-2 py-2 text-xs text-neutral-700 focus:outline-none cursor-pointer max-w-[120px]"
                      defaultValue=""
                    >
                      <option value="" disabled>-- Chọn sẵn --</option>
                      {Array.from(new Set([
                        ...(products || []).map(p => p?.category).filter(Boolean),
                        ...customCategories
                      ])).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* GIÁ & TỒN KHO MẶC ĐỊNH */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10.5px] font-mono font-bold text-neutral-600 block mb-1 uppercase">Đơn giá VND mặc định:</label>
                    <input
                      type="number"
                      min={0}
                      value={productForm.price}
                      onChange={(e) => setProductForm({...productForm, price: Number(e.target.value)})}
                      placeholder="Giá bán cuối không cộng phí Seoul"
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white font-mono font-bold text-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10.5px] font-mono font-bold text-neutral-600 block mb-1 uppercase">Số lượng tồn kho mặc định:</label>
                    <input
                      type="number"
                      min={0}
                      value={productForm.stock}
                      onChange={(e) => setProductForm({...productForm, stock: e.target.value === '' ? undefined : Number(e.target.value)})}
                      placeholder="Số lượng tồn kho (bằng 0 là Hết hàng)"
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white font-mono text-neutral-900"
                    />
                  </div>
                </div>

                {/* 2. TRẠNG THÁI (TAG) */}
                <div>
                  <label className="text-[10.5px] font-mono font-bold text-neutral-600 block mb-1 uppercase">Trạng thái (Tag):</label>
                  <div className="flex gap-2">
                    {["Pre-order", "Có sẵn"].map((tagOption) => {
                      const isSelected = productForm.tag === tagOption;
                      return (
                        <button
                          key={tagOption}
                          type="button"
                          onClick={() => {
                            setProductForm({
                              ...productForm,
                              tag: isSelected ? '' : tagOption
                            });
                          }}
                          className={"flex-1 py-2 rounded-xl border text-xs font-bold transition-all duration-200 " + (
                            isSelected
                              ? "bg-blue-600 border-blue-600 text-white shadow-md scale-[1.02]"
                              : "bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                          )}
                        >
                          {tagOption === 'Pre-order' ? '📦 Pre-order' : '⚡ Có sẵn'}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[9.5px] text-neutral-400 mt-1 italic">Click chọn để kích hoạt, click lại để bỏ chọn (để trống).</p>
                </div>

                {/* 3. ARTIST / BRAND */}
                <div>
                  <label className="text-[10.5px] font-mono font-bold text-neutral-600 block mb-1 uppercase">Artist / Brand:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={productForm.artist}
                      onChange={(e) => setProductForm({...productForm, artist: e.target.value})}
                      placeholder="Ví dụ: NCT WISH, NewJeans, AESPA..."
                      className="flex-1 min-w-0 px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white font-medium text-neutral-900"
                    />
                    <select
                      onChange={(e) => {
                        if (e.target.value !== "") {
                          setProductForm({...productForm, artist: e.target.value});
                        }
                      }}
                      className="border border-neutral-300 rounded-lg bg-white px-2 py-2 text-xs text-neutral-700 focus:outline-none cursor-pointer max-w-[120px]"
                      defaultValue=""
                    >
                      <option value="" disabled>-- Chọn sẵn --</option>
                      {Array.from(new Set([
                        ...(products || []).map(p => p?.artist).filter(Boolean),
                        ...customArtists
                      ])).map(art => (
                        <option key={art} value={art}>{art}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 4. QUÀ TẶNG PRE-ORDER */}
                <div>
                  <label className="text-[10.5px] font-mono font-bold text-neutral-600 block mb-1 uppercase">Quà tặng Pre-order:</label>
                  <input
                    type="text"
                    value={productForm.preorderGift}
                    onChange={(e) => setProductForm({...productForm, preorderGift: e.target.value})}
                    placeholder="Ví dụ: Photocard, Special Book, sticker..."
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white font-medium text-neutral-900"
                  />
                </div>

                {/* TRƯỜNG TÙY CHỌN: PHÍ VẬN CHUYỂN HÀN - VIỆT */}
                <div>
                  <label className="text-[10.5px] font-mono font-bold text-neutral-600 block mb-1 uppercase">Phí vận chuyển Hàn - Việt:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
                    <label className="flex items-center space-x-2 text-xs text-neutral-700 cursor-pointer">
                      <input
                        type="radio"
                        name="shippingFeeIncluded"
                        value="Chưa bao gồm phí vận chuyển Hàn - Việt"
                        checked={productForm.shippingFeeIncluded === "Chưa bao gồm phí vận chuyển Hàn - Việt"}
                        onChange={(e) => setProductForm({...productForm, shippingFeeIncluded: e.target.value})}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>Chưa bao gồm phí Hàn - Việt</span>
                    </label>
                    <label className="flex items-center space-x-2 text-xs text-neutral-700 cursor-pointer">
                      <input
                        type="radio"
                        name="shippingFeeIncluded"
                        value="Đã bao gồm phí vận chuyển Hàn - Việt"
                        checked={productForm.shippingFeeIncluded === "Đã bao gồm phí vận chuyển Hàn - Việt"}
                        onChange={(e) => setProductForm({...productForm, shippingFeeIncluded: e.target.value})}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>Đã bao gồm phí Hàn - Việt</span>
                    </label>
                  </div>
                  {productForm.shippingFeeIncluded && (
                    <button
                      type="button"
                      onClick={() => setProductForm({...productForm, shippingFeeIncluded: ""})}
                      className="text-[10px] text-red-500 hover:underline mt-1 block font-semibold"
                    >
                      ❌ Xóa lựa chọn (để trống)
                    </button>
                  )}
                </div>

                {/* 5. HẠN ORDER (DEADLINE) & 6. NGÀY PHÁT HÀNH (RELEASE) */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10.5px] font-mono font-bold text-neutral-600 block mb-1 uppercase">Hạn order (Deadline):</label>
                    <input
                      type="text"
                      value={productForm.orderDeadline}
                      onChange={(e) => setProductForm({...productForm, orderDeadline: e.target.value})}
                      placeholder="Ví dụ: 25/06/2026 hoặc Sẵn hàng"
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white font-medium text-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10.5px] font-mono font-bold text-neutral-600 block mb-1 uppercase">Ngày phát hành (Release):</label>
                    <input
                      type="text"
                      value={productForm.releaseDate}
                      onChange={(e) => setProductForm({...productForm, releaseDate: e.target.value})}
                      placeholder="Ví dụ: 10/07/2026 hoặc Đã ra mắt"
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white font-medium text-neutral-900"
                    />
                  </div>
                </div>
              </div>

              {/* PHẦN II: TẢI ẢNH SẢN PHẨM LÊN */}
              <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-3">
                <div className="font-display font-bold text-neutral-700 text-xs border-b pb-1.5 uppercase flex items-center space-x-1.5">
                  <span className="text-sm">🖼️</span>
                  <span>Tải ảnh sản phẩm lên</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  {/* Preview box */}
                  <div className="md:col-span-3 flex justify-center">
                    <div className="w-20 h-24 border border-neutral-300 rounded-lg overflow-hidden bg-white shadow-sm flex items-center justify-center text-neutral-400">
                      {productForm.image ? (
                        <img src={productForm.image} className="w-full h-full object-cover" alt="Product preview" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="text-[10px] text-neutral-400 font-mono">No Image</span>
                      )}
                    </div>
                  </div>

                  {/* Drop and Browse Zone */}
                  <div className="md:col-span-9">
                    <div className="relative border border-dashed border-neutral-300 rounded-lg p-3 text-center bg-white hover:border-blue-400 transition-colors cursor-pointer">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              if (event.target?.result) {
                                setProductForm({...productForm, image: event.target.result as string});
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="text-[11px] font-semibold text-neutral-700">Kéo thả hoặc click để tải ảnh từ thiết bị</div>
                      <p className="text-[9px] text-neutral-400 mt-0.5">Hỗ trợ PNG, JPG, WEBP</p>
                    </div>
                  </div>
                </div>

                <div className="pt-1">
                  <label className="text-[9.5px] font-mono font-bold text-neutral-500 block mb-1 uppercase">Hoặc điền link ảnh trực tiếp:</label>
                  <input
                    type="url"
                    value={productForm.image}
                    onChange={(e) => setProductForm({...productForm, image: e.target.value})}
                    placeholder="https://images.unsplash.com/photo-..."
                    className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white font-mono text-[10.5px]"
                  />
                </div>

                {/* ẢNH BỔ SUNG */}
                <div className="border-t border-neutral-200/60 pt-3 space-y-2">
                  <label className="text-[10px] font-mono font-bold text-neutral-500 block uppercase">
                    📸 Ảnh bổ sung / Thư viện ảnh ({additionalImages.length}):
                  </label>
                  
                  {additionalImages.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 pb-2">
                      {(additionalImages || []).map((img, index) => (
                        <div key={index} className="relative group aspect-square border border-neutral-200 rounded-lg overflow-hidden bg-neutral-100 shadow-sm">
                          <img src={img} className="w-full h-full object-cover" alt={`Gallery preview ${index + 1}`} referrerPolicy="no-referrer" />
                          <button
                            type="button"
                            onClick={() => {
                              const nextImgs = [...additionalImages];
                              nextImgs.splice(index, 1);
                              setAdditionalImages(nextImgs);
                            }}
                            className="absolute top-1 right-1 bg-red-600/95 text-white p-1 rounded-full hover:bg-red-700 transition-colors shadow"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      id="new-additional-image-url"
                      type="url"
                      placeholder="https://images.unsplash.com/... hoặc tải file bên dưới"
                      className="flex-1 px-3 py-1.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white font-mono text-[10.5px]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const input = e.currentTarget;
                          const val = input.value.trim();
                          if (val) {
                            setAdditionalImages([...additionalImages, val]);
                            input.value = '';
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('new-additional-image-url') as HTMLInputElement;
                        const val = input?.value?.trim();
                        if (val) {
                          setAdditionalImages([...additionalImages, val]);
                          input.value = '';
                        }
                      }}
                      className="px-3 py-1.5 bg-neutral-800 text-white text-[11px] font-bold uppercase rounded-lg hover:bg-neutral-900 transition-colors"
                    >
                      Thêm
                    </button>
                  </div>

                  {/* Additional file upload */}
                  <div className="relative border border-dashed border-neutral-200 rounded-lg p-2.5 text-center bg-white hover:border-blue-300 transition-colors cursor-pointer">
                    <input 
                      type="file" 
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          Array.from(e.target.files).forEach(file => {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              if (event.target?.result) {
                                setAdditionalImages(prev => [...prev, event.target!.result as string]);
                              }
                            };
                            reader.readAsDataURL(file as any);
                          });
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="text-[10px] font-semibold text-neutral-600">📎 Upload thêm nhiều ảnh bổ sung từ thiết bị</div>
                  </div>
                </div>
              </div>

              {/* PHẦN III: LOGIC PHÂN LOẠI THÔNG MINH */}
              <div className="space-y-4 p-4 rounded-xl border border-neutral-200 bg-neutral-50/50">
                <div className="font-display font-bold text-neutral-700 text-xs border-b pb-1.5 uppercase flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-sm">🧬</span>
                    <span>Phần III: Logic Phân loại thông minh & Biến thể</span>
                  </div>
                  {!showSecondAttribute && (
                    <button
                      type="button"
                      onClick={() => setShowSecondAttribute(true)}
                      className="px-2.5 py-1 text-[10px] font-bold text-blue-800 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      ➕ Thêm nhóm phân loại khác
                    </button>
                  )}
                </div>

                {/* NHÓM PHÂN LOẠI 1 */}
                <div className="p-3 bg-white border border-neutral-200 rounded-xl space-y-3">
                  <div className="flex justify-between items-center text-[10.5px] font-bold text-neutral-700 uppercase tracking-wide border-b pb-1">
                    <span>Nhóm phân loại 1</span>
                  </div>
                  
                  {/* TÊN PHÂN LOẠI 1 */}
                  <div>
                    <label className="text-[10px] font-mono font-bold text-neutral-500 block mb-1 uppercase">Tên phân loại 1 (Chọn hoặc tự nhập):</label>
                    <div className="flex gap-2">
                      <select
                        value={["SIZE", "VERSION", "MÀU SẮC"].includes(productForm.variationName) ? productForm.variationName : (productForm.variationName ? "custom" : "")}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "custom") {
                            setProductForm({...productForm, variationName: 'Khác'});
                          } else {
                            setProductForm({...productForm, variationName: val});
                          }
                        }}
                        className="border border-neutral-300 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 focus:outline-none cursor-pointer flex-1"
                      >
                        <option value="">-- Không chọn --</option>
                        <option value="SIZE">SIZE</option>
                        <option value="VERSION">VERSION</option>
                        <option value="MÀU SẮC">MÀU SẮC</option>
                        <option value="custom">Tự điền phân loại khác...</option>
                      </select>
                      
                      {(!["SIZE", "VERSION", "MÀU SẮC"].includes(productForm.variationName) || productForm.variationName === "") && (
                        <input
                          type="text"
                          value={productForm.variationName || ''}
                          onChange={(e) => setProductForm({...productForm, variationName: e.target.value})}
                          placeholder="Nhập tên phân loại tự chọn..."
                          className="flex-1 px-3 py-1.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white text-xs font-medium"
                        />
                      )}
                    </div>
                  </div>

                  {/* CÁC TÙY CHỌN PHÂN LOẠI 1 */}
                  {productForm.variationName && (
                    <div>
                      <label className="text-[10px] font-mono font-bold text-neutral-500 block mb-1 uppercase">Các tùy chọn phân loại nhóm 1 (phân tách bằng dấu phẩy):</label>
                      <textarea
                        rows={2}
                        value={productForm.versionsText}
                        onChange={(e) => {
                          setProductForm({...productForm, versionsText: e.target.value});
                        }}
                        placeholder="Ví dụ: S, M, L hoặc Ver A, Ver B"
                        className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white font-medium text-neutral-900 resize-none leading-relaxed text-xs"
                      />
                    </div>
                  )}
                </div>

                {/* NHÓM PHÂN LOẠI 2 */}
                {showSecondAttribute && (
                  <div className="p-3 bg-white border border-neutral-200 rounded-xl space-y-3 animate-fade-in relative">
                    <div className="flex justify-between items-center text-[10.5px] font-bold text-neutral-700 uppercase tracking-wide border-b pb-1">
                      <span>Nhóm phân loại 2</span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSecondAttribute(false);
                          setProductForm({
                            ...productForm,
                            attribute2Name: '',
                            attribute2OptionsText: ''
                          });
                        }}
                        className="text-[9.5px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded hover:bg-rose-100 transition-colors"
                      >
                        ❌ Xóa nhóm 2
                      </button>
                    </div>

                    {/* TÊN PHÂN LOẠI 2 */}
                    <div>
                      <label className="text-[10px] font-mono font-bold text-neutral-500 block mb-1 uppercase">Tên phân loại 2 (Chọn hoặc tự nhập):</label>
                      <div className="flex gap-2">
                        <select
                          value={["SIZE", "VERSION", "MÀU SẮC"].includes(productForm.attribute2Name) ? productForm.attribute2Name : (productForm.attribute2Name ? "custom" : "")}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "custom") {
                              setProductForm({...productForm, attribute2Name: 'Khác'});
                            } else {
                              setProductForm({...productForm, attribute2Name: val});
                            }
                          }}
                          className="border border-neutral-300 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 focus:outline-none cursor-pointer flex-1"
                        >
                          <option value="">-- Không chọn --</option>
                          <option value="SIZE">SIZE</option>
                          <option value="VERSION">VERSION</option>
                          <option value="MÀU SẮC">MÀU SẮC</option>
                          <option value="custom">Tự điền phân loại khác...</option>
                        </select>
                        
                        {(!["SIZE", "VERSION", "MÀU SẮC"].includes(productForm.attribute2Name) || productForm.attribute2Name === "") && (
                          <input
                            type="text"
                            value={productForm.attribute2Name || ''}
                            onChange={(e) => setProductForm({...productForm, attribute2Name: e.target.value})}
                            placeholder="Nhập tên phân loại tự chọn..."
                            className="flex-1 px-3 py-1.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white text-xs font-medium"
                          />
                        )}
                      </div>
                    </div>

                    {/* CÁC TÙY CHỌN PHÂN LOẠI 2 */}
                    {productForm.attribute2Name && (
                      <div>
                        <label className="text-[10px] font-mono font-bold text-neutral-500 block mb-1 uppercase">Các tùy chọn phân loại nhóm 2 (phân tách bằng dấu phẩy):</label>
                        <textarea
                          rows={2}
                          value={productForm.attribute2OptionsText}
                          onChange={(e) => {
                            setProductForm({...productForm, attribute2OptionsText: e.target.value});
                          }}
                          placeholder="Ví dụ: Đỏ, Xanh, Trắng hoặc S, M, L"
                          className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white font-medium text-neutral-900 resize-none leading-relaxed text-xs"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* DANH SÁCH NHẬN DIỆN */}
                {productForm.variationName && (!showSecondAttribute ? (
                  formVariations.length > 0 && (
                    <div className="p-3 bg-emerald-50/20 rounded-xl border border-emerald-100 space-y-1.5 animate-fade-in">
                      <span className="text-[10px] font-mono font-bold text-emerald-800 uppercase block">
                        📋 Danh sách tùy chọn đã nhận diện ({formVariations.length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {(formVariations || []).map((v, i) => (
                          <span key={i} className="px-2.5 py-1 bg-white border border-emerald-200 text-emerald-900 text-[11px] font-semibold rounded-lg shadow-sm">
                            {v.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                ) : (
                  variantMatrix.length > 0 && (
                    <div className="p-3 bg-emerald-50/20 rounded-xl border border-emerald-100 space-y-1.5 animate-fade-in">
                      <span className="text-[10px] font-mono font-bold text-emerald-800 uppercase block">
                        📋 Danh sách tổ hợp ma trận đã nhận diện ({variantMatrix.length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {(variantMatrix || []).map((v, i) => (
                          <span key={i} className="px-2.5 py-1 bg-white border border-emerald-200 text-emerald-900 text-[11px] font-semibold rounded-lg shadow-sm flex items-center space-x-1">
                            <span className="font-mono text-[9px] text-emerald-500 mr-0.5">#{i + 1}</span>
                            <span>{v.option1} - {v.option2}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                ))}
              </div>

              {/* PHẦN IV: CẤU HÌNH CHI TIẾT CHO TỪNG PHÂN LOẠI */}
              {!showSecondAttribute ? (
                productForm.variationName && formVariations.length > 0 && (
                  <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/5 space-y-4">
                    <div className="font-display font-bold text-blue-900 text-xs border-b pb-1.5 uppercase flex items-center space-x-1.5">
                      <span className="text-sm">⚙️</span>
                      <span>Phần IV: Cấu hình Chi tiết cho từng phân loại</span>
                    </div>

                    <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
                      {(formVariations || []).map((v, idx) => (
                        <div key={idx} className="bg-white p-3.5 rounded-xl border border-neutral-200 shadow-sm space-y-2 hover:border-blue-300 transition-colors">
                          <div className="flex justify-between items-center bg-neutral-50 px-2.5 py-1.5 rounded-lg border border-neutral-200">
                            <span className="font-bold text-neutral-800 text-xs font-mono uppercase tracking-wide">
                              📌 {productForm.variationName}: {v.name}
                            </span>
                            <span className="text-[10px] text-blue-600 font-semibold uppercase">Tùy chọn #{idx + 1}</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-mono font-bold text-neutral-500 uppercase block">Giá bán VND:</label>
                              <input
                                type="number"
                                required
                                value={v.price}
                                onChange={(e) => {
                                  const updated = [...formVariations];
                                  updated[idx].price = Number(e.target.value) || 0;
                                  setFormVariations(updated);
                                }}
                                className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono font-bold text-neutral-900 text-xs"
                                placeholder="Giá VND..."
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-mono font-bold text-neutral-500 uppercase block">Số lượng tồn kho:</label>
                              <input
                                type="number"
                                min={0}
                                value={v.stock !== undefined ? v.stock : 99}
                                onChange={(e) => {
                                  const updated = [...formVariations];
                                  updated[idx].stock = e.target.value === '' ? undefined : Number(e.target.value);
                                  setFormVariations(updated);
                                }}
                                className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono text-neutral-800 text-xs"
                                placeholder="Tồn kho (0 là hết hàng)..."
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-mono font-bold text-neutral-500 uppercase block">Mô tả riêng của phân loại:</label>
                              <input
                                type="text"
                                value={v.description || ''}
                                onChange={(e) => {
                                  const updated = [...formVariations];
                                  updated[idx].description = e.target.value;
                                  setFormVariations(updated);
                                }}
                                placeholder="Mô tả defect, phụ kiện đi kèm..."
                                className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 font-medium text-neutral-800 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ) : (
                productForm.variationName && variantMatrix.length > 0 && (
                  <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/5 space-y-4">
                    <div className="font-display font-bold text-blue-900 text-xs border-b pb-1.5 uppercase flex items-center space-x-1.5">
                      <span className="text-sm">⚙️</span>
                      <span>Phần IV: Cấu hình Ma trận Tổ hợp cho từng phân loại</span>
                    </div>

                    <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
                      {(variantMatrix || []).map((v, idx) => (
                        <div key={idx} className="bg-white p-3.5 rounded-xl border border-neutral-200 shadow-sm space-y-2 hover:border-blue-300 transition-colors animate-fade-in">
                          <div className="flex justify-between items-center bg-neutral-50 px-2.5 py-1.5 rounded-lg border border-neutral-200">
                            <span className="font-bold text-blue-900 text-xs font-mono uppercase tracking-wide">
                              📌 {v.option1} - {v.option2}
                            </span>
                            <span className="text-[10px] text-blue-600 font-semibold uppercase">Dòng #{idx + 1}</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-mono font-bold text-neutral-500 uppercase block">Giá bán VND:</label>
                              <input
                                type="number"
                                required
                                value={v.price}
                                onChange={(e) => {
                                  const updated = [...variantMatrix];
                                  updated[idx].price = Number(e.target.value) || 0;
                                  setVariantMatrix(updated);
                                }}
                                className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono font-bold text-neutral-900 text-xs"
                                placeholder="Giá VND..."
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-mono font-bold text-neutral-500 uppercase block">Số lượng tồn kho:</label>
                              <input
                                type="number"
                                min={0}
                                value={v.stock !== undefined ? v.stock : 99}
                                onChange={(e) => {
                                  const updated = [...variantMatrix];
                                  updated[idx].stock = e.target.value === '' ? undefined : Number(e.target.value);
                                  setVariantMatrix(updated);
                                }}
                                className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono text-neutral-800 text-xs"
                                placeholder="Tồn kho (0 là hết hàng)..."
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-mono font-bold text-neutral-500 uppercase block">Mô tả riêng / Quà POB:</label>
                              <input
                                type="text"
                                value={v.pob || ''}
                                onChange={(e) => {
                                  const updated = [...variantMatrix];
                                  updated[idx].pob = e.target.value;
                                  setVariantMatrix(updated);
                                }}
                                placeholder="Mô tả defect, phụ kiện đi kèm..."
                                className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 font-medium text-neutral-800 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}

              {/* PHẦN V: MÔ TẢ CHI TIẾT TỔNG */}
              <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-3">
                <div className="font-display font-bold text-neutral-700 text-xs border-b pb-1.5 uppercase flex items-center space-x-1.5">
                  <span className="text-sm">📝</span>
                  <span>Mô tả chi tiết tổng</span>
                </div>
                <div>
                  <label className="text-[10.5px] font-mono font-bold text-neutral-600 block mb-1 uppercase">Mô tả chi tiết toàn bộ sản phẩm:</label>
                  <textarea
                    value={productForm.detailedDesc}
                    onChange={(e) => setProductForm({...productForm, detailedDesc: e.target.value})}
                    rows={4}
                    placeholder="Bao gồm chi tiết cấu phần của album, photocard kỉ niệm, kích thước áo, v.v..."
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white text-xs text-neutral-900 resize-none leading-relaxed"
                  />
                </div>
              </div>

              {/* PHẦN VI: THÔNG BÁO CHO KHÁCH HÀNG ĐĂNG KÝ */}
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/30 flex items-center space-x-3">
                <input
                  id="notifySubscribersCheckbox"
                  type="checkbox"
                  checked={notifySubscribers}
                  onChange={(e) => setNotifySubscribers(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-neutral-300 rounded focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="notifySubscribersCheckbox" className="text-xs font-semibold text-neutral-700 cursor-pointer select-none">
                  📧 Gửi email thông báo cho khách hàng đăng ký nhận tin
                </label>
              </div>

              <div className="pt-4 border-t flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 border border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-50 rounded-xl font-semibold transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#e8f0ff] border border-blue-400 text-blue-950 font-display font-bold tracking-wider uppercase rounded-xl hover:bg-blue-105 transition-colors shadow-sm"
                >
                  {editingProduct ? 'Cập Nhật Sản Phẩm' : 'Tạo Sản Phẩm Mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* MODAL: Coupon creation form pop-up */}
      {isCouponModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto animate-fade-in">
          <div className="relative bg-white max-w-md w-full rounded-2xl overflow-hidden shadow-2xl border border-neutral-300 my-8">
            <div className="p-4 sm:p-5 border-b flex justify-between items-center bg-blue-50">
              <div className="flex items-center space-x-2">
                <Ticket className="w-5 h-5 text-blue-900" />
                <h3 className="text-sm font-display font-bold text-blue-900 uppercase">TẠO MÃ GIẢM GIÁ MỚI</h3>
              </div>
              <button 
                onClick={() => setIsCouponModalOpen(false)}
                className="p-1 hover:bg-blue-100 text-blue-900 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCoupon} className="p-5 sm:p-6 space-y-4 font-sans text-xs">
              <div>
                <label className="text-[10.5px] font-mono font-bold text-neutral-500 block mb-1 uppercase">Tên mã (Code):</label>
                <input
                  type="text"
                  required
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({...couponForm, code: e.target.value})}
                  placeholder="Ví dụ: YENG10, KM200K"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-neutral-50 uppercase font-mono font-bold text-sm"
                />
              </div>

              <div>
                <label className="text-[10.5px] font-mono font-bold text-neutral-500 block mb-1 uppercase">Thời hạn áp dụng (Expiry Date):</label>
                <input
                  type="date"
                  required
                  value={couponForm.expiryDate}
                  onChange={(e) => setCouponForm({...couponForm, expiryDate: e.target.value})}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-neutral-50 font-mono"
                />
              </div>

              <div>
                <label className="text-[10.5px] font-mono font-bold text-neutral-500 block mb-1 uppercase">Mặt hàng/Danh mục áp dụng (Applicable Products):</label>
                <select
                  value={couponForm.applicableProducts}
                  onChange={(e) => setCouponForm({...couponForm, applicableProducts: e.target.value})}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-neutral-50 font-sans cursor-pointer text-xs"
                >
                  <option value="Tất cả danh mục">Tất cả danh mục</option>
                  <option value="Pre-order">Pre-order</option>
                  <option value="Sẵn hàng">Sẵn hàng</option>
                  <option value="Order web">Order web</option>
                  {(products || []).map(p => (
                    <option key={p?.id} value={p?.name}>{p?.name} (Sản phẩm)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10.5px] font-mono font-bold text-neutral-500 block mb-1 uppercase">Số lượng tối đa được sử dụng (Max Usage):</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={couponForm.maxUsage}
                  onChange={(e) => setCouponForm({...couponForm, maxUsage: Number(e.target.value) || 100})}
                  placeholder="Ví dụ: 100"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-neutral-50 font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10.5px] font-mono font-bold text-neutral-500 block mb-1 uppercase">Kiểu giảm giá:</label>
                  <div className="flex bg-neutral-100 p-1 rounded-lg border">
                    <button
                      type="button"
                      onClick={() => setCouponForm({...couponForm, discountType: 'percentage'})}
                      className={`flex-1 py-1.5 text-center text-[10px] font-bold rounded-md transition-all ${
                        couponForm.discountType === 'percentage'
                          ? 'bg-white text-blue-900 shadow-sm border border-neutral-200/50'
                          : 'text-neutral-500'
                      }`}
                    >
                      Giảm %
                    </button>
                    <button
                      type="button"
                      onClick={() => setCouponForm({...couponForm, discountType: 'fixed'})}
                      className={`flex-1 py-1.5 text-center text-[10px] font-bold rounded-md transition-all ${
                        couponForm.discountType === 'fixed'
                          ? 'bg-white text-blue-900 shadow-sm border border-neutral-200/50'
                          : 'text-neutral-500'
                      }`}
                    >
                      Tiền mặt
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10.5px] font-mono font-bold text-neutral-500 block mb-1 uppercase">
                    {couponForm.discountType === 'percentage' ? 'Mức giảm (%)' : 'Mức giảm (đ)'}
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={couponForm.discountValue}
                    onChange={(e) => setCouponForm({...couponForm, discountValue: Number(e.target.value) || 0})}
                    placeholder={couponForm.discountType === 'percentage' ? 'Ví dụ: 10' : 'Ví dụ: 50000'}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-neutral-50 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCouponModalOpen(false)}
                  className="px-4 py-2 border border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-50 rounded-xl font-semibold transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-900 text-white font-display font-bold tracking-wider uppercase rounded-xl hover:bg-blue-950 transition-colors shadow-sm"
                >
                  Tạo mã
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Import Tracking Codes from CSV/Excel File */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto animate-fade-in">
          <div className="relative bg-white max-w-lg w-full rounded-2xl overflow-hidden shadow-2xl border border-neutral-300">
            <div className="p-4 sm:p-5 border-b flex justify-between items-center bg-blue-50">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-900" />
                <h3 className="text-sm font-display font-bold text-blue-900 uppercase">
                  NHẬP MÃ VẬN ĐƠN TỪ EXCEL / CSV
                </h3>
              </div>
              <button 
                onClick={() => {
                  setIsImportModalOpen(false);
                  setParsedImports([]);
                  setImportFileError('');
                }}
                className="p-1 hover:bg-blue-100 text-blue-900 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              <div className="text-xs text-neutral-600 space-y-2 leading-relaxed">
                <p>💡 <strong>Hướng dẫn chuẩn bị file:</strong></p>
                <p>Tạo file Excel hoặc file CSV dạng văn bản phẳng có ít nhất 2 cột với tiêu đề:</p>
                <ul className="list-disc pl-5 font-mono bg-neutral-50 p-2.5 rounded-lg border border-neutral-200 text-[11px] text-neutral-700">
                  <li><strong>Mã đơn hàng</strong> (hoặc <i>orderId</i>, <i>Mã đơn</i>, <i>id</i>)</li>
                  <li><strong>Mã vận đơn</strong> (hoặc <i>trackingCode</i>, <i>vận đơn</i>, <i>mã_vd</i>)</li>
                </ul>
                <p className="text-[10px] text-neutral-400 italic">Mẹo: Bạn có thể lưu bảng tính từ Excel dưới dạng file .csv (Comma Delimited) trước khi upload.</p>
              </div>

              <div className="border-2 border-dashed border-neutral-300 rounded-xl p-6 text-center hover:bg-neutral-50 cursor-pointer transition-colors relative">
                <input
                  type="file"
                  accept=".csv, .txt, .xlsx, .xls"
                  onChange={handleCSVImport}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
                <div className="space-y-2 pointer-events-none">
                  <Upload className="w-8 h-8 text-neutral-400 mx-auto" />
                  <p className="text-xs font-bold text-neutral-700">Kéo thả file CSV vào đây hoặc bấm để chọn tệp</p>
                  <p className="text-[10px] text-neutral-400">Chấp nhận định dạng file .csv, .txt</p>
                </div>
              </div>

              {importFileError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-xl border border-red-200">
                  {importFileError}
                </div>
              )}

              {parsedImports.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-mono font-bold text-emerald-800 uppercase block">
                    📊 Danh sách mã vận đơn đã phân tích ({parsedImports.length} dòng):
                  </span>
                  <div className="max-h-40 overflow-y-auto border border-neutral-200 rounded-xl bg-neutral-50 divide-y text-[11px] font-mono text-neutral-700">
                    {(parsedImports || []).map((item, idx) => (
                      <div key={idx} className="p-2 flex justify-between items-center bg-white">
                        <span>Đơn: <strong className="text-blue-800">{item.orderId}</strong></span>
                        <span>Mã vận đơn: <strong className="text-neutral-900">{item.trackingCode}</strong></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setParsedImports([]);
                    setImportFileError('');
                  }}
                  className="px-4 py-2 border border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-50 rounded-xl font-semibold transition-colors text-xs"
                >
                  Đóng lại
                </button>
                <button
                  type="button"
                  disabled={parsedImports.length === 0}
                  onClick={handleApplyImports}
                  className="px-6 py-2 bg-blue-600 disabled:bg-neutral-200 disabled:text-neutral-400 text-white font-display font-bold tracking-wider uppercase rounded-xl hover:bg-blue-700 transition-colors shadow-sm text-xs"
                >
                  Áp dụng dữ liệu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
