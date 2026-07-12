import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShoppingBag, ArrowRight, Heart, Sparkles, Star, TrendingUp, Compass } from 'lucide-react';
import { Product } from '../types';
import { getProducts, subscribeProducts, resolveDefaultVersionForProduct, isProductSoldOut } from '../utils/products';

interface HomePageProps {
  navigateToProduct: (id: number) => void;
  addToCart: (product: Product, quantity?: number, version?: string) => void;
  setCurrentPage: (page: string) => void;
  wishlist: number[];
  toggleWishlist: (id: number) => void;
}

export default function HomePage({ 
  navigateToProduct, 
  addToCart, 
  setCurrentPage, 
  wishlist, 
  toggleWishlist 
}: HomePageProps) {
  // Filter out retired K-POP category
  const [allProducts, setAllProducts] = useState<Product[]>(() => 
    getProducts().filter(p => p.category && p.category.toLowerCase() !== 'k-pop')
  );

  const normalizeCategory = (cat: string): string => {
    if (!cat) return "";
    const norm = cat.toLowerCase().trim();
    if (norm === 'kstyle' || norm === 'k-style' || norm === 'k style') {
      return 'k-style';
    }
    if (norm === 'merch' || norm === 'merchandise') {
      return 'merch';
    }
    if (norm === 'album') {
      return 'album';
    }
    return norm;
  };

  useEffect(() => {
    const unsubscribe = subscribeProducts((list) => {
      const filtered = list.filter(p => p.category && p.category.toLowerCase() !== 'k-pop');
      setAllProducts(filtered);
    });
    return unsubscribe;
  }, []);

  const preOrderProducts = allProducts.filter(p => p.tag?.toLowerCase() === 'pre-order');
  const albumProducts = allProducts.filter(p => normalizeCategory(p.category || "") === 'album');
  const merchProducts = allProducts.filter(p => normalizeCategory(p.category || "") === 'merch');
  const kStyleProducts = allProducts.filter(p => normalizeCategory(p.category || "") === 'k-style');

  const renderProductSlider = (title: string, icon: React.ReactNode, products: Product[]) => {
    return (
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <div className="flex items-center space-x-2.5">
            {icon}
            <h2 className="text-lg sm:text-xl font-display font-semibold tracking-wider text-black uppercase">{title}</h2>
            <span className="text-xs bg-neutral-100 text-neutral-600 px-2.5 py-0.5 rounded-full font-mono font-bold">
              {products.length}
            </span>
          </div>
          <button
            onClick={() => setCurrentPage('shop')}
            className="text-xs font-display font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 uppercase tracking-wider cursor-pointer"
          >
            <span>Xem tất cả</span>
            <span className="text-sm">→</span>
          </button>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-12 bg-white border border-dashed border-neutral-200 rounded-2xl">
            <p className="text-sm text-neutral-500 font-sans">Chưa có sản phẩm nào thuộc mục này.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Scroll Container */}
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
              {products.map((product) => {
                const isSoldOut = isProductSoldOut(product);
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ type: "spring", stiffness: 100 }}
                    className="snap-start shrink-0 w-[165px] sm:w-[185px] md:w-[220px] bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md hover:border-neutral-300 transition-all duration-300 group"
                  >
                    {/* Image Section */}
                    <div 
                      className="relative aspect-square overflow-hidden bg-neutral-100 cursor-pointer border-b border-neutral-100" 
                      onClick={() => navigateToProduct(product.id)}
                    >
                      <img 
                        src={product.image} 
                        alt={product.name} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                      {/* Category tag */}
                      <div className="absolute top-2.5 left-2.5 z-10">
                        <span className={`px-2 py-0.5 text-[9px] sm:text-[10px] font-mono tracking-wider font-semibold rounded uppercase border ${exportTagStyles(product.tag)}`}>
                          {product.tag}
                        </span>
                      </div>
                      {/* Heart button */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWishlist(product.id);
                        }}
                        className={`absolute top-2.5 right-2.5 p-1.5 rounded-full transition-colors shadow-sm ${
                          wishlist.includes(product.id)
                            ? 'bg-red-50 text-red-500'
                            : 'bg-white/80 hover:bg-white text-neutral-600 hover:text-red-500'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${wishlist.includes(product.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </button>
                    </div>

                    {/* Body Content */}
                    <div className="p-3 sm:p-4 flex flex-col flex-1 space-y-3">
                      <div className="space-y-0.5">
                        <h3 
                          onClick={() => navigateToProduct(product.id)} 
                          className="text-xs sm:text-sm font-semibold text-neutral-900 group-hover:text-black cursor-pointer leading-tight line-clamp-2 h-8 sm:h-10 tracking-tight"
                        >
                          {product.name}
                        </h3>
                        {product.artist && (
                          <p className="text-[10px] sm:text-[11.5px] text-blue-600 font-sans line-clamp-1 font-semibold flex items-center gap-1">
                            <span>🎤</span> 
                            <span className="truncate">{product.artist}</span>
                          </p>
                        )}
                      </div>

                      {/* Bullet Spec Highlights */}
                      <div className="p-2 sm:p-2.5 bg-neutral-50 rounded-lg text-[10px] sm:text-[11px] text-neutral-600 min-h-[38px] sm:min-h-[44px] flex flex-col justify-center space-y-0.5 leading-normal">
                        <div className="flex items-center gap-1 truncate">
                          <span>• Hạn:</span>
                          <strong className="text-neutral-800 font-semibold truncate text-[9.5px] sm:text-[10.5px]">{product.orderDeadline || "Sẵn hàng"}</strong>
                        </div>
                        <div className="flex items-center gap-1 truncate">
                          <span>• Phát hành:</span>
                          <strong className="text-neutral-800 font-semibold truncate text-[9.5px] sm:text-[10.5px]">{product.releaseDate || "Đã ra mắt"}</strong>
                        </div>
                      </div>

                      {/* Pricing and CTAs */}
                      <div className="pt-1 flex flex-col space-y-2 mt-auto">
                        <div className="flex items-baseline justify-between gap-1 flex-wrap">
                          <span className="text-[9px] font-mono text-neutral-400 uppercase">GIÁ:</span>
                          <span className="text-xs sm:text-sm md:text-base font-mono font-bold text-black">
                            {product.price.toLocaleString('vi-VN')} <span className="text-[9px] sm:text-xs font-sans font-normal text-neutral-500">đ</span>
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          <button 
                            onClick={() => navigateToProduct(product.id)}
                            className="py-1.5 sm:py-2 px-1 border border-neutral-200 hover:border-black text-neutral-700 hover:text-black text-[10px] sm:text-xs font-display font-medium rounded-lg text-center transition-colors shadow-sm cursor-pointer"
                          >
                            CHI TIẾT
                          </button>
                          <button 
                            onClick={() => {
                              if (isSoldOut) {
                                alert("⚠️ Sản phẩm này đã hết hàng!");
                                return;
                              }
                              const defaultVer = resolveDefaultVersionForProduct(product);
                              addToCart(product, 1, defaultVer);
                            }}
                            disabled={isSoldOut}
                            className={`py-1.5 sm:py-2 px-1 text-[10px] sm:text-xs font-display font-medium rounded-lg flex items-center justify-center space-x-1 transition-colors shadow-sm cursor-pointer ${
                              isSoldOut
                                ? "bg-neutral-100 border border-neutral-200 text-neutral-400 cursor-not-allowed"
                                : "bg-[#E8F0FE] hover:bg-[#D2E3FC] border border-[#E8F0FE] text-[#1A73E8]"
                            }`}
                          >
                            <ShoppingBag className={`w-3 h-3 ${isSoldOut ? "text-neutral-400" : "text-[#1A73E8]"}`} />
                            <span className="truncate">{isSoldOut ? "HẾT" : "MUA"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="space-y-16">
      {/* Premium Hero Section */}
      <section className="relative overflow-hidden bg-[#e8f0ff] text-neutral-900 rounded-[24px] border border-blue-200 p-8 sm:p-12 lg:p-16">
        {/* Subtle grid pattern background overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e40af0a_1px,transparent_1px),linear-gradient(to_bottom,#1e40af0a_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
        
        {/* Ambience light effects - centered glowing planets */}
        <div className="absolute top-1/2 left-1/2 -translate-x-[20%] -translate-y-1/2 w-[350px] h-[350px] sm:w-[500px] sm:h-[500px] bg-white rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-[30%] -translate-y-1/2 w-[220px] h-[220px] sm:w-[320px] sm:h-[320px] bg-blue-100 rounded-full blur-[60px] pointer-events-none" />

        <div className="relative max-w-3xl space-y-6">
          <div className="inline-flex items-center space-x-2 bg-white text-blue-900 text-xs px-4 py-2 rounded-full border border-blue-300 font-mono tracking-wider select-none">
            <span>UY TÍN • CHẤT LƯỢNG</span>
          </div>

          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl sm:text-5xl lg:text-6.5xl font-display font-bold tracking-tight leading-tight uppercase text-blue-950"
          >
            YENG CORNER
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-sm sm:text-base text-neutral-700 leading-relaxed font-sans max-w-2xl whitespace-pre-line"
          >
            Xin chào ! Shop mình được thành lập từ năm 2019 và nhờ sự ủng hộ và yêu quý của các bạn mà mình vẫn có động lực để tiếp tục phát triển hơn ♡{"\n"}
            Mình nhận order all Korea.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="pt-4 flex flex-wrap gap-4"
          >
            <button 
              onClick={() => setCurrentPage('shop')}
              className="px-7 py-3 sm:px-8 sm:py-3.5 bg-[#e8f0ff] border border-blue-400 text-blue-950 font-bold rounded-xl hover:bg-blue-100/50 active:scale-95 transition-all inline-flex items-center gap-1.5"
            >
              <span>MUA SẮM NGAY</span>
              <span className="text-lg font-normal">→</span>
            </button>
            <button 
              onClick={() => setCurrentPage('rules')}
              className="px-6 py-3 sm:px-7 sm:py-3.5 bg-[#e8f0ff] border border-blue-300 text-blue-900 font-semibold rounded-xl hover:bg-white active:scale-95 transition-all text-sm uppercase"
            >
              CHÍNH SÁCH SHOP
            </button>
          </motion.div>
        </div>
      </section>

      <style dangerouslySetInnerHTML={{ __html: `
        .scrollbar-none::-webkit-scrollbar, .no-scrollbar::-webkit-scrollbar {
          display: none !important;
        }
        .scrollbar-none, .no-scrollbar {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
      `}} />

      {/* 1. KHU VỰC SẢN PHẨM PRE-ORDER */}
      {renderProductSlider(
        "Sản phẩm Pre-Order", 
        <Sparkles className="w-5 h-5 text-amber-500 fill-amber-500/20" />, 
        preOrderProducts
      )}

      {/* 2. KHU VỰC ALBUM */}
      {renderProductSlider(
        "Album", 
        <Compass className="w-5 h-5 text-blue-600" />, 
        albumProducts
      )}

      {/* 3. KHU VỰC MERCH */}
      {renderProductSlider(
        "Merch", 
        <ShoppingBag className="w-5 h-5 text-emerald-600" />, 
        merchProducts
      )}

      {/* 4. KHU VỰC K-STYLE */}
      {renderProductSlider(
        "K-style", 
        <TrendingUp className="w-5 h-5 text-purple-600" />, 
        kStyleProducts
      )}

      {/* View all products redirection button */}
      <div className="flex justify-center pt-4">
        <button
          onClick={() => setCurrentPage('shop')}
          className="px-8 py-3.5 bg-[#E8F0FE] hover:bg-[#D2E3FC] text-[#1A73E8] font-display font-bold text-xs tracking-widest rounded-xl shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center space-x-2.5 cursor-pointer uppercase border border-[#E8F0FE] hover:border-[#D2E3FC]"
        >
          <span>XEM TẤT CẢ SẢN PHẨM</span>
          <span className="text-base">→</span>
        </button>
      </div>
    </div>
  );
}

// Simple browser dialog alert alternative for high-end feel
function triggerAddedNotifier(name: string) {
  alert(`🛒 Đã thêm thành công: "${name}" vào giỏ hàng của bạn!`);
}

// Export custom tag color stylings
function exportTagStyles(tag?: string) {
  if (!tag) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  switch (tag.toLowerCase()) {
    case 'sẵn hàng':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'pre-order':
      return 'bg-[#E8F0FE] text-[#1A73E8] border-[#1A73E8]/20';
    case 'order web':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    default:
      return 'bg-neutral-50 text-neutral-700 border-neutral-200';
  }
}
