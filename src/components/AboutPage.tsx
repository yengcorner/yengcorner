import React from 'react';
import { Compass, Scale, Headphones, ShieldCheck, Heart, Award, Gem, Globe2 } from 'lucide-react';

export default function AboutPage() {
  const stats = [
    { label: "BASED IN", value: "HCMC" },
    { label: "EXPORT TIME", value: "2-3 DAYS" },
    { label: "SUPPLY PARTNERS", value: "WEVERSE/ KTOWN4U" },
    { label: "PAYMENT", value: "VND/ PAYPAL USD" }
  ];

  const offers = [
    {
      title: "ORDER THEO YÊU CẦU WEB HÀN QUỐC",
      desc: "Chỉ cần gửi link sản phẩm, shop sẽ báo giá sản phẩm và order về giúp bạn"
    },
    {
      title: "Order Album/ Merch K-pop số lượng lớn",
      desc: "Trung gian cho các bạn mua số lượng lớn album/ merch K-pop với giá chiết khấu từ Ktown4u."
    },
    {
      title: "Gom Mua Deal Hàn trên Twitter",
      desc: "Thay bạn đàm phán mua card, album, merchandise hiếm của idol từ các Seller Hàn, check kĩ số tài khoản, nametag"
    },
    {
      title: "Vận chuyển Hàn - Việt",
      desc: "Toàn bộ hàng bay Air chỉ 2-3 ngày đáp kho Sài Gòn, gom hàng giảm chi phí vận chuyển tối đa."
    },
    {
      title: "Đổi ngoại tệ & Thanh toán hộ",
      desc: "Nạp/ đổi cổng Paypal USD tỷ giá ổn định, bảo mật danh tính, thời gian xử lý chưa đầy 10 phút."
    }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      {/* Intro Brand Heading */}
      <div className="text-center py-10 space-y-4">
        <div className="inline-flex items-center space-x-1 bg-[#e8f0ff] text-blue-900 border border-blue-300 text-[10px] font-mono font-bold tracking-widest uppercase px-3 py-1 rounded-full">
          <Globe2 className="w-3 h-3 text-blue-700" />
          <span>Established 2019</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-display font-medium tracking-tight text-neutral-900 uppercase">
          ABOUT YENG CORNER
        </h1>
        <p className="text-sm sm:text-base text-neutral-500 max-w-2xl mx-auto leading-relaxed font-sans">
          Order album, merch K-pop, K-style và K-beauty chính hãng qua các đại lý lớn tại Hàn Quốc.
        </p>
      </div>

      {/* Stats Board Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-5 rounded-xl border border-neutral-200 text-center space-y-1 shadow-sm hover:border-neutral-300 transition-colors select-none">
            <span className="text-[10px] text-neutral-400 font-mono tracking-wider block uppercase">{stat.label}</span>
            <strong className="text-sm font-display font-bold text-neutral-950 block">{stat.value}</strong>
          </div>
        ))}
      </div>

      {/* Detailed Story Narrative Card */}
      <div className="bg-[#e8f0ff] border border-blue-200 rounded-2xl p-6 sm:p-10 shadow-sm max-w-3xl mx-auto space-y-4 hover:shadow-md transition-shadow">
        <div className="flex items-center space-x-2 select-none">
          <span className="text-lg">✨</span>
          <h3 className="text-base sm:text-lg font-display font-extrabold text-blue-900 tracking-widest uppercase">
            OUR STORY
          </h3>
        </div>
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-neutral-800 leading-relaxed font-sans font-medium">
            Yeng Corner ra đời với tâm huyết mang lại một quy trình gom hàng (Group Order) minh bạch, an toàn nhất cho cộng đồng fan BTS nói riêng và K-Pop nói chung tại Việt Nam.
          </p>
          <p className="text-xs sm:text-sm text-neutral-800 leading-relaxed font-sans">
            Qua nhiều năm, Yeng đã trao đến tay hàng ngàn người hâm mộ Kpop tại Việt Nam các mặt hàng official từ Hàn Quốc, Trung Quốc, Nhật Bản và vẫn không ngừng cải thiện, phát triển hơn.
          </p>
        </div>
      </div>

      {/* Commitment Section */}
      <div className="bg-[#E8F0FE] border border-blue-200 rounded-2xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow max-w-3xl mx-auto space-y-4">
        <div className="flex items-center space-x-3 select-none">
          <ShieldCheck className="w-7 h-7 text-[#1A73E8] shrink-0" />
          <h3 className="text-base sm:text-lg font-display font-extrabold text-[#1A73E8] tracking-wider uppercase">
            CHỮ TÍN ĐẶT LÊN HÀNG ĐẦU
          </h3>
        </div>
        <p className="text-xs sm:text-sm text-neutral-800 leading-relaxed font-sans font-medium">
          Tại Yeng Corner, chúng tôi hiểu rằng mỗi đơn hàng không chỉ là một giao dịch, mà còn là niềm tin của bạn gửi gắm. Yeng cam kết quy trình gom hàng minh bạch, uy tín, bảo mật thông tin và luôn có trách nhiệm với từng kiện hàng từ Hàn Quốc về đến tay bạn.
        </p>
      </div>

      {/* What we offer listing */}
      <div className="space-y-6">
        <div className="flex items-center space-x-2.5 border-b pb-3 border-neutral-200">
          <Compass className="w-5 h-5 text-neutral-850" />
          <h3 className="text-lg font-display font-semibold text-neutral-900 tracking-tight uppercase">CÁC DỊCH VỤ</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {offers.map((offer, idx) => (
            <div key={idx} className="bg-white p-5 rounded-xl border border-neutral-200 hover:border-neutral-300 transition-all shadow-sm space-y-2">
              <div className="flex items-center space-x-2 text-neutral-800 font-display font-bold text-sm uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                <span>{offer.title}</span>
              </div>
              <p className="text-xs text-neutral-500 leading-relaxed font-sans">{offer.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
