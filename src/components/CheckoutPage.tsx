import React, { useState, useEffect } from 'react';
import { ShoppingBag, CreditCard, Landmark, CheckCircle2, Copy, Image as ImageIcon, UploadCloud, ClipboardCheck, ArrowLeft, Truck, Flame, X, Mail, RefreshCw } from 'lucide-react';
import { CartItem, OrderPayload, Coupon } from '../types';
import { saveOrder } from '../utils/orders';
import { deductProductStock } from '../utils/products';
import { initAuth, googleSignIn } from '../utils/googleAuth';

interface CheckoutPageProps {
  cart: CartItem[];
  setCurrentPage: (page: string) => void;
  clearCart: () => void;
  appliedCoupon?: Coupon | null;
  setAppliedCoupon?: (coupon: Coupon | null) => void;
}

export default function CheckoutPage({ cart, setCurrentPage, clearCart, appliedCoupon, setAppliedCoupon }: CheckoutPageProps) {
  const getPrice = (item: CartItem) => {
    if (item.product.variantMatrix && item.product.variantMatrix.length > 0) {
      const matched = item.product.variantMatrix.find(v => {
        const combinedName = v.option2 ? `${v.option1} - ${v.option2}` : v.option1;
        return combinedName === item.version;
      });
      if (matched) return matched.price;
    }
    if (item.product.variations && item.product.variations.length > 0) {
      const variation = item.product.variations.find(v => v.name === item.version);
      if (variation) return variation.price;
    }
    return item.product.price;
  };

  const subtotal = cart.reduce((acc, item) => acc + (getPrice(item) * item.quantity), 0);
  
  let discountAmount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.discountType === 'percentage') {
      discountAmount = Math.round(subtotal * (appliedCoupon.discountValue / 100));
    } else {
      discountAmount = appliedCoupon.discountValue;
    }
  }
  const finalTotal = Math.max(0, subtotal - discountAmount);
  
  // Gmail integration states for success screen
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailSentStatus, setGmailSentStatus] = useState<string | null>(null);

  const sendAutoConfirmationEmail = async (order: OrderPayload): Promise<{ success: boolean; error?: string }> => {
    const subject = `[Yeng Corner] Xác nhận đơn hàng #${order.id}`;
    const itemsFormatted = order.items.map(item => 
      `${item.product?.name || 'Sản phẩm'} (Phân loại: ${item.version || '—'}) x${item.quantity}`
    ).join(", ");

    const paymentMethod = order.payment?.method || "";
    const isHalfDeposit = paymentMethod.toLowerCase().includes("50%") || paymentMethod.toLowerCase().includes("cọc");
    const displayPaymentMethod = isHalfDeposit ? "Cọc 50%" : "Thanh toán 100%";
    const paidAmount = isHalfDeposit ? Math.round(order.subtotal * 0.5) : order.subtotal;
    const remainingAmount = order.subtotal - paidAmount;

    const bodyHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 25px; border: 1px solid #e5e5e5; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
        <div style="margin-bottom: 25px;">
          <p style="font-size: 14px; color: #374151; margin: 0 0 10px;">Xin chào <strong>${order.shipping.receiverName}</strong>,</p>
          <p style="font-size: 13px; color: #4b5563; line-height: 1.6; margin: 0;">
            Chân thành cảm ơn bạn đã tin tưởng đặt hàng và ủng hộ <strong>YENG CORNER</strong>. Đơn hàng <strong>#${order.id}</strong> của bạn đã được khởi tạo thành công trên hệ thống. Dưới đây là thông tin chi tiết đơn hàng của bạn:
          </p>
        </div>

        <!-- Order Information Table -->
        <div style="margin-bottom: 25px;">
          <h3 style="font-size: 13px; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; margin: 0 0 12px 0; font-weight: 700;">THÔNG TIN ĐẶT HÀNG</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12.5px; color: #374151;">
            <tbody>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 8px 0; color: #6b7280; font-weight: 500; width: 180px;">Tên người nhận:</td>
                <td style="padding: 8px 0; font-weight: 600; color: #111827;">${order.shipping.receiverName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Số điện thoại:</td>
                <td style="padding: 8px 0; font-weight: 600; color: #111827; font-family: monospace;">${order.shipping.phone}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Email:</td>
                <td style="padding: 8px 0; font-weight: 600; color: #111827; font-family: monospace;">${order.contact.email}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Mạng xã hội (SNS):</td>
                <td style="padding: 8px 0; font-weight: 600; color: #1d4ed8;">${order.contact.snsLink}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Địa chỉ nhận hàng:</td>
                <td style="padding: 8px 0; font-weight: 600; color: #111827;">${order.shipping.address}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Đơn vị vận chuyển:</td>
                <td style="padding: 8px 0; font-weight: 600; color: #047857;">${order.shipping.method}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Phương thức thanh toán:</td>
                <td style="padding: 8px 0; font-weight: 600; color: #b45309;">${displayPaymentMethod}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px 0; color: #111827; font-weight: 700; font-size: 14px;">TỔNG GIÁ TRỊ ĐƠN HÀNG: </td>
                <td style="padding: 10px 0; font-weight: 800; color: #1e3a8a; font-size: 16px; font-family: monospace;">${order.subtotal.toLocaleString('vi-VN')} VND</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Số tiền đã thanh toán:</td>
                <td style="padding: 8px 0; font-weight: 600; color: #047857; font-family: monospace;">${paidAmount.toLocaleString('vi-VN')} VND</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Số tiền còn lại:</td>
                <td style="padding: 8px 0; font-weight: 600; color: #dc2626; font-family: monospace;">${remainingAmount.toLocaleString('vi-VN')} VND</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Product Menu Details Table -->
        <div style="margin-bottom: 25px; background-color: #f9fafb; padding: 18px; border-radius: 12px; border: 1px solid #f0f0f0;">
          <h3 style="font-size: 13px; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; margin: 0 0 12px 0; font-weight: 700;">CHI TIẾT THỰC ĐƠN ĐẶT HÀNG</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
            <thead>
              <tr style="border-bottom: 2.5px solid #e5e5e5; color: #4b5563; font-weight: bold;">
                <th style="padding: 6px 0; width: 65%;">Sản phẩm đặt mua</th>
                <th style="padding: 6px 0; width: 20%;">Phân loại</th>
                <th style="padding: 6px 0; width: 15%; text-align: right;">Số lượng</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map(item => `
                <tr style="border-bottom: 1px solid #e5e5e5; color: #374151;">
                  <td style="padding: 10px 0; font-weight: 600; color: #111827;">${item.product?.name || 'Sản phẩm'}</td>
                  <td style="padding: 10px 0; color: #4b5563;">${item.version || '—'}</td>
                  <td style="padding: 10px 0; text-align: right; font-weight: 600; font-family: monospace;">${item.quantity}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        ${order.note && order.note !== "Không có" ? `
          <div style="margin-bottom: 20px; padding: 12px 15px; border-left: 4px solid #3b82f6; background-color: #eff6ff; border-radius: 4px; font-size: 12.5px; color: #1e40af;">
            <strong>Ghi chú đơn hàng:</strong> ${order.note}
          </div>
        ` : ''}

        <!-- Nhắc nhở quan trọng -->
        <div style="margin-bottom: 25px; padding: 15px; border: 1px solid #fed7aa; background-color: #fff7ed; border-radius: 12px; font-size: 12.5px; color: #9a3412; line-height: 1.5;">
          <strong style="color: #ea580c; display: block; margin-bottom: 4px; font-size: 13px;">⚠️ NHẮC NHỞ QUAN TRỌNG:</strong>
          Bạn kiểm tra lại thông tin 1 lần nữa, nếu có sai sót hãy chụp màn hình và liên hệ shop để shop hỗ trợ sửa thông tin.<br/>
          Các đơn cọc 50% - hoàn cọc theo deadline, bạn vui lòng ghi nhớ hạn chuyển khoản và thanh toán phần còn lại để tránh trường hợp bị hủy đơn.
        </div>

        <!-- Footer -->
        <div style="text-align: center; font-size: 11px; color: #9ca3af; margin-top: 30px; border-top: 1px solid #f0f0f0; padding-top: 15px;">
          <p style="margin: 0; font-weight: 500;">Đây là thư một chiều. Vui lòng không trả lời thư này! Nếu khách muốn thay đổi thông tin cá nhân, hãy liên hệ qua facebook của shop!</p>
        </div>
      </div>
    `;

    try {
      const response = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: order.contact.email,
          subject,
          bodyHtml
        })
      });

      let data: any = {};
      try {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch (jsonErr) {
          if (text && text.length < 200) {
            data = { error: text };
          } else {
            data = { error: `Server returned HTML/plain response (HTTP ${response.status}).` };
          }
        }
      } catch (readErr: any) {
        data = { error: `Failed to read response: ${readErr.message}` };
      }

      if (!response.ok) {
        console.error("Failed to send auto-confirmation email:", data.error);
        return { success: false, error: data.error || `Lỗi từ Google Mail API (${response.status})` };
      }
      return { success: true };
    } catch (err: any) {
      console.error("Error sending auto-confirmation email:", err);
      return { success: false, error: err.message || "Lỗi mạng hoặc server không phản hồi" };
    }
  };

  const handleGmailSignInAndSend = async () => {
    if (!generatedOrder) return;

    setGmailLoading(true);

    try {
      const result = await sendAutoConfirmationEmail(generatedOrder);
      if (result.success) {
        setGmailSentStatus(`Hóa đơn điện tử đã được gửi thành công đến Email của bạn!`);
        alert(`🎉 Hóa đơn điện tử đã được gửi thành công đến Email "${generatedOrder.contact.email}" của bạn!`);
      } else {
        throw new Error(result.error || "Không thể gửi email qua máy chủ.");
      }
    } catch (err: any) {
      console.error(err);
      alert(`❌ Gửi email thất bại. Vui lòng kiểm tra lại địa chỉ email hoặc liên hệ shop để được hỗ trợ!`);
    } finally {
      setGmailLoading(false);
    }
  };
  
  // State for form selection and data inputs
  const [paymentMethod, setPaymentMethod] = useState<'50%' | '100%'>('50%');
  const [shippingMethod, setShippingMethod] = useState('SPX');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [copiedBankNum, setCopiedBankNum] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [generatedOrder, setGeneratedOrder] = useState<OrderPayload | null>(null);
  const [isQrZoomed, setIsQrZoomed] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    snsLink: '',
    customerName: '',
    phone: '',
    address: '',
    note: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const processFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setPreviewImage(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    } else {
      alert("⚠️ Vui lòng chỉ tải lên tệp ảnh hợp lệ (PNG, JPG, WEBP).");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleCopyBankAccount = () => {
    navigator.clipboard.writeText("1017217975");
    setCopiedBankNum(true);
    setTimeout(() => setCopiedBankNum(false), 2000);
  };

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();

    // Ràng buộc bắt buộc (Required Fields Validation)
    if (!formData.email.trim()) {
      alert("⚠️ Vui lòng điền thông tin Email.");
      return;
    }
    if (!formData.snsLink.trim()) {
      alert("⚠️ Vui lòng điền Link mạng xã hội (Facebook/Instagram/Threads).");
      return;
    }
    if (!formData.customerName.trim()) {
      alert("⚠️ Vui lòng điền Họ và tên người nhận.");
      return;
    }
    if (!formData.phone.trim()) {
      alert("⚠️ Vui lòng điền Số điện thoại.");
      return;
    }
    if (!formData.address.trim()) {
      alert("⚠️ Vui lòng điền Địa chỉ nhận hàng chi tiết đầy đủ (Trước sáp nhập).");
      return;
    }
    if (!previewImage) {
      alert("⚠️ Vui lòng tải ảnh bill chuyển khoản thanh toán / đặt cọc để hoàn tất giao dịch minh bạch.");
      return;
    }

    setSubmitting(true);

    const orderId = "YENG26-" + Math.floor(1000 + Math.random() * 9000);

    const completeOrderObj: OrderPayload = {
      id: orderId,
      status: "Chờ xác nhận",
      items: cart,
      subtotal: finalTotal,
      contact: {
        email: formData.email,
        snsLink: formData.snsLink
      },
      payment: {
        method: paymentMethod === '50%' ? "Cọc 50%" : "Thanh toán 100%",
        invoiceImage: previewImage
      },
      shipping: {
        receiverName: formData.customerName,
        phone: formData.phone,
        address: formData.address,
        method: shippingMethod
      },
      note: formData.note || "Không có",
      timestamp: new Date().toISOString()
    };

    // Low latency simulation for extra high fidelity premium look
    setTimeout(() => {
      // Sync order to Google Sheets if configured
      const sheetsUrl = localStorage.getItem('yeng_google_sheets_url');
      if (sheetsUrl) {
        console.log("Sending checkout details to Google Sheets...");
        const itemsFormatted = cart.map(item => 
          `${item.product.name} (Phân loại: ${item.version}) x${item.quantity}`
        ).join(", ");

        const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
        const isHalfDeposit = paymentMethod === '50%';
        const calculatedPaid = isHalfDeposit ? Math.round(finalTotal * 0.5) : finalTotal;

        const payload = {
          timestamp: new Date().toLocaleString('vi-VN'),
          email: formData.email,
          snsLink: formData.snsLink,
          quantity: totalQty,
          invoiceImage: previewImage || "",
          customerName: formData.customerName,
          phone: formData.phone,
          address: formData.address,
          shippingMethod: shippingMethod,
          note: formData.note && formData.note !== "Không có" ? `[Sản phẩm: ${itemsFormatted}] | ${formData.note}` : itemsFormatted,
          paidAmount: calculatedPaid,
          totalAmount: finalTotal,
          cartItems: cart.map(item => ({
            productName: item.product.name,
            version: item.version,
            quantity: item.quantity
          })),

          // Backward compatibility fields
          orderId: orderId,
          products: itemsFormatted,
          paymentMethod: paymentMethod === '50%' ? "Cọc 50%" : "Thanh toán 100%"
        };

        fetch(sheetsUrl, {
          method: "POST",
          mode: "no-cors",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        })
        .then(() => console.log("Google Sheets sync triggered successfully from checkout!"))
        .catch(err => console.error("Google Sheets sync failed:", err));
      }

      setSubmitting(false);
      saveOrder(completeOrderObj);

      // Deduct stock for all ordered items in Firestore
      completeOrderObj.items.forEach(async (item) => {
        if (item.product && item.product.id) {
          try {
            await deductProductStock(item.product.id, item.version, item.quantity);
          } catch (e) {
            console.error("Lỗi khi trừ kho sản phẩm:", e);
          }
        }
      });

      setGeneratedOrder(completeOrderObj);
      setOrderConfirmed(true);
      console.log("=== ĐƠN HÀNG XÁC NHẬN CHÍNH THỨC ===", completeOrderObj);
      
      clearCart();
      if (appliedCoupon && setAppliedCoupon) {
        try {
          const saved = localStorage.getItem('yeng_coupons');
          if (saved) {
            const list: Coupon[] = JSON.parse(saved);
            const idx = list.findIndex(c => c.code.toUpperCase() === appliedCoupon.code.toUpperCase());
            if (idx > -1) {
              list[idx].usedCount += 1;
              localStorage.setItem('yeng_coupons', JSON.stringify(list));
            }
          }
        } catch (err) {
          console.warn("Failed to increment coupon count:", err);
        }
        setAppliedCoupon(null);
      }
    }, 1200);
  };

  // If order is completed, show order receipt screen
  if (orderConfirmed && generatedOrder) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="bg-[#e8f0ff] border-2 border-blue-300 rounded-2xl p-6 sm:p-10 shadow-lg text-center space-y-8 animate-fade-in">
          <div className="w-16 h-16 bg-emerald-50 border-2 border-emerald-500 rounded-full flex items-center justify-center text-emerald-600 mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-display font-medium tracking-tight text-neutral-900">XÁC NHẬN THÀNH CÔNG!</h2>
            <p className="text-sm text-neutral-500 max-w-lg mx-auto font-medium">
              Đơn hàng tại YENG CORNER đã được xác nhận. Cảm ơn bạn đã ủng hộ shop.
            </p>
          </div>

          {/* Structured specs detail check receipt */}
          <div className="border border-neutral-200 rounded-xl overflow-hidden divide-y divide-neutral-200 text-left text-xs bg-neutral-50 font-sans">
            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] font-mono text-neutral-400 block uppercase">KHÁCH HÀNG:</span>
                <strong className="text-neutral-800">{generatedOrder.shipping.receiverName}</strong>
              </div>
              <div>
                <span className="text-[10px] font-mono text-neutral-400 block uppercase">SỐ ĐIỆN THOẠI:</span>
                <strong className="text-neutral-800">{generatedOrder.shipping.phone}</strong>
              </div>
            </div>

            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] font-mono text-neutral-400 block uppercase">EMAIL:</span>
                <span className="text-neutral-800 font-medium break-all">{generatedOrder.contact.email}</span>
              </div>
              <div>
                <span className="text-[10px] font-mono text-neutral-400 block uppercase">MẠNG XÃ HỘI (SNS):</span>
                <span className="text-neutral-800 font-medium break-all">{generatedOrder.contact.snsLink}</span>
              </div>
            </div>

            <div className="p-4">
              <span className="text-[10px] font-mono text-neutral-400 block uppercase">ĐỊA CHỈ NHẬN SHIP:</span>
              <p className="text-neutral-800 font-medium leading-relaxed">{generatedOrder.shipping.address}</p>
            </div>

            <div className="p-4 grid grid-cols-2 gap-4 bg-[#e8f0ff]/40">
              <div>
                <span className="text-[10px] font-mono text-neutral-400 block uppercase">ĐƠN VỊ CHUYỂN PHÁT:</span>
                <strong className="text-neutral-800">{generatedOrder.shipping.method}</strong>
              </div>
              <div>
                <span className="text-[10px] font-mono text-neutral-400 block uppercase">PHƯƠNG THỨC GIAO DỊCH:</span>
                <strong className="text-neutral-800">{generatedOrder.payment.method}</strong>
              </div>
            </div>

            {/* Product list with name and quantity right above the total */}
            <div className="p-4 bg-white text-xs border-b border-neutral-200">
              <span className="text-[10px] font-mono text-neutral-400 block uppercase mb-2">CHI TIẾT ĐƠN HÀNG [Sản phẩm + Số lượng]:</span>
              <div className="space-y-2">
                {generatedOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start gap-4">
                    <span className="font-bold text-neutral-800 text-left">{item.product.name} {item.version ? `(${item.version})` : ''}</span>
                    <span className="font-mono font-extrabold text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded shrink-0">x{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-blue-100 text-blue-900 flex justify-between items-center">
              <span className="font-display font-bold text-xs tracking-wider uppercase">TỔNG TRỊ GIÁ ĐƠN:</span>
              <span className="font-mono text-lg font-bold">{generatedOrder.subtotal.toLocaleString('vi-VN')} VND</span>
            </div>
          </div>

          {/* Gmail Confirmation Integration - title removed, only green box remains */}
          <div className="bg-white p-5 rounded-xl border border-neutral-250 shadow-sm text-left space-y-3">
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg font-medium flex items-start space-x-2">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
              <span>Bạn sẽ nhận được mail xác nhận đơn hàng qua email đặt hàng sau khi shop xác nhận đơn trên wedsite.<br />Nếu sau 12 giờ kể từ khi đặt hàng, bạn chưa nhận được mail thì vui lòng liên hệ shop qua facebook hoặc instagram.</span>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={() => setCurrentPage('shop')}
              className="px-6 py-3 border border-neutral-300 hover:border-blue-500 text-neutral-700 hover:text-blue-950 font-display font-semibold text-xs tracking-widest uppercase rounded-xl transition-all"
            >
              QUAY VỀ CỬA HÀNG
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback state if cart gets cleared unexpectedly
  if (cart.length === 0) {
    return (
      <div className="text-center py-20 bg-white border border-neutral-200 rounded-2xl max-w-md mx-auto shadow-sm mt-12 space-y-4">
        <h3 className="text-lg font-display font-bold">Chưa có sản phẩm cần thanh toán</h3>
        <p className="text-sm text-neutral-500">Giỏ hàng rỗng. Hãy quay lại mục SHOP ALL để mua đồ.</p>
        <button onClick={() => setCurrentPage('shop')} className="py-2.5 px-6 bg-[#e8f0ff] text-blue-900 hover:bg-[#d0e1fe] text-xs font-display font-bold rounded-lg border border-blue-200">ĐI TỚI SHOPALL</button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Back button */}
      <div>
        <button
          onClick={() => setCurrentPage('cart')}
          className="inline-flex items-center space-x-1.5 text-xs font-mono font-bold tracking-widest text-neutral-500 hover:text-blue-600 uppercase group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Quay về lại giỏ hàng</span>
        </button>
      </div>

      {/* Title */}
      <div className="border-b border-neutral-200 pb-5">
        <h2 className="text-2xl font-display font-bold text-neutral-900 tracking-tight">THANH TOÁN ĐƠN HÀNG</h2>
      </div>

      {/* Yellow warning notice block - Separated from pricing / coupons and placed at top for maximum visibility */}
      <div className="flex items-start space-x-2.5 text-xs text-amber-700 bg-amber-50 border border-amber-250 p-3.5 rounded-xl leading-relaxed">
        <Flame className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
        <div>
          <strong className="font-bold">Chú ý:</strong> Mọi giao dịch đơn hàng sẽ cần cọc tối thiểu là 50% để shop khởi tạo tiến trình order tránh bùng hàng.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
        {/* LEFT COLUMN: Order summary */}
        <div className="space-y-6 lg:sticky lg:top-24">
          <h3 className="text-base font-display font-bold text-blue-900 tracking-wider uppercase border-b border-neutral-200 pb-1.5">
            SẢN PHẨM
          </h3>

          <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white shadow-sm split-y p-5 space-y-4">
            {cart.map((item) => (
              <div 
                key={`${item.product.id}-${item.version}`} 
                className="flex items-start justify-between gap-4 pb-3 border-b border-neutral-100 last:border-b-0 last:pb-0"
              >
                <div className="flex items-start space-x-3 select-none">
                  <div className="w-12 h-12 rounded-lg bg-neutral-100 overflow-hidden border shrink-0">
                    <img src={item.product.image} className="w-full h-full object-cover" alt="item" referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-neutral-800 line-clamp-1 max-w-[200px]">{item.product.name}</h4>
                    <span className="text-[10px] font-mono text-neutral-500 bg-neutral-50 border px-1.5 py-0.5 rounded mt-0.5 inline-block">
                      SL: {item.quantity}{item.version ? ` | ${item.version}` : ''}
                    </span>
                    {/* Synced Spec Highlights */}
                    <div className="text-[10px] text-neutral-500 mt-1 space-y-0.5">
                      <div className="flex items-center gap-1">
                        <span>• Hạn order:</span>
                        <strong className="text-neutral-700 font-semibold">{item.product.orderDeadline || "Sẵn hàng"}</strong>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>• Phát hành:</span>
                        <strong className="text-neutral-700 font-semibold">{item.product.releaseDate || "Đã ra mắt"}</strong>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right font-mono text-xs font-bold text-neutral-900">
                  {(getPrice(item) * item.quantity).toLocaleString('vi-VN')} đ
                </div>
              </div>
            ))}

            {/* Price details with Coupon */}
            <div className="space-y-2 border-t border-dashed pt-3 text-xs text-neutral-500">
              <div className="flex justify-between items-center">
                <span>Tạm tính tiền hàng:</span>
                <span className="font-mono text-neutral-700 font-semibold">{subtotal.toLocaleString('vi-VN')} đ</span>
              </div>
              {appliedCoupon && (
                <div className="flex justify-between items-center text-emerald-700 font-semibold">
                  <span>Mã giảm giá ({appliedCoupon.code}):</span>
                  <span className="font-mono">-{discountAmount.toLocaleString('vi-VN')} đ</span>
                </div>
              )}
            </div>

            {/* Total Highlight */}
            <div className="bg-[#e8f0ff] border border-blue-200 rounded-lg p-4 flex justify-between items-center mt-3 select-none">
              <span className="text-xs font-display font-bold tracking-wider text-neutral-700">TỔNG TIỀN THANH TOÁN:</span>
              <strong className="text-lg font-mono font-bold text-blue-900">
                {finalTotal.toLocaleString('vi-VN')} VND
              </strong>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Form fields validation */}
        <div className="bg-white rounded-xl border border-neutral-200/90 shadow-sm p-6 sm:p-8">
          <form onSubmit={handleSubmitOrder} className="space-y-6">
            
            {/* 1. CONTACT INFO */}
            <div className="space-y-4">
              <h4 className="text-xs font-mono font-bold text-neutral-400 tracking-widest uppercase border-b border-neutral-100 pb-2">
                MỤC 1: THÔNG TIN LIÊN HỆ GIAO DỊCH
              </h4>
              <div className="space-y-1">
                <label className="block text-xs font-mono font-bold text-neutral-700 uppercase">
                  EMAIL *
                </label>
                <input 
                  required 
                  type="email" 
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange} 
                  placeholder="your-email@gmail.com"
                  className="w-full px-3.5 py-2.5 border border-neutral-350 rounded-lg text-sm bg-neutral-50 focus:ring-1 focus:ring-black focus:outline-none focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-mono font-bold text-neutral-700 uppercase">
                  LINK MẠNG XÃ HỘI (FACEBOOK/INSTAGRAM/THREADS) *
                </label>
                <input 
                  required 
                  type="text" 
                  name="snsLink"
                  value={formData.snsLink}
                  onChange={handleInputChange} 
                  placeholder="facebook.com/username hoặc link cá nhân của bạn để shop inbox..."
                  className="w-full px-3.5 py-2.5 border border-neutral-300 rounded-lg text-sm bg-neutral-50 focus:ring-1 focus:ring-black focus:outline-none focus:bg-white"
                />
                <span className="text-[10px] text-neutral-400 font-mono block mt-1">* Bắt buộc để shop thông báo khi hàng về.</span>
              </div>
            </div>

            {/* 2. PAYMENT METHODS */}
            <div className="space-y-4">
              <h4 className="text-xs font-mono font-bold text-neutral-400 tracking-widest uppercase border-b border-neutral-100 pb-2">
                MỤC 2: PHƯƠNG THỨC THANH TOÁN
              </h4>

              {/* Selector checkboxes */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('50%')}
                  className={`p-3 border rounded-lg text-xs font-display flex flex-col items-center justify-center space-y-1 transition-all ${
                    paymentMethod === '50%' 
                      ? 'border-blue-400 bg-blue-50/25 text-blue-900 font-bold' 
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                  <span>ĐẶT CỌC 50% ĐƠN</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('100%')}
                  className={`p-3 border rounded-lg text-xs font-display flex flex-col items-center justify-center space-y-1 transition-all ${
                    paymentMethod === '100%' 
                      ? 'border-blue-400 bg-blue-50/25 text-blue-900 font-bold' 
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                  }`}
                >
                  <Landmark className="w-5 h-5" />
                  <span>CHUYỂN KHOẢN 100%</span>
                </button>
              </div>

              {/* Account copyable layout box */}
              <div className="border border-neutral-200 rounded-xl bg-neutral-50 p-4 space-y-3 font-sans text-xs">
                <div className="flex justify-between items-center text-neutral-500 font-mono text-[10px] uppercase">
                  <span>TÀI KHOẢN CHUYỂN TIỀN THANH TOÁN:</span>
                  <span className="text-emerald-600 font-bold">VIETCOMBANK</span>
                </div>

                <div className="flex justify-between items-center gap-2">
                  <div>
                    <div className="font-mono font-bold text-sm text-neutral-800">1017217975</div>
                    <div className="text-[10px] text-neutral-400">Chủ TK: LE THI HONG NGOC</div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyBankAccount}
                    className="py-1.5 px-3 bg-white hover:bg-neutral-100 border text-neutral-700 hover:text-black rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors"
                  >
                    {copiedBankNum ? (
                      <>
                        <ClipboardCheck className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-600 font-bold">Đã chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Sao chép</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="pt-2 flex items-center space-x-3">
                  {/* Real-time looking aesthetic dynamic QR mockup via standard qr-creator web services */}
                  <div 
                    onClick={() => setIsQrZoomed(true)}
                    title="Bấm để xem ảnh to"
                    className="w-16 h-16 bg-white border rounded p-1 shadow-sm shrink-0 flex items-center justify-center cursor-zoom-in hover:opacity-90 active:scale-95 transition-all"
                  >
                    <img 
                      src={`https://img.vietqr.io/image/vietcombank-1017217975-compact2.png?amount=${paymentMethod === '50%' ? Math.round(subtotal * 0.5) : subtotal}`} 
                      alt="Vietcombank QR Code" 
                      className="w-full h-full object-contain pointer-events-none"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <strong className="text-[10px] font-bold text-neutral-800 block">QUÉT MÃ QR KHỞI TẠO NHANH</strong>
                    <span className="text-[10px] text-neutral-400 block font-mono leading-relaxed">
                      Chuyển: {paymentMethod === '50%' ? (subtotal * 0.5).toLocaleString('vi-VN') : subtotal.toLocaleString('vi-VN')} đ
                    </span>
                    <span className="text-[9px] text-blue-600 font-bold block cursor-pointer" onClick={() => setIsQrZoomed(true)}>🔍 Bấm để phóng to mã QR</span>
                  </div>
                </div>
              </div>

              {/* Bill file upload box support drag & drop */}
              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold text-neutral-700 uppercase">
                  TẢI ẢNH BILL CHUYỂN KHOẢN (GIAO DỊCH MINH BẠCH)
                </label>
                
                {/* Drag-and-drop zone container */}
                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer relative ${
                    dragActive 
                      ? 'border-black bg-neutral-100' 
                      : previewImage 
                        ? 'border-neutral-300 bg-neutral-50/50' 
                        : 'border-neutral-200 hover:border-neutral-400 bg-neutral-50'
                  }`}
                >
                  <input 
                    type="file" 
                    id="file-upload"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  
                  {previewImage ? (
                    <div className="space-y-3 pointer-events-none">
                      <div className="w-20 h-24 mx-auto border rounded-lg overflow-hidden bg-white shadow-sm">
                        <img src={previewImage} className="w-full h-full object-cover" alt="Bill Preview" />
                      </div>
                      <div className="text-xs text-neutral-500 font-medium">Đã tải ảnh hóa đơn của bạn. Kéo thả hoặc click để thay đổi.</div>
                    </div>
                  ) : (
                    <div className="space-y-2 pointer-events-none">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-neutral-400 mx-auto">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <div className="text-xs font-semibold text-neutral-700">Kéo thả ảnh bill giao dịch vào đây</div>
                      <p className="text-[10px] text-neutral-400">hoặc click để duyệt tìm file từ thư mục thiết bị</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3. RECEIVER INFO */}
            <div className="space-y-4">
              <h4 className="text-xs font-mono font-bold text-neutral-400 tracking-widest uppercase border-b border-neutral-100 pb-2">
                MỤC 3: THÔNG TIN NGƯỜI NHẬN HÀNG
              </h4>

              <div className="space-y-1">
                <label className="block text-xs font-mono font-bold text-neutral-700 uppercase">
                  TÊN NGƯỜI NHẬN *
                </label>
                <input 
                  required 
                  type="text" 
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleInputChange} 
                  placeholder="Nhập họ và tên người nhận bưu phát..."
                  className="w-full px-3.5 py-2.5 border border-neutral-300 rounded-lg text-sm bg-neutral-50 focus:ring-1 focus:ring-black focus:outline-none focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-mono font-bold text-neutral-700 uppercase">
                    SỐ ĐIỆN THOẠI *
                  </label>
                  <input 
                    required 
                    type="tel" 
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange} 
                    placeholder="Số ĐT di động nhận hàng..."
                    className="w-full px-3.5 py-2.5 border border-neutral-300 rounded-lg text-sm bg-neutral-50 focus:ring-1 focus:ring-black focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-mono font-bold text-neutral-700 uppercase">
                  ĐỊA CHỈ NHẬN HÀNG CHI TIẾT ĐẦY ĐỦ (TRƯỚC XÁP NHẬP) *
                </label>
                <input 
                  required 
                  type="text" 
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange} 
                  placeholder="Số nhà, tên đường, ngõ hẻm, phường/Xã, Quận/Huyện, Tỉnh thành..."
                  className="w-full px-3.5 py-2.5 border border-neutral-300 rounded-lg text-sm bg-neutral-50 focus:ring-1 focus:ring-black focus:outline-none focus:bg-white"
                />
              </div>
            </div>

            {/* 4. SHIPPING PARTNERS */}
            <div className="space-y-4">
              <h4 className="text-xs font-mono font-bold text-neutral-400 tracking-widest uppercase border-b border-neutral-100 pb-2">
                MỤC 4: ĐƠN VỊ CHUYỂN PHÁT NỘI ĐỊA
              </h4>

              <div className="grid grid-cols-2 gap-3">
                {['SPX', 'Viettel Post', 'GHTK', 'GDTT tại HCM'].map((method) => {
                  const isSelected = shippingMethod === method;
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setShippingMethod(method)}
                      className={`p-3 border rounded-xl text-xs font-display flex flex-col items-center justify-center space-y-1 transition-all ${
                        isSelected 
                          ? 'border-blue-400 bg-blue-50/25 text-blue-900 font-bold' 
                          : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                      }`}
                    >
                      <Truck className="w-4 h-4 text-blue-800" />
                      <span className="text-[11px] font-semibold">{method}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. NOTES AND COMMENT FORM */}
            <div className="space-y-4">
              <h4 className="text-xs font-mono font-bold text-neutral-400 tracking-widest uppercase border-b border-neutral-100 pb-2">
                MỤC 5: GHI CHÚ
              </h4>
              <div className="space-y-1">
                <textarea 
                  name="note" 
                  value={formData.note}
                  onChange={handleInputChange}
                  rows={2} 
                  placeholder="Yêu cầu riêng về đóng bọc chống df, hoãn giao, gom chung, v.v..."
                  className="w-full px-3.5 py-2.5 border border-neutral-300 rounded-lg text-sm bg-neutral-50 focus:ring-1 focus:ring-blue-400 focus:outline-none focus:bg-white resize-none"
                />
                <p className="text-[11px] text-neutral-500 italic font-sans pl-1">
                  Nếu mua bảo hiểm vận chuyển nội địa thì note ở đây.
                </p>
              </div>
            </div>

            {/* Primary Submit core button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-[#e8f0ff] text-blue-900 border border-blue-300 hover:bg-[#d0e1fe] disabled:bg-neutral-300 font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-md transition-all flex items-center justify-center space-x-2.5 hover:translate-y-[-1px] active:translate-y-0 disabled:pointer-events-none"
              >
                {submitting ? (
                  <>
                    <span className="w-5 h-5 rounded-full border-2 border-t-transparent border-blue-900 animate-spin shrink-0" />
                    <span>ĐANG KHỞI TẠO ĐƠN...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4.5 h-4.5 text-blue-900" />
                    <span>XÁC NHẬN ĐƠN HÀNG</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Zoomed QR Code Modal */}
      {isQrZoomed && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 animate-fade-in">
          <div className="relative bg-white max-w-sm w-full rounded-2xl overflow-hidden shadow-2xl border border-neutral-200">
            <div className="p-4 border-b flex justify-between items-center bg-neutral-50">
              <span className="text-xs font-mono font-bold text-neutral-600 uppercase">QUÉT MÃ QR VIETCOMBANK</span>
              <button 
                type="button"
                onClick={() => setIsQrZoomed(false)}
                className="p-1 hover:bg-neutral-200 rounded-full transition-colors text-neutral-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 bg-white flex flex-col items-center justify-center space-y-4">
              <div className="w-64 h-64 border rounded-xl p-2 bg-white shadow-md">
                <img 
                  src={`https://img.vietqr.io/image/vietcombank-1017217975-compact2.png?amount=${paymentMethod === '50%' ? Math.round(subtotal * 0.5) : subtotal}`} 
                  alt="Expanded QR Code" 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <p className="text-center text-[11px] font-medium text-neutral-500">
                Chuyển khoản cọc tối thiểu 50%: <span className="font-mono text-emerald-700 font-bold">{(paymentMethod === '50%' ? subtotal * 0.5 : subtotal).toLocaleString('vi-VN')} đ</span>
              </p>
            </div>
            <div className="p-4 bg-neutral-50 text-center border-t">
              <button
                type="button"
                onClick={() => setIsQrZoomed(false)}
                className="w-full py-2.5 bg-blue-900 text-white font-display font-bold text-xs uppercase tracking-wide rounded-xl shadow-md hover:bg-blue-950 transition-all"
              >
                ĐÓNG CỬA SỔ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
