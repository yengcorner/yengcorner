import React, { useState, useEffect } from 'react';
import { ShieldCheck, HelpCircle, UserX, AlertTriangle, MessageSquareCode, Video, HelpCircle as HelpIcon, ShieldAlert } from 'lucide-react';

interface RulesPageProps {
  rulesAnchor?: string | null;
  setRulesAnchor?: (anchor: string | null) => void;
}

export default function RulesPage({ rulesAnchor, setRulesAnchor }: RulesPageProps = {}) {
  const [activeTab, setActiveTab] = useState<'policy' | 'shipping' | 'scam'>('policy');

  useEffect(() => {
    if (rulesAnchor) {
      if (rulesAnchor === 'quy-tac-gom-hang-va-huy-don-hang') {
        setActiveTab('policy');
      } else if (rulesAnchor === 'chinh-sach-bao-hiem-don-hang') {
        setActiveTab('shipping');
      } else if (rulesAnchor === 'rui-ro-scam-tu-seller-han') {
        setActiveTab('scam');
      }

      const timer = setTimeout(() => {
        const element = document.getElementById(rulesAnchor);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (setRulesAnchor) {
          setRulesAnchor(null);
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [rulesAnchor, setRulesAnchor]);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Page Title */}
      <div className="border-b border-neutral-200 pb-5">
        <h2 className="text-2xl font-display font-bold text-neutral-900 tracking-tight">QUY ĐỊNH CHUNG</h2>
        <p className="text-sm text-neutral-500 mt-1">Đọc và hiểu rõ chính sách mua hàng để đảm bảo quyền lợi đôi bên.</p>
      </div>

      {/* Mini tabs options to switch between rules groups inside a highly tactile sleek layout */}
      <div className="flex border-b border-neutral-200 gap-1.5 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('policy')}
          className={`py-3 px-5 text-xs font-display tracking-wider font-semibold uppercase border-b-2 transition-all shrink-0 ${
            activeTab === 'policy' 
              ? 'border-blue-600 text-blue-900' 
              : 'border-transparent text-neutral-500 hover:text-neutral-800'
          }`}
        >
          📝 Quy định đặt cọc & Hủy đơn
        </button>
        <button
          onClick={() => setActiveTab('shipping')}
          className={`py-3 px-5 text-xs font-display tracking-wider font-semibold uppercase border-b-2 transition-all shrink-0 ${
            activeTab === 'shipping' 
              ? 'border-blue-600 text-blue-900' 
              : 'border-transparent text-neutral-500 hover:text-neutral-800'
          }`}
        >
          ✈️ CHÍNH SÁCH BẢO HIỂM ĐƠN HÀNG
        </button>
        <button
          onClick={() => setActiveTab('scam')}
          className={`py-3 px-5 text-xs font-display tracking-wider font-semibold uppercase border-b-2 transition-all shrink-0 ${
            activeTab === 'scam' 
              ? 'border-blue-600 text-blue-900' 
              : 'border-transparent text-neutral-500 hover:text-neutral-800'
          }`}
        >
          🛡️ Rủi ro Scam từ Seller Hàn
        </button>
      </div>

      {/* Rules Content area rendering dynamically */}
      <div className="bg-white p-6 sm:p-10 rounded-2xl border border-neutral-200 shadow-sm space-y-8 font-sans leading-relaxed text-sm text-neutral-600">
        
        {activeTab === 'policy' && (
          <div id="quy-tac-gom-hang-va-huy-don-hang" className="space-y-6 scroll-mt-20">
            <div className="flex items-center space-x-2.5 text-neutral-800 font-display font-bold text-base uppercase">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <span>1. Quy tắc gom hàng và hủy đơn hàng</span>
            </div>

            <div className="space-y-4">
              <p>
                Việc order rất quan trọng về số lượng gom đơn nên việc hủy đơn sẽ gây ảnh hưởng cho shop cũng như các bạn khách khác nữa nên hi vọng các bạn có trách nhiệm với đơn hàng của mình.
              </p>
              
              {/* Highlight severe warning card with red borders */}
              <div className="border-l-4 border-red-500 bg-red-50/70 p-4 rounded-r-xl space-y-2 select-none">
                <div className="flex items-center space-x-2 text-red-800 font-bold text-xs uppercase">
                  <UserX className="w-4 h-4 text-red-600 animate-pulse" />
                  <span>XỬ PHẠT NGHIÊM KHẮC BÙNG HÀNG:</span>
                </div>
                <p className="text-xs text-red-900 font-medium">
                  Nếu hủy đơn/không nhận hàng/không hoàn cọc đúng kì hạn thì shop sẽ <strong>KHÔNG REFUND</strong> (Không hoàn trả cọc). Đồng thời, bao gồm tất cả các đơn hàng về sau đơn hàng này cũng sẽ bị hủy và không refund. Nếu phát sinh đơn mới, shop chỉ nhận chuyển khoản full.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'shipping' && (
          <div id="chinh-sach-bao-hiem-don-hang" className="space-y-6 scroll-mt-20">
            <div className="flex items-center space-x-2.5 text-neutral-800 font-display font-bold text-base uppercase">
              <ShieldAlert className="w-5 h-5 text-blue-600" />
              <span>2. Lạc/ mất hàng/ Defect hàng hóa</span>
            </div>

            <div className="space-y-4">
              <p>
                Tất cả đơn vị vận chuyển đều sẽ có những rủi ro riêng và không thể tránh khỏi 100%. Việc giải quyết/ khiếu nại với bên vận chuyển dễ hay khó sẽ phụ thuộc vào việc bạn có mua bảo hiểm vận chuyển từ các bên vận chuyển hay không.
              </p>

              <div className="flex flex-col gap-4 pt-2">
                <div className="bg-neutral-50 p-4 border border-neutral-205 rounded-xl space-y-1">
                  <strong className="text-xs text-[#1A73E8] uppercase block font-extrabold">TRƯỜNG HỢP HOÀN TRẢ DO LỖI NGƯỜI NHẬN:</strong>
                  <p className="text-xs text-neutral-600 leading-normal font-sans">
                    Các đơn bưu tá liên lạc 3 lần bất thành sẽ tự hoàn trả về shop. Trước khi giao lần 2, shop sẽ thu phụ phí 100.000đ. Lần 2 vẫn không liên lạc được, bưu kiện sẽ đưa về hàng tồn thanh lý không hoàn trả cọc.
                  </p>
                </div>

                <div className="bg-neutral-50 p-4 border border-neutral-205 rounded-xl space-y-1">
                  <strong className="text-xs text-[#1A73E8] uppercase block font-extrabold">VIDEO UNBOXING ĐỐI CHIẾU:</strong>
                  <p className="text-xs text-neutral-600 leading-normal font-sans">
                    Khi nhận và khui kiện hàng, bạn <strong>BẮT BUỘC quay rõ nét video unboxing liền mạch không cắt ghép</strong> để shop làm dữ liệu đối chứng giải quyết khiếu nại nếu sản phẩm thiếu hụt hoặc giao nhầm phiên bản.
                  </p>
                </div>

                <div className="bg-neutral-50 p-4 border border-neutral-205 rounded-xl space-y-1.5">
                  <strong className="text-xs text-[#1A73E8] uppercase block font-extrabold">BẢO HIỂM:</strong>
                  <div className="text-xs text-neutral-600 space-y-1.5 font-sans leading-relaxed">
                    <p>• <strong>VTP:</strong> 0,5% giá trị đơn hàng ( tối thiểu 5.000đ/bưu gửi ).</p>
                    <p>• <strong>GHTK:</strong> 0,5% giá trị đơn hàng ( từ 1tr trở lên ); giá trị dưới 1tr ghtk miễn phí bảo hiểm.</p>
                    <p>• <strong>SPX:</strong> 0,5% giá trị đơn hàng ( từ 3tr trở lên ); giá trị dưới 3tr ghtk miễn phí bảo hiểm.</p>
                    <p className="font-semibold text-neutral-800 mt-1">Shop khuyên nên mua bảo hiểm để khi mất hàng còn có cách giải quyết ạ.</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl space-y-2 text-sky-950 text-xs">
                <div className="flex items-center space-x-1.5 font-bold uppercase text-sky-900">
                  <Video className="w-4 h-4 text-sky-700 font-bold" />
                  <span>ĐỀN BÙ BỞI ĐỐI TÁC VẬN CHUYỂN:</span>
                </div>
                <p>
                  <strong>- Không mua bảo hiểm trước đó:</strong> Đơn vị vận chuyển đền bù bao nhiêu tiền, shop sẽ chuyển khoản hoàn trả bạn bấy nhiêu.
                </p>
                <p>
                  <strong>- Có trả phí mua bảo hiểm trước đó:</strong> Đơn vị vận chuyển đền bù bao nhiêu, shop sẽ bồi hoàn bấy nhiêu đồng thời hoàn thêm 100% phần tiền công dịch vụ mua hàng của đơn đó.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'scam' && (
          <div id="rui-ro-scam-tu-seller-han" className="space-y-6 scroll-mt-20">
            <div className="flex items-center space-x-2.5 text-neutral-800 font-display font-bold text-base uppercase">
              <AlertTriangle className="w-5 h-5 text-blue-600 animate-bounce" />
              <span>3. RỦI RO SCAM TỪ SELLER HÀN</span>
            </div>

            <div className="space-y-4">
              <p>
                Trước khi tiến hành mua deal với bất kì Seller hay Fansite Master bên Hàn, Shop sẽ luôn kiểm tra bằng cách yêu cầu chụp ảnh kèm nametag vật lý, tra cứu thông tin số tài khoản trên các trang mạng xã hội. Tuy nhiên, rủi ro scam từ nước ngoài vẫn có xảy ra.
              </p>

              <div className="bg-neutral-50 border p-4 rounded-xl space-y-2 text-xs">
                <strong className="text-[#1A73E8] uppercase block font-bold">🛡️ CHÍNH SÁCH:</strong>
                <p>
                  Nếu bên bán (Seller/Master Hàn) cố chấp scam biến mất, shop xin cam kết sẽ <strong>HOÀN TRẢ LẠI TOÀN BỘ TIỀN CÔNG DỊCH VỤ + PHÍ CHUYỂN LOGISTICS H-V</strong> cho bạn. Số tiền hàng thực tế do chuyển thẳng ra ví seller nước ngoài nên mong các bạn hiểu và đồng cảm cho rủi ro không mong muốn.
                </p>
              </div>

              <div className="bg-neutral-50 border p-4 rounded-xl space-y-2 text-xs">
                <strong className="text-[#1A73E8] uppercase block font-bold">📦 CHẤT LƯỢNG HÀNG HOÁ (DEFECT - DF):</strong>
                <p>
                  Với các vật phẩm cũ hoặc deal gom, các vết xước dăm liti hoặc df nhẹ góc giấy là việc khó tránh hoàn toàn từ khâu vận chuyển quốc tế. Đối với những khách hàng quá khắt khe, chúng tôi khuyên bạn nên suy nghĩ kĩ trước khi săn deal cũ sang tay.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
