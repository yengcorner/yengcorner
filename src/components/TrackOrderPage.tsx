import React, { useState } from 'react';
import { Search, Calendar, Package, CreditCard, Truck, Phone, Clipboard, ArrowRight, AlertCircle, ShoppingBag } from 'lucide-react';
import { OrderPayload } from '../types';
import { getOrders } from '../utils/orders';

interface TrackOrderPageProps {
  setCurrentPage: (page: string) => void;
}

export default function TrackOrderPage({ setCurrentPage }: TrackOrderPageProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [matchingOrders, setMatchingOrders] = useState<OrderPayload[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSearchPhone = phoneNumber.trim().replace(/[^0-9]/g, '');
    
    if (!cleanSearchPhone) {
      alert('⚠️ Vui lòng nhập số điện thoại hợp lệ để tra cứu.');
      return;
    }

    // Reset previous search results and state to ensure clean data reload
    setMatchingOrders([]);
    setSearched(false);
    setLoading(true);
    
    try {
      const allOrders = await getOrders();
      const filtered = allOrders.filter(o => {
        const orderPhone = (o.shipping?.phone || '').trim().replace(/[^0-9]/g, '');
        if (!orderPhone) return false;
        // Match exactly or check if one is suffix/prefix of another for robust search
        return orderPhone === cleanSearchPhone || 
               (orderPhone.length >= 9 && cleanSearchPhone.endsWith(orderPhone)) ||
               (cleanSearchPhone.length >= 9 && orderPhone.endsWith(cleanSearchPhone));
      });

      setMatchingOrders(filtered);
      setSearched(true);
    } catch (err) {
      console.error("Lỗi tra cứu đơn hàng:", err);
      alert("❌ Đã xảy ra lỗi khi tra cứu đơn hàng. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  const getPaymentSummary = (order: OrderPayload) => {
    const method = order.payment?.method || "";
    const isHalfDeposit = method.toLowerCase().includes("50%") || 
                          method.toLowerCase().includes("cọc");
    // Retrieve custom paidAmount from database if it exists, otherwise fall back to payment method calculation
    const paidAmount = order.paidAmount !== undefined ? order.paidAmount : (isHalfDeposit ? Math.round(order.subtotal * 0.5) : order.subtotal);
    const remainingAmount = order.subtotal - paidAmount;
    return {
      isHalfDeposit,
      paidAmount,
      remainingAmount,
      displayMethod: paidAmount === order.subtotal ? "Đã thanh toán 100%" : (isHalfDeposit ? "Đã đặt cọc 50%" : "Đã thanh toán một phần")
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Chờ xác nhận':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Đang gom hàng':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Đã bay kho Hàn':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'Đã về Sài Gòn':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Đã giao khách':
      case 'Hoàn thành':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Đã hủy':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-neutral-150 text-neutral-800 border-neutral-250';
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-4 space-y-8 animate-fade-in">
      {/* Navigation Breadcrumb */}
      <div>
        <button
          onClick={() => setCurrentPage('home')}
          className="inline-flex items-center space-x-1.5 text-xs font-mono font-bold tracking-widest text-neutral-500 hover:text-blue-600 uppercase group"
          id="backToHomeBtn"
        >
          <span>Quay về trang chủ</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </button>
      </div>

      {/* Hero Section */}
      <div className="border-b border-neutral-200 pb-5">
        <h2 className="text-2xl font-display font-bold text-neutral-900 tracking-tight" id="pageTitle">TRA CỨU ĐƠN HÀNG</h2>
        <p className="text-sm text-neutral-500 mt-1">Kiểm tra thông tin chi tiết và hành trình các đơn hàng của bạn tại YENG CORNER</p>
      </div>

      {/* Main Search Card with gradient matching the Yeng Corner light blue theme */}
      <div 
        className="bg-gradient-to-br from-[#e8f0ff] to-[#f0f5ff] border border-blue-200 rounded-2xl p-6 sm:p-8 shadow-sm text-left space-y-6"
        id="searchFormCard"
      >
        <div className="space-y-1">
          <h3 className="text-lg font-display font-bold text-[#1e40af]" id="searchTitle">Tra cứu đơn hàng</h3>
          <p className="text-xs text-neutral-600 font-medium" id="searchSubtitle">Nhập số điện thoại để tra cứu đơn hàng của bạn</p>
        </div>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="searchPhoneInput" className="block text-xs font-mono font-bold text-neutral-700 uppercase">
              Số điện thoại đặt hàng
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-neutral-400">
                <Phone className="w-4.5 h-4.5" />
              </span>
              <input
                id="searchPhoneInput"
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Nhập số điện thoại đã dùng khi đặt hàng"
                className="w-full pl-10 pr-4 py-3 border border-blue-200 focus:border-[#1e40af] focus:ring-1 focus:ring-[#1e40af] rounded-xl text-sm bg-white text-neutral-800 placeholder-neutral-400 focus:outline-none transition-all font-medium"
              />
            </div>
          </div>

          <button
            id="searchSubmitBtn"
            type="submit"
            disabled={loading}
            className={`w-full sm:w-auto px-8 py-3 text-white text-xs font-display font-bold tracking-widest uppercase rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 ${
              loading 
                ? 'bg-neutral-400 cursor-not-allowed' 
                : 'bg-[#1e40af] hover:bg-[#1e3a8a] hover:shadow-lg active:scale-95'
            }`}
          >
            {loading ? (
              <>
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                <span>ĐANG TRA CỨU...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>TRA CỨU NGAY</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Dynamic Orders Result View */}
      {searched && (
        <div className="space-y-6" id="searchResultsContainer">
          <div className="border-b border-neutral-200 pb-2">
            <h4 className="text-sm font-mono font-bold text-neutral-500 tracking-wider uppercase">
              KẾT QUẢ TRA CỨU ({matchingOrders.length} ĐƠN HÀNG)
            </h4>
          </div>

          {matchingOrders.length === 0 ? (
            <div 
              className="text-center py-12 bg-white border border-neutral-200 rounded-2xl shadow-sm space-y-4 max-w-lg mx-auto"
              id="noOrdersFoundBox"
            >
              <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center mx-auto text-neutral-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h5 className="text-sm font-bold text-neutral-800">Không tìm thấy đơn hàng</h5>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  Không tìm thấy lịch sử đơn hàng khớp với số điện thoại <strong className="font-mono text-neutral-700">{phoneNumber}</strong>. Quý khách vui lòng kiểm tra lại số điện thoại đã nhập.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6" id="ordersList">
              {matchingOrders.map((order) => {
                const payInfo = getPaymentSummary(order);
                return (
                  <div 
                    key={order.id} 
                    className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden text-left font-sans"
                    id={`orderCard-${order.id}`}
                  >
                    {/* Card Header with Order ID and Status */}
                    <div className="bg-neutral-50/70 border-b border-neutral-200 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-mono font-bold text-neutral-400 uppercase">MÃ ĐƠN HÀNG</span>
                          <span className="text-sm font-mono font-extrabold text-[#1e40af]">{order.id}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-neutral-500 text-[11px] font-medium">
                          <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                          <span>Đặt ngày: {new Date(order.timestamp).toLocaleString('vi-VN')}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 self-start sm:self-center">
                        <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase hidden sm:inline">TRẠNG THÁI:</span>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </div>
                    </div>

                    {/* Order Details Body */}
                    <div className="p-5 space-y-5">
                      {/* Shipping info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs border-b border-neutral-100 pb-4">
                        <div>
                          <span className="text-[10px] font-mono text-neutral-400 block uppercase mb-1">THÔNG TIN NGƯỜI NHẬN</span>
                          <p className="font-bold text-neutral-800">{order.shipping.receiverName}</p>
                          <p className="font-mono text-neutral-500 mt-0.5">{order.shipping.phone}</p>
                          <p className="text-neutral-600 mt-1 leading-relaxed">{order.shipping.address}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-mono text-neutral-400 block uppercase mb-1">GIAO NHẬN & THANH TOÁN</span>
                          <div className="space-y-1 font-medium text-neutral-700">
                            <div className="flex items-center space-x-1.5">
                              <Truck className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                              <span>Hình thức nhận: <strong className="text-neutral-900 font-semibold">{order.shipping.method}</strong></span>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <CreditCard className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                              <span>Thanh toán: <strong className="text-neutral-900 font-semibold">{order.payment.method}</strong></span>
                            </div>
                            {order.trackingCode && (
                              <div className="flex items-center space-x-1.5 bg-blue-50 text-[#1e40af] border border-blue-100 px-2.5 py-1 rounded-lg mt-1.5 w-fit">
                                <Clipboard className="w-3.5 h-3.5 shrink-0" />
                                <span>Mã vận đơn: <strong className="font-mono font-bold">{order.trackingCode}</strong></span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Products List Table */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-mono text-neutral-400 block uppercase">CHI TIẾT SẢN PHẨM</span>
                        <div className="border border-neutral-150 rounded-xl overflow-hidden bg-neutral-50/50">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead>
                              <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-500 font-bold">
                                <th className="px-4 py-2.5">Sản phẩm</th>
                                <th className="px-4 py-2.5">Phân loại</th>
                                <th className="px-4 py-2.5 text-center">Số lượng</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-150">
                              {order.items.map((item, idx) => (
                                <tr key={idx} className="bg-white hover:bg-neutral-50/30 transition-colors">
                                  <td className="px-4 py-3 flex items-center space-x-2.5">
                                    <div className="w-8 h-8 rounded border overflow-hidden shrink-0 bg-neutral-100">
                                      <img 
                                        src={item.product?.image} 
                                        alt={item.product?.name} 
                                        className="w-full h-full object-cover" 
                                        referrerPolicy="no-referrer"
                                      />
                                    </div>
                                    <span className="font-bold text-neutral-800 line-clamp-1">{item.product?.name}</span>
                                  </td>
                                  <td className="px-4 py-3 text-neutral-600 font-semibold">
                                    {item.version || 'Mặc định'}
                                  </td>
                                  <td className="px-4 py-3 text-center font-mono font-bold text-neutral-600">
                                    {item.quantity}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Financial summary banner */}
                      <div className="bg-[#e8f0ff]/50 border border-blue-100/70 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                        <div className="space-y-0.5 border-b sm:border-b-0 sm:border-r border-blue-200/40 pb-3 sm:pb-0">
                          <span className="text-[10px] font-mono text-neutral-400 block uppercase">TỔNG ĐƠN HÀNG</span>
                          <span className="font-mono text-sm font-bold text-neutral-800">
                            {order.subtotal.toLocaleString('vi-VN')} VND
                          </span>
                        </div>

                        <div className="space-y-0.5 border-b sm:border-b-0 sm:border-r border-blue-200/40 pb-3 sm:pb-0">
                          <span className="text-[10px] font-mono text-neutral-400 block uppercase">ĐÃ THANH TOÁN ({payInfo.isHalfDeposit ? '50%' : '100%'})</span>
                          <span className="font-mono text-sm font-bold text-emerald-700">
                            {payInfo.paidAmount.toLocaleString('vi-VN')} VND
                          </span>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[10px] font-mono text-neutral-400 block uppercase">CÒN LẠI PHẢI TRẢ</span>
                          <span className={`font-mono text-sm font-bold ${payInfo.remainingAmount > 0 ? 'text-rose-600' : 'text-neutral-500'}`}>
                            {payInfo.remainingAmount.toLocaleString('vi-VN')} VND
                          </span>
                        </div>
                      </div>

                      {/* Custom User Note if any */}
                      {order.note && order.note !== 'Không có' && (
                        <div className="bg-neutral-50 border border-neutral-200/60 p-3.5 rounded-xl text-xs text-neutral-600">
                          <strong className="text-neutral-700 font-bold block mb-1">Ghi chú của quý khách:</strong>
                          <p className="italic font-medium">"{order.note}"</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
