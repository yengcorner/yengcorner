import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShoppingBag, ArrowRight, Heart, Sparkles, Star, TrendingUp, Compass, X } from 'lucide-react';
import { Product } from '../types';
import { getProducts, subscribeProducts, resolveDefaultVersionForProduct, isProductSoldOut, isProductsLoaded, getProductStockForVersion } from '../utils/products';

interface HomePageProps {
  navigateToProduct: (id: number) => void;
  addToCart: (product: Product, quantity?: number, version?: string, customVariant?: string) => void;
  setCurrentPage: (page: string) => void;
  navigateToShop?: (category?: string) => void;
  wishlist: number[];
  toggleWishlist: (id: number) => void;
}

export default function HomePage({ 
  navigateToProduct, 
  addToCart, 
  setCurrentPage, 
  navigateToShop,
  wishlist, 
  toggleWishlist 
}: HomePageProps) {
  // Quick Order Modal state
  const [quickOrderProduct, setQuickOrderProduct] = useState<Product | null>(null);
  const [selectedVer, setSelectedVer] = useState<string>('');
  const [selectedOpt1, setSelectedOpt1] = useState<string>('');
  const [selectedOpt2, setSelectedOpt2] = useState<string>('');
  const [customText, setCustomText] = useState<string>('');
  const [orderQty, setOrderQty] = useState<number>(1);

  // Filter out retired K-POP category
  const [allProducts, setAllProducts] = useState<Product[]>(() => 
    getProducts().filter(p => p.category && p.category.toLowerCase() !== 'k-pop' && !isProductSoldOut(p))
  );
  const [isLoading, setIsLoading] = useState<boolean>(() => !isProductsLoaded() && allProducts.length === 0);

  const openQuickOrder = (prod: Product) => {
    setQuickOrderProduct(prod);
    setOrderQty(1);
    setCustomText('');
    
    // Auto initialize variant selections
    if (prod.attribute1Name && prod.variantMatrix && prod.variantMatrix.length > 0) {
      const o1 = (prod.attribute1Options && prod.attribute1Options[0]) || '';
      const o2 = (prod.attribute2Options && prod.attribute2Options[0]) || '';
      setSelectedOpt1(o1);
      setSelectedOpt2(o2);
      setSelectedVer(o2 ? `${o1} - ${o2}` : o1);
    } else if (prod.variations && prod.variations.length > 0) {
      setSelectedVer(prod.variations[0].name);
    } else if (prod.versions && prod.versions.length > 0) {
      setSelectedVer(prod.versions[0]);
    } else {
      setSelectedVer('');
    }
  };

  const handleGoToShop = (category: string = 'All') => {
    if (navigateToShop) {
      navigateToShop(category);
    } else {
      setCurrentPage('shop');
    }
  };

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
      const filtered = list.filter(p => p.category && p.category.toLowerCase() !== 'k-pop' && !isProductSoldOut(p));
      setAllProducts(filtered);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const preOrderProducts = allProducts.filter(p => p.tag?.toLowerCase() === 'pre-order');
  const albumProducts = allProducts.filter(p => normalizeCategory(p.category || "") === 'album');
  const merchProducts = allProducts.filter(p => normalizeCategory(p.category || "") === 'merch');
  const kStyleProducts = allProducts.filter(p => normalizeCategory(p.category || "") === 'k-style');

  const renderSliderSkeleton = (title: string) => (
    <section className="space-y-6">
      <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
        <div className="h-6 w-36 sm:w-48 bg-neutral-200 animate-pulse rounded-md"></div>
        <div className="h-4 w-16 bg-neutral-200 animate-pulse rounded-md"></div>
      </div>
      <div className="flex overflow-x-hidden gap-4 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="shrink-0 w-[165px] sm:w-[185px] md:w-[220px] bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col animate-pulse">
            <div className="aspect-square bg-neutral-200"></div>
            <div className="p-3 sm:p-4 space-y-3">
              <div className="h-4 bg-neutral-200 rounded w-3/4"></div>
              <div className="h-3 bg-neutral-200 rounded w-1/2"></div>
              <div className="h-5 bg-neutral-200 rounded w-1/3 pt-1"></div>
              <div className="h-8 bg-neutral-200 rounded-lg w-full mt-2"></div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  const renderProductSlider = (title: string, products: Product[], targetCategory: string) => {
    if (isLoading && allProducts.length === 0) {
      return renderSliderSkeleton(title);
    }

    return (
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <div className="flex items-center">
            <h2 className="text-lg sm:text-xl font-display font-semibold tracking-wider text-black uppercase">{title}</h2>
          </div>
          <button
            onClick={() => handleGoToShop(targetCategory)}
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
                        loading="lazy"
                      />
                      {/* Category tag */}
                      {product.tag && product.tag.trim() !== "" && (
                        <div className="absolute top-2.5 left-2.5 z-10">
                          <span className={`px-2 py-0.5 text-[9px] sm:text-[10px] font-mono tracking-wider font-semibold rounded uppercase border ${exportTagStyles(product.tag)}`}>
                            {product.tag}
                          </span>
                        </div>
                      )}
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

                      {/* Pricing */}
                      <div className="pt-2.5 border-t border-neutral-100 flex items-baseline justify-between gap-1 mt-auto">
                        <span className="text-[9px] font-mono text-neutral-400 uppercase">GIÁ:</span>
                        <span className="text-xs sm:text-sm md:text-base font-mono font-bold text-black">
                          {product.price.toLocaleString('vi-VN')} <span className="text-[9px] sm:text-xs font-sans font-normal text-neutral-500">đ</span>
                        </span>
                      </div>

                      {/* Nút đặt hàng trực tiếp ngoài trang chủ */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openQuickOrder(product);
                        }}
                        disabled={isSoldOut}
                        className={`w-full py-2 px-2 text-[11px] font-bold uppercase tracking-wider rounded-lg border transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                          isSoldOut
                            ? 'bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed'
                            : 'bg-[#E8F0FE] hover:bg-[#D2E3FC] text-[#1A73E8] border-[#D2E3FC]'
                        }`}
                      >
                        <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                        <span>{isSoldOut ? 'Hết hàng' : 'Đặt hàng'}</span>
                      </button>
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
              onClick={() => handleGoToShop('All')}
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
        preOrderProducts,
        "Pre-Order"
      )}

      {/* 2. KHU VỰC ALBUM */}
      {renderProductSlider(
        "Album", 
        albumProducts,
        "Album"
      )}

      {/* 3. KHU VỰC MERCH */}
      {renderProductSlider(
        "Merch", 
        merchProducts,
        "Merch"
      )}

      {/* 4. KHU VỰC K-STYLE */}
      {renderProductSlider(
        "K-style", 
        kStyleProducts,
        "K-style"
      )}

      {/* View all products redirection button */}
      <div className="flex justify-center pt-4">
        <button
          onClick={() => handleGoToShop('All')}
          className="px-8 py-3.5 bg-[#E8F0FE] hover:bg-[#D2E3FC] text-[#1A73E8] font-display font-bold text-xs tracking-widest rounded-xl shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center space-x-2.5 cursor-pointer uppercase border border-[#E8F0FE] hover:border-[#D2E3FC]"
        >
          <span>XEM TẤT CẢ SẢN PHẨM</span>
          <span className="text-base">→</span>
        </button>
      </div>

      {/* KHUNG ĐẶT HÀNG NGOÀI TRANG CHỦ */}
      {quickOrderProduct && (() => {
        const has2Tiers = Boolean(
          quickOrderProduct.attribute1Name && 
          quickOrderProduct.variantMatrix && 
          quickOrderProduct.variantMatrix.length > 0
        );

        const isCustomActive = Boolean(
          quickOrderProduct.allowCustomVariant ||
          (selectedVer && (selectedVer.toLowerCase().includes('tự điền') || selectedVer.toLowerCase().includes('khách tự nhập'))) ||
          (selectedOpt1 && (selectedOpt1.toLowerCase().includes('tự điền') || selectedOpt1.toLowerCase().includes('khách tự nhập'))) ||
          (selectedOpt2 && (selectedOpt2.toLowerCase().includes('tự điền') || selectedOpt2.toLowerCase().includes('khách tự nhập'))) ||
          (quickOrderProduct.variationName && (quickOrderProduct.variationName.toLowerCase().includes('tự điền') || quickOrderProduct.variationName.toLowerCase().includes('khách tự nhập')))
        );

        // Find active variant price
        let currentPrice = quickOrderProduct.price || 0;
        let currentStock = quickOrderProduct.stock ?? 100;
        if (has2Tiers && quickOrderProduct.variantMatrix) {
          const matched = quickOrderProduct.variantMatrix.find(
            v => v.option1 === selectedOpt1 && (!quickOrderProduct.attribute2Name || v.option2 === selectedOpt2)
          );
          if (matched) {
            currentPrice = matched.price;
            currentStock = matched.stock ?? 0;
          }
        } else if (quickOrderProduct.variations && quickOrderProduct.variations.length > 0) {
          const matched = quickOrderProduct.variations.find(v => v.name === selectedVer);
          if (matched) {
            currentPrice = matched.price;
            currentStock = matched.stock ?? 0;
          }
        }

        const handleConfirmOrder = (goToCart: boolean = false) => {
          if (!quickOrderProduct) return;
          if (isCustomActive && !customText.trim()) {
            alert("✍️ Vui lòng điền thông tin phân loại / size / ghi chú của bạn vào ô trống trước khi đặt hàng!");
            return;
          }
          let finalVer = has2Tiers 
            ? (selectedOpt2 ? `${selectedOpt1} - ${selectedOpt2}` : selectedOpt1) 
            : selectedVer;
          if (isCustomActive && customText.trim()) {
            finalVer = finalVer 
              ? `${finalVer} (Khách điền: ${customText.trim()})` 
              : `Tự điền: ${customText.trim()}`;
          }
          addToCart(quickOrderProduct, orderQty, finalVer, isCustomActive ? customText.trim() : undefined);
          setQuickOrderProduct(null);
          if (goToCart) {
            setCurrentPage('cart');
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-neutral-200 p-5 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🛍️</span>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900 font-display">
                      Khung đặt hàng nhanh
                    </h3>
                    <p className="text-xs text-neutral-500">
                      Chọn phân loại và tùy chỉnh chi tiết sản phẩm
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setQuickOrderProduct(null)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Product preview */}
              <div className="flex gap-3.5 p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                <img
                  src={quickOrderProduct.image}
                  alt={quickOrderProduct.name}
                  className="w-16 h-16 object-cover rounded-lg shrink-0 border border-neutral-200"
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <h4 className="text-xs font-bold text-neutral-900 line-clamp-2 leading-tight">
                    {quickOrderProduct.name}
                  </h4>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-mono font-bold text-blue-900">
                      {currentPrice.toLocaleString('vi-VN')} đ
                    </span>
                    <span className="text-[10px] font-mono text-neutral-500">
                      Kho: {currentStock > 0 ? `${currentStock} sp` : 'Hết hàng'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Multi-tier variant selectors */}
              {has2Tiers ? (
                <div className="space-y-3">
                  {quickOrderProduct.attribute1Name && quickOrderProduct.attribute1Options && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-mono font-bold text-neutral-600 uppercase">
                        {quickOrderProduct.attribute1Name}:
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {quickOrderProduct.attribute1Options.map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setSelectedOpt1(opt)}
                            className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-all cursor-pointer ${
                              selectedOpt1 === opt
                                ? 'bg-blue-50 text-blue-900 border-blue-400 font-bold ring-1 ring-blue-400'
                                : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {quickOrderProduct.attribute2Name && quickOrderProduct.attribute2Options && (
                    <div className="space-y-1.5 pt-1">
                      <label className="text-[11px] font-mono font-bold text-neutral-600 uppercase">
                        {quickOrderProduct.attribute2Name}:
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {quickOrderProduct.attribute2Options.map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setSelectedOpt2(opt)}
                            className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-all cursor-pointer ${
                              selectedOpt2 === opt
                                ? 'bg-blue-50 text-blue-900 border-blue-400 font-bold ring-1 ring-blue-400'
                                : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Single-tier variants */
                (Array.isArray(quickOrderProduct.variations) && quickOrderProduct.variations.length > 0) ? (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono font-bold text-neutral-600 uppercase">
                      {quickOrderProduct.variationName || "Phân loại"}:
                    </label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {quickOrderProduct.variations.map(v => (
                        <button
                          key={v.name}
                          type="button"
                          onClick={() => setSelectedVer(v.name)}
                          className={`w-full p-2.5 rounded-lg border text-xs text-left transition-all flex items-center justify-between cursor-pointer ${
                            selectedVer === v.name
                              ? 'bg-blue-50 text-blue-900 border-blue-400 font-bold ring-1 ring-blue-400'
                              : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300'
                          }`}
                        >
                          <span>{v.name}</span>
                          <span className="font-mono">{Number(v.price).toLocaleString('vi-VN')} đ</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  Array.isArray(quickOrderProduct.versions) && quickOrderProduct.versions.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-mono font-bold text-neutral-600 uppercase">
                        {quickOrderProduct.variationName || "Phân loại"}:
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {quickOrderProduct.versions.map(ver => (
                          <button
                            key={ver}
                            type="button"
                            onClick={() => setSelectedVer(ver)}
                            className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-all cursor-pointer ${
                              selectedVer === ver
                                ? 'bg-blue-50 text-blue-900 border-blue-400 font-bold ring-1 ring-blue-400'
                                : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300'
                            }`}
                          >
                            {ver}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                )
              )}

              {/* Ô INPUT TRỐNG ĐỂ KHÁCH HÀNG TỰ GÕ THÔNG TIN PHÂN LOẠI HOẶC GHI CHÚ TÙY Ý */}
              {isCustomActive && (
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-blue-950 flex items-center gap-1.5 uppercase tracking-wide">
                      <span>✍️</span>
                      <span>Tự điền phân loại / size / ghi chú của bạn:</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <span className="text-[10px] font-mono text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full font-semibold">
                      Bắt buộc
                    </span>
                  </div>
                  <input
                    type="text"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder={quickOrderProduct.customVariantPlaceholder || "Ví dụ: Size XL, màu đen, in chữ Yeng..."}
                    className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-xs font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[10.5px] text-blue-700 font-sans leading-relaxed">
                    ℹ️ Thông tin bạn tự nhập sẽ được lưu trực tiếp vào chi tiết đơn hàng gửi đến shop.
                  </p>
                </div>
              )}

              {/* Quantity */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-neutral-700 font-mono uppercase">Số lượng:</span>
                <div className="flex items-center border border-neutral-300 rounded-lg bg-neutral-50 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOrderQty(prev => Math.max(1, prev - 1))}
                    className="px-3 py-1.5 text-neutral-600 hover:text-black font-bold transition-colors cursor-pointer"
                  >
                    -
                  </button>
                  <span className="px-3 py-1.5 text-xs font-mono font-bold text-neutral-800 min-w-8 text-center bg-white border-x border-neutral-300">
                    {orderQty}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (orderQty >= currentStock) {
                        alert(`Kho chỉ còn ${currentStock} sản phẩm!`);
                        return;
                      }
                      setOrderQty(prev => prev + 1);
                    }}
                    className="px-3 py-1.5 text-neutral-600 hover:text-black font-bold transition-colors cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => handleConfirmOrder(false)}
                  disabled={currentStock <= 0}
                  className="py-2.5 px-3 border border-neutral-300 hover:border-neutral-400 bg-white text-neutral-800 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer hover:bg-neutral-50 active:scale-95"
                >
                  Thêm vào giỏ
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmOrder(true)}
                  disabled={currentStock <= 0}
                  className="py-2.5 px-3 bg-[#E8F0FE] hover:bg-[#D2E3FC] text-[#1A73E8] border border-[#D2E3FC] text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Đặt hàng ngay</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
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
