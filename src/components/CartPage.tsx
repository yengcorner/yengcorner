import React, { useState } from 'react';
import { ShoppingCart, Trash2, ArrowRight, ArrowLeft, Ticket, ShieldCheck, Tag, X } from 'lucide-react';
import { CartItem, Coupon } from '../types';
import { getProductStockForVersion } from '../utils/products';

interface CartPageProps {
  cart: CartItem[];
  removeFromCart: (id: number, version: string) => void;
  updateCartQuantity?: (id: number, version: string, q: number) => void;
  setCurrentPage: (page: string) => void;
  appliedCoupon?: Coupon | null;
  setAppliedCoupon?: (coupon: Coupon | null) => void;
}

export default function CartPage({ 
  cart, 
  removeFromCart, 
  updateCartQuantity, 
  setCurrentPage,
  appliedCoupon,
  setAppliedCoupon
}: CartPageProps) {
  const [couponCodeInput, setCouponCodeInput] = useState(appliedCoupon ? appliedCoupon.code : '');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(appliedCoupon ? `Đang áp dụng mã giảm giá "${appliedCoupon.code}"` : null);

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

  const handleApplyCoupon = () => {
    setCouponError(null);
    setCouponSuccess(null);
    
    if (!couponCodeInput.trim()) {
      setCouponError("Vui lòng nhập mã giảm giá.");
      return;
    }

    try {
      const savedCoupons = localStorage.getItem('yeng_coupons');
      const couponsList: Coupon[] = savedCoupons ? JSON.parse(savedCoupons) : [
        {
          code: "YENGNEW",
          expiryDate: "2026-12-31",
          applicableProducts: "All",
          maxUsage: 100,
          discountType: 'percentage',
          discountValue: 10,
          usedCount: 0
        }
      ];

      const matched = couponsList.find(c => c.code.trim().toUpperCase() === couponCodeInput.trim().toUpperCase());
      
      if (!matched) {
        setCouponError("Mã giảm giá không tồn tại hoặc không hợp lệ.");
        return;
      }

      // Check Expiry Date
      const today = new Date();
      const expDate = new Date(matched.expiryDate);
      if (expDate < today) {
        setCouponError("Mã giảm giá đã quá hạn sử dụng.");
        return;
      }

      // Check Max Usage
      if (matched.usedCount >= matched.maxUsage) {
        setCouponError("Mã giảm giá đã đạt số lượt sử dụng tối đa.");
        return;
      }

      // If valid, apply!
      if (setAppliedCoupon) {
        setAppliedCoupon(matched);
        setCouponSuccess(`Đã áp dụng thành công mã giảm giá "${matched.code}"!`);
      }
    } catch (e) {
      setCouponError("Có lỗi xảy ra khi áp dụng mã.");
    }
  };

  const handleRemoveCoupon = () => {
    if (setAppliedCoupon) {
      setAppliedCoupon(null);
    }
    setCouponCodeInput('');
    setCouponSuccess(null);
    setCouponError(null);
  };

  let discountAmount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.discountType === 'percentage') {
      discountAmount = Math.round(subtotal * (appliedCoupon.discountValue / 100));
    } else {
      discountAmount = appliedCoupon.discountValue;
    }
  }
  const finalTotal = Math.max(0, subtotal - discountAmount);

  // In case cart has no element
  if (cart.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-20 px-4 space-y-6 bg-white rounded-2xl border border-neutral-200 shadow-sm mt-10">
        <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-400 mx-auto">
          <ShoppingCart className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-display font-bold text-neutral-800 tracking-tight">GIỎ HÀNG ĐANG TRỐNG</h2>
          <p className="text-sm text-neutral-500 max-w-sm mx-auto leading-relaxed">
            Bạn chưa lựa mua sản phẩm nào. Hãy ghé qua cửa hàng K-Pop sành điệu để sắm đồ bạn yêu nhé!
          </p>
        </div>
        <button
          onClick={() => setCurrentPage('shop')}
          className="w-full py-3 bg-[#e8f0ff] border border-blue-200 hover:bg-[#d0e1fe] text-blue-900 font-display font-bold text-xs tracking-widest uppercase rounded-xl transition-all"
        >
          TIẾP TỤC DẠO SHOP
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Page header title */}
      <div className="border-b border-neutral-200 pb-5 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-neutral-900 tracking-tight">GIỎ HÀNG CỦA BẠN</h2>
          <p className="text-sm text-neutral-500 mt-1">Kiểm tra thông tin số lượng sản phẩm chuẩn xác trước khi ấn thanh toán.</p>
        </div>
        <span className="font-mono text-xs font-bold bg-neutral-100 border px-3 py-1.5 rounded-full text-neutral-700">
          Có {cart.reduce((a, b) => a + b.quantity, 0)} mặt hàng
        </span>
      </div>

      {/* Cart List */}
      <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white shadow-sm divide-y divide-neutral-200">
        {cart.map((item) => (
          <div key={`${item.product.id}-${item.version}`} className="p-4 sm:p-5 flex flex-col sm:flex-row items-center sm:items-stretch gap-4 sm:gap-6">
            {/* Image thumbnail item */}
            <div className="w-20 h-20 bg-neutral-100 rounded-lg overflow-hidden border border-neutral-200 shrink-0">
              <img 
                src={item.product.image} 
                alt={item.product.name} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Info details context */}
            <div className="flex-1 text-center sm:text-left space-y-1">
              <h4 className="text-sm font-semibold text-neutral-900 leading-snug line-clamp-2">
                {item.product.name}
              </h4>
              <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2">
                {item.version && (
                  <span className="text-[10px] font-mono text-neutral-500 bg-neutral-100 border border-neutral-200/60 px-2 py-0.5 rounded">
                    Phân loại: {item.version}
                  </span>
                )}
                {item.product.artist && (
                  <span className="text-[10px] font-medium font-sans text-blue-600 bg-blue-50 px-2 py-0.5 border border-blue-100 rounded">
                    🎤 {item.product.artist}
                  </span>
                )}
              </div>
              <div className="text-sm font-mono font-bold text-neutral-800 pt-1">
                {getPrice(item).toLocaleString('vi-VN')} đ <span className="text-xs text-neutral-400 font-sans font-normal">/ sản phẩm</span>
              </div>
              
              {/* Synced Bullet Spec Highlights */}
              <div className="text-[11px] text-neutral-500 pt-1.5 space-y-0.5">
                <div className="flex items-center gap-1 justify-center sm:justify-start">
                  <span>• Hạn order:</span>
                  <strong className="text-neutral-800 font-semibold">{item.product.orderDeadline || "Sẵn hàng"}</strong>
                </div>
                <div className="flex items-center gap-1 justify-center sm:justify-start">
                  <span>• Phát hành:</span>
                  <strong className="text-neutral-800 font-semibold">{item.product.releaseDate || "Đã ra mắt"}</strong>
                </div>
                <div className="flex items-center gap-1 justify-center sm:justify-start">
                  <span>• Tồn kho:</span>
                  <strong className="text-[#1A73E8] font-semibold">{getProductStockForVersion(item.product, item.version)} sản phẩm</strong>
                </div>
              </div>
            </div>

            {/* Actions: Controls count & remove */}
            <div className="flex flex-col items-center justify-between gap-3 sm:items-end sm:justify-between shrink-0">
              {/* Optional dynamic update count state */}
              <div className="flex items-center border border-neutral-300 rounded-lg bg-neutral-50 text-xs">
                <button
                  onClick={() => updateCartQuantity && updateCartQuantity(item.product.id, item.version, Math.max(1, item.quantity - 1))}
                  disabled={!updateCartQuantity}
                  className="px-2.5 py-1 text-neutral-600 hover:text-black font-semibold disabled:opacity-50"
                  aria-label="Decrease quantity"
                >
                  -
                </button>
                <span className="w-8 text-center font-mono font-bold">{item.quantity}</span>
                <button
                  onClick={() => {
                    const stock = getProductStockForVersion(item.product, item.version);
                    if (item.quantity >= stock) {
                      alert(`Sản phẩm này chỉ còn tối đa ${stock} sản phẩm trong kho!`);
                      return;
                    }
                    updateCartQuantity && updateCartQuantity(item.product.id, item.version, item.quantity + 1);
                  }}
                  disabled={!updateCartQuantity || item.quantity >= getProductStockForVersion(item.product, item.version)}
                  className="px-2.5 py-1 text-neutral-600 hover:text-black font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>

              {/* Subtotal of single row item */}
              <div className="text-right">
                <span className="text-xs text-neutral-400 font-mono block">Tổng dòng:</span>
                <span className="text-sm font-mono font-bold text-black border-b border-dashed border-neutral-200">
                  {(getPrice(item) * item.quantity).toLocaleString('vi-VN')} VND
                </span>
              </div>

              <button
                onClick={() => {
                  removeFromCart(item.product.id, item.version);
                  alert(`🗑️ Đã xóa mặt hàng khỏi giỏ!`);
                }}
                className="text-xs text-neutral-400 hover:text-red-500 flex items-center space-x-1.5 transition-colors font-mono uppercase"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa bỏ</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Checkout overview pricing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Free promo voucher voucher input (Visual mockup decoration) */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200/80 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-xs font-mono font-bold text-neutral-500 uppercase">
            <Ticket className="w-4 h-4 text-neutral-600" />
            <span>MÃ GIẢM GIÁ / COUPON:</span>
          </div>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Nhập mã ưu đãi..."
              value={couponCodeInput}
              onChange={(e) => setCouponCodeInput(e.target.value)}
              disabled={!!appliedCoupon}
              className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none disabled:bg-neutral-100 disabled:text-neutral-500 uppercase"
            />
            {appliedCoupon ? (
              <button 
                onClick={handleRemoveCoupon}
                className="px-4 py-2 bg-red-50 border border-red-200 hover:bg-red-100 text-red-650 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>GỠ BỎ</span>
              </button>
            ) : (
              <button 
                onClick={handleApplyCoupon}
                className="px-4 py-2 bg-[#e8f0ff] hover:bg-[#d0e1fe] text-blue-900 border border-blue-200 rounded-lg text-xs font-semibold transition-colors"
              >
                ÁP DỤNG
              </button>
            )}
          </div>
          
          {couponError && (
            <p className="text-[11px] text-red-600 font-medium font-sans">⚠️ {couponError}</p>
          )}

          {couponSuccess && (
            <div className="text-[11px] text-emerald-700 font-semibold font-sans flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg">
              <Tag className="w-3.5 h-3.5 text-emerald-650" />
              <span>{couponSuccess}</span>
            </div>
          )}


        </div>

        {/* Dynamic Cost summary box block */}
        <div className="bg-[#e8f0ff] text-neutral-800 p-6 rounded-xl border border-blue-200 shadow-md space-y-4">
          <div className="space-y-2 border-b border-blue-200/80 pb-4">
            <div className="flex justify-between items-center text-xs text-neutral-500">
              <span>Tạm tính tiền hàng:</span>
              <span className="font-mono">{subtotal.toLocaleString('vi-VN')} đ</span>
            </div>
            {appliedCoupon && (
              <div className="flex justify-between items-center text-xs text-emerald-700 font-semibold bg-emerald-50/50 p-1.5 rounded border border-emerald-100">
                <span className="flex items-center space-x-1">
                  <Tag className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Giảm giá ({appliedCoupon.code}):</span>
                </span>
                <span className="font-mono">-{discountAmount.toLocaleString('vi-VN')} đ</span>
              </div>
            )}
            <div className="flex justify-between items-center text-xs text-neutral-500">
              <span>Phí vận chuyển nội địa (ĐVVC tính riêng):</span>
              <span className="font-mono text-emerald-700">Tùy chọn ở trang sau</span>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs tracking-wider uppercase font-display font-bold text-blue-900">TỔNG CỘNG TIỀN:</span>
            <span className="text-xl font-mono font-bold text-blue-900 tracking-tight">
              {finalTotal.toLocaleString('vi-VN')} VND
            </span>
          </div>

          <p className="text-[10px] text-neutral-500 italic">
            * Giá trên chưa bao gồm bảo hiểm hao mòn, thất thoát và cước chuyển phát từ bưu tá Việt Nam tới tay bạn.
          </p>
        </div>
      </div>

      {/* Main navigation paths */}
      <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-3 pt-4">
        <button
          onClick={() => setCurrentPage('shop')}
          className="w-full sm:w-auto py-3 px-6 bg-white border border-neutral-200 hover:border-blue-400 text-neutral-800 hover:text-blue-900 font-display font-medium text-xs tracking-widest uppercase rounded-xl transition-colors text-center flex items-center justify-center space-x-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Tiếp tục mua hàng</span>
        </button>

        <button
          onClick={() => setCurrentPage('checkout')}
          className="w-full sm:w-auto py-3 px-8 bg-[#e8f0ff] hover:bg-[#d0e1fe] text-blue-900 font-display font-bold text-xs tracking-widest uppercase rounded-xl border border-blue-300 transition-colors shadow-md text-center flex items-center justify-center space-x-2"
        >
          <span>Tiến hành thanh toán</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
