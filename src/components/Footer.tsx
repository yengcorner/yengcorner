import React, { useState } from 'react';
import { Mail, Facebook, ExternalLink, ShieldAlert, CheckCircle, Truck, Lock, Instagram, Twitter } from 'lucide-react';
// @ts-ignore
import yengLogo from '../assets/images/yeng_corner_logo_1782054975769.jpg';

interface FooterProps {
  setCurrentPage: (page: string) => void;
  navigateToRulesSection?: (anchor: string) => void;
}

export default function Footer({ setCurrentPage, navigateToRulesSection }: FooterProps) {
  const [subscriberEmail, setSubscriberEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [subscribeMsg, setSubscribeMsg] = useState('');

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscriberEmail) return;
    setSubmitting(true);
    setSubscribeMsg('');
    try {
      const response = await fetch('/api/subscribers/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: subscriberEmail }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setSubscribeMsg(data.message || 'Đăng ký nhận tin thành công!');
        setSubscriberEmail('');
      } else {
        setSubscribeMsg(data.error || 'Có lỗi xảy ra.');
      }
    } catch (err) {
      console.error(err);
      setSubscribeMsg('Lỗi kết nối máy chủ. Vui lòng thử lại sau.');
    } finally {
      setSubmitting(false);
      // Clear status message after 5 seconds so it doesn't leave the UI in a lingering state
      setTimeout(() => {
        setSubscribeMsg('');
      }, 5000);
    }
  };

  return (
    <footer className="bg-[#e8f0ff] text-neutral-600 font-sans border-t-2 border-blue-200 mt-20">
      {/* Banner benefits widgets */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 md:grid-cols-3 gap-8 border-b border-blue-200">
        <div className="flex items-start space-x-3">
          <div className="p-3 bg-white border border-blue-300 rounded-lg text-blue-900 shadow-sm">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-neutral-900 text-sm font-display font-bold tracking-wide uppercase">Vận chuyển Hàn - Việt gom đơn miễn phí, nhanh chóng</h4>
            <p className="text-xs text-neutral-600 mt-1 leading-relaxed">Hàng được gom bớt thùng/ giảm chi phí cân. Hàng bay từ kho Seoul về Hồ Chí Minh chỉ từ 2-3 ngày xuất cảnh</p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <div className="p-3 bg-white border border-blue-300 rounded-lg text-blue-900 shadow-sm">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-neutral-900 text-sm font-display font-bold tracking-wide uppercase">Uy tín tuyệt đối</h4>
            <p className="text-xs text-neutral-600 mt-1 leading-relaxed">Check legit shop tại album ảnh trên fanpage hoặc instagram</p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <div className="p-3 bg-white border border-blue-300 rounded-lg text-blue-900 shadow-sm">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-neutral-900 text-sm font-display font-bold tracking-wide uppercase">BẢO HIỂM VẬN CHUYỂN</h4>
            <p className="text-xs text-neutral-600 mt-1 leading-relaxed">Hỗ trợ khiếu nại và bồi thường từ các đối tác vận chuyển nội địa (SPX, VTP, GHTK)</p>
          </div>
        </div>
      </div>

      {/* Main Footer Links & Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center space-x-2">
            <img 
              src={yengLogo} 
              alt="Yeng Corner Logo" 
              className="w-8 h-8 rounded object-cover border border-[#b4cbf0] bg-[#e8f0ff]"
              referrerPolicy="no-referrer"
            />
            <span className="font-display font-bold text-blue-900 tracking-widest text-base">YENG CORNER</span>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed max-w-sm">
            Order tất tần tật Hàn Quốc
          </p>
          <div className="flex space-x-3 items-center">
            <a 
              href="mailto:taphoayeng12@gmail.com" 
              className="p-2 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-full text-neutral-700 transition-colors shadow-sm"
              title="Mail to support"
            >
              <Mail className="w-4 h-4" />
            </a>
            <a 
              href="https://www.facebook.com/yeng.corner?locale=vi_VN" 
              target="_blank" 
              rel="noreferrer" 
              className="p-2 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-full text-neutral-700 transition-colors inline-flex items-center shadow-sm"
              title="Facebook Fanpage"
            >
              <Facebook className="w-4 h-4" />
            </a>
            <a 
              href="https://www.instagram.com/yeng.corner/" 
              target="_blank" 
              rel="noreferrer" 
              className="p-2 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-full text-neutral-700 transition-colors inline-flex items-center shadow-sm"
              title="Instagram Profile"
            >
              <Instagram className="w-4 h-4" />
            </a>
            <a 
              href="https://x.com/yengcorner" 
              target="_blank" 
              rel="noreferrer" 
              className="p-2 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-full text-neutral-700 transition-colors inline-flex items-center shadow-sm"
              title="Twitter (X) Profile"
            >
              <Twitter className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div>
          <h5 className="font-display font-bold text-blue-900 text-sm tracking-wider uppercase mb-4">QUY ĐỊNH CHUNG</h5>
          <ul className="space-y-2 text-xs">
            <li>
              <button 
                onClick={() => navigateToRulesSection ? navigateToRulesSection('quy-tac-gom-hang-va-huy-don-hang') : setCurrentPage('rules')} 
                className="text-neutral-600 hover:text-blue-900 hover:underline transition-colors text-left"
              >
                Chính sách hủy đơn
              </button>
            </li>
            <li>
              <button 
                onClick={() => navigateToRulesSection ? navigateToRulesSection('chinh-sach-bao-hiem-don-hang') : setCurrentPage('rules')} 
                className="text-neutral-600 hover:text-blue-900 hover:underline transition-colors text-left"
              >
                Bảo hiểm đền bù mất mát
              </button>
            </li>
            <li>
              <button 
                onClick={() => navigateToRulesSection ? navigateToRulesSection('rui-ro-scam-tu-seller-han') : setCurrentPage('rules')} 
                className="text-neutral-600 hover:text-blue-900 hover:underline transition-colors text-left"
              >
                Rủi ro scam từ Deal Hàn
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h5 className="font-display font-bold text-blue-900 text-sm tracking-wider uppercase mb-4">ĐƯỜNG DẪN NHANH</h5>
          <ul className="space-y-2 text-xs">
            <li>
              <button onClick={() => setCurrentPage('home')} className="text-neutral-600 hover:text-blue-900 hover:underline transition-colors">Trang chủ</button>
            </li>
            <li>
              <button onClick={() => setCurrentPage('track-order')} className="text-neutral-600 hover:text-blue-900 hover:underline transition-colors">Tra cứu đơn hàng</button>
            </li>
            <li>
              <button onClick={() => setCurrentPage('about')} className="text-neutral-600 hover:text-blue-900 hover:underline transition-colors">Về chúng tôi (About Us)</button>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Legal bar */}
      <div className="bg-[#dbeafe] py-6 border-t border-blue-200 text-center text-[10px] text-blue-900 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
          <div className="flex flex-wrap items-center justify-center gap-1">
            <span>© 2026 YENG CORNER. TẤT CẢ QUYỀN ĐƯỢC BẢO LƯU.</span>
            <span className="hidden sm:inline text-blue-400">•</span>
            <button 
              onClick={() => {
                const pass = prompt("🔑 Nhập mật khẩu bảo mật của quản trị viên YENG CORNER:");
                if (pass === 'yengadmin2026') {
                  setCurrentPage('admin-yeng');
                } else if (pass !== null) {
                  alert("❌ Mật khẩu quản trị viên không chính xác!");
                }
              }}
              className="text-blue-800 hover:text-blue-950 font-bold hover:underline transition-colors flex items-center space-x-0.5"
              title="Danh mục quản lý đơn hàng dành riêng cho sếp Yeng"
            >
              <Lock className="w-3 h-3 text-blue-800" />
              <span>Quản trị viên</span>
            </button>
          </div>
          <span className="flex items-center space-x-1">
            <span>DESIGNED WITH METICULOUS MODERN CRAFT</span>
            <ExternalLink className="w-3 h-3 text-blue-800" />
          </span>
        </div>
      </div>
    </footer>
  );
}
