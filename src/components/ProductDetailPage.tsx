import React, { useState, useEffect } from 'react';
import { ChevronLeft, ShoppingBag, Truck, Calendar, Sparkles, Scale, Info, CheckCircle2, CalendarDays } from 'lucide-react';
import { Product } from '../types';
import { getProducts, subscribeProducts } from '../utils/products';

interface ProductDetailPageProps {
  id: number | null;
  addToCart: (product: Product, quantity?: number, version?: string) => void;
  setCurrentPage: (page: string) => void;
}

export default function ProductDetailPage({ id, addToCart, setCurrentPage }: ProductDetailPageProps) {
  const [productsList, setProductsList] = useState<Product[]>(() => getProducts());

  useEffect(() => {
    const unsubscribe = subscribeProducts((list) => {
      setProductsList(list);
    });
    return unsubscribe;
  }, []);

  // Gracefully fallback if ID is missing or invalid
  const product = productsList.find(p => p.id === id) || productsList[0];
  
  // States of current variants selector
  const hasMultiTier = !!(product?.attribute1Name && Array.isArray(product?.attribute1Options) && product.attribute1Options.length > 0);

  const [activeImage, setActiveImage] = useState(product?.image || '');

  const [selectedOpt1, setSelectedOpt1] = useState(() => {
    return product?.attribute1Options && Array.isArray(product.attribute1Options) && product.attribute1Options.length > 0 
      ? product.attribute1Options[0] 
      : '';
  });
  
  const [selectedOpt2, setSelectedOpt2] = useState(() => {
    return product?.attribute2Options && Array.isArray(product.attribute2Options) && product.attribute2Options.length > 0 
      ? product.attribute2Options[0] 
      : '';
  });

  const defaultVersion = (() => {
    if (!product) return "";
    if (Array.isArray(product.variations) && product.variations.length > 0) {
      return product.variations[0].name;
    }
    return Array.isArray(product.versions) && product.versions.length > 0 ? product.versions[0] : "";
  })();
  const [selectedVersion, setSelectedVersion] = useState(defaultVersion);
  const [quantity, setQuantity] = useState(1);

  // Reset selected options, active image, version, and quantity when product changes
  useEffect(() => {
    if (product) {
      setActiveImage(product.image || '');
      setSelectedOpt1(product.attribute1Options && Array.isArray(product.attribute1Options) && product.attribute1Options.length > 0 ? product.attribute1Options[0] : '');
      setSelectedOpt2(product.attribute2Options && Array.isArray(product.attribute2Options) && product.attribute2Options.length > 0 ? product.attribute2Options[0] : '');
      
      const nextDefaultVersion = (() => {
        if (product.variations && Array.isArray(product.variations) && product.variations.length > 0) {
          return product.variations[0].name;
        }
        return product.versions && Array.isArray(product.versions) && product.versions.length > 0 ? product.versions[0] : "";
      })();
      setSelectedVersion(nextDefaultVersion);
      setQuantity(1);
    }
  }, [product?.id]);

  // Stock tracking helper functions
  const getMatrixStock = (o1: string, o2?: string) => {
    if (!product || !Array.isArray(product.variantMatrix)) return 99;
    const item = product.variantMatrix.find(
      v => v && v.option1 === o1 && (!o2 || v.option2 === o2)
    );
    return item?.stock !== undefined ? item.stock : 99;
  };

  const getVariationStock = (name: string) => {
    if (!product) return 99;
    if (Array.isArray(product.variations) && product.variations.length > 0) {
      const v = product.variations.find(item => item && item.name === name);
      return v?.stock !== undefined ? v.stock : 99;
    }
    return product.stock !== undefined ? product.stock : 99;
  };

  const isSelectedOutOfStock = (() => {
    if (hasMultiTier) {
      return getMatrixStock(selectedOpt1, selectedOpt2) === 0;
    } else {
      return getVariationStock(selectedVersion) === 0;
    }
  })();

  // Sync / Reset selections on ID change
  React.useEffect(() => {
    if (product) {
      setActiveImage(product.image || '');
      setSelectedOpt1(product.attribute1Options && Array.isArray(product.attribute1Options) && product.attribute1Options.length > 0 ? product.attribute1Options[0] : '');
      setSelectedOpt2(product.attribute2Options && Array.isArray(product.attribute2Options) && product.attribute2Options.length > 0 ? product.attribute2Options[0] : '');
      
      const nextDefault = (() => {
        if (product.variations && Array.isArray(product.variations) && product.variations.length > 0) {
          return product.variations[0].name;
        }
        return product.versions && Array.isArray(product.versions) && product.versions.length > 0 ? product.versions[0] : "";
      })();
      setSelectedVersion(nextDefault);
      setQuantity(1);
    }
  }, [id]);

  // Auto-resolve Option 2 when Option 1 changes to a combination that might be out of stock
  React.useEffect(() => {
    if (hasMultiTier && product && product.attribute2Name && Array.isArray(product.attribute2Options)) {
      const currentStock = getMatrixStock(selectedOpt1, selectedOpt2);
      if (currentStock === 0) {
        const firstAvailable = product.attribute2Options.find(opt => getMatrixStock(selectedOpt1, opt) > 0);
        if (firstAvailable) {
          setSelectedOpt2(firstAvailable);
        }
      }
    }
  }, [selectedOpt1]);

  const plusQuantity = () => setQuantity(prev => prev + 1);
  const minusQuantity = () => setQuantity(prev => Math.max(1, prev - 1));

  // Determine actual selected combination and price
  const currentCombinedVersion = selectedOpt2 ? `${selectedOpt1} - ${selectedOpt2}` : selectedOpt1;
  
  const activeMatrixItem = hasMultiTier && product && Array.isArray(product.variantMatrix)
    ? product.variantMatrix.find(
        v => v && v.option1 === selectedOpt1 && (!product.attribute2Name || v.option2 === selectedOpt2)
      )
    : null;

  const activeVariation = !hasMultiTier && product && Array.isArray(product.variations)
    ? product.variations.find(v => v && v.name === selectedVersion)
    : null;

  const displayedPrice = hasMultiTier
    ? (activeMatrixItem ? activeMatrixItem.price : (product?.price || 0))
    : (activeVariation ? activeVariation.price : (product?.price || 0));

  const displayedPob = hasMultiTier
    ? (activeMatrixItem && activeMatrixItem.pob ? activeMatrixItem.pob : product?.preorderGift)
    : product?.preorderGift;

  const handleAddToCart = () => {
    if (!product || isSelectedOutOfStock) return;
    const finalVer = hasMultiTier ? currentCombinedVersion : selectedVersion;
    addToCart(product, quantity, finalVer);
    setCurrentPage('cart');
  };

  if (!product) {
    return (
      <div className="py-20 text-center space-y-4">
        <div className="animate-spin inline-block w-8 h-8 border-[3px] border-current border-t-transparent text-blue-600 rounded-full" role="status">
          <span className="sr-only">Đang tải...</span>
        </div>
        <p className="text-neutral-500 font-mono text-sm">Đang tải chi tiết sản phẩm hoặc không tìm thấy sản phẩm...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Back button */}
      <div>
        <button
          onClick={() => setCurrentPage('shop')}
          className="inline-flex items-center space-x-1.5 text-xs font-mono font-bold tracking-widest text-neutral-500 hover:text-black uppercase group"
        >
          <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Quay lại cửa hàng</span>
        </button>
      </div>

      {/* Main Block split (1/2 - 1/2 Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        {/* Left: Beautiful media gallery block */}
        <div className="space-y-4">
          <div className="border border-neutral-200 bg-white rounded-2xl overflow-hidden shadow-sm aspect-square p-3">
            <img 
              src={activeImage || product.image} 
              alt={product.name} 
              className="w-full h-full object-cover rounded-xl transition-all duration-350"
              referrerPolicy="no-referrer"
            />
          </div>

          {(() => {
            const allImages = [product.image, ...(Array.isArray(product.images) ? product.images : [])].filter(Boolean);
            if (allImages.length <= 1) return null;
            return (
              <div className="grid grid-cols-4 gap-3">
                {allImages.map((img, i) => {
                  const isActive = activeImage === img;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveImage(img)}
                      className={`border rounded-lg overflow-hidden aspect-square p-1 bg-white hover:border-blue-500 transition-colors ${
                        isActive ? 'border-blue-500 ring-2 ring-blue-400 scale-[1.02]' : 'border-neutral-200 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <img src={img} className="w-full h-full object-cover rounded" alt={`Thumbnail ${i + 1}`} referrerPolicy="no-referrer" />
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Right: Rich configurator and settings */}
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <span className={`px-2.5 py-1 text-[10px] font-mono tracking-wider font-semibold rounded uppercase border ${getBadgeStyles(product.tag)}`}>
                {product.tag}
              </span>
              <span className="text-[10px] font-mono tracking-widest text-neutral-400 bg-neutral-100 border border-neutral-200/60 px-2 py-0.5 rounded uppercase">
                {product.category}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-display font-bold text-neutral-900 tracking-tight leading-tight">
              {product.name}
            </h1>

            <div className="text-2xl font-mono font-bold text-black pt-1">
              {displayedPrice.toLocaleString('vi-VN')} <span className="text-sm font-sans tracking-normal">VND</span>
            </div>
          </div>

          {/* Quick highlighting block info - Replace with Hạn order, Ngày phát hành, Quà tặng Pre-order */}
          <div className="bg-[#f8ffff] border border-blue-200/60 rounded-xl p-5 space-y-4 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-mono tracking-wider text-neutral-400 uppercase block font-semibold">HẠN ORDER</span>
                  <span className="text-xs font-semibold text-neutral-800 font-sans">
                    {product.orderDeadline || "(Chưa cập nhật)"}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-mono tracking-wider text-neutral-400 uppercase block font-semibold">NGÀY PHÁT HÀNH</span>
                  <span className="text-xs font-semibold text-neutral-800 font-sans">
                    {product.releaseDate || "(Chưa cập nhật)"}
                  </span>
                </div>
              </div>
            </div>

            {displayedPob && displayedPob.trim() !== "" && (
              <div className="border-t border-dashed border-neutral-200 pt-3 flex items-start space-x-2">
                <div className="mt-0.5 text-amber-500 font-bold text-sm">🎁</div>
                <div>
                  <span className="text-[11px] font-semibold text-neutral-800 font-sans">
                    Quà tặng Pre-order (POB):{" "}
                    <span className="font-normal text-neutral-600">
                      {displayedPob}
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Option Variant/Size select */}
          {hasMultiTier ? (
            <div className="space-y-4 border border-neutral-200 rounded-xl p-4 bg-white shadow-sm">
              <div className="space-y-3.5">
                {/* Attribute 1 selection block */}
                {product.attribute1Name && product.attribute1Options && product.attribute1Options.length > 0 && (
                  <div className="space-y-2">
                    <label className="block text-xs font-mono font-bold tracking-wider text-neutral-500 uppercase text-blue-900 font-bold">
                      ⚙️ {product.attribute1Name.toUpperCase()}:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {product.attribute1Options.map((opt) => {
                        const isSelected = selectedOpt1 === opt;
                        const stockVal = getMatrixStock(opt, product.attribute2Name ? selectedOpt2 : undefined);
                        const isOutOfStock = stockVal === 0;
                        return (
                          <button
                            key={opt}
                            type="button"
                            disabled={isOutOfStock}
                            onClick={() => setSelectedOpt1(opt)}
                            className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-all ${
                              isOutOfStock
                                ? 'bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed line-through'
                                : isSelected
                                ? 'border-blue-500 bg-blue-50/50 text-blue-900 ring-2 ring-blue-400 font-bold'
                                : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400'
                            }`}
                          >
                            {opt} {isOutOfStock && '(Hết hàng)'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Attribute 2 selection block */}
                {product.attribute2Name && product.attribute2Options && product.attribute2Options.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-neutral-100">
                    <label className="block text-xs font-mono font-bold tracking-wider text-neutral-500 uppercase text-blue-900 font-bold">
                      ⚙️ {product.attribute2Name.toUpperCase()}:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {product.attribute2Options.map((opt) => {
                        const isSelected = selectedOpt2 === opt;
                        const stockVal = getMatrixStock(selectedOpt1, opt);
                        const isOutOfStock = stockVal === 0;
                        return (
                          <button
                            key={opt}
                            type="button"
                            disabled={isOutOfStock}
                            onClick={() => setSelectedOpt2(opt)}
                            className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-all ${
                              isOutOfStock
                                ? 'bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed line-through'
                                : isSelected
                                ? 'border-blue-500 bg-blue-50/50 text-blue-900 ring-2 ring-blue-400 font-bold'
                                : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400'
                            }`}
                          >
                            {opt} {isOutOfStock && '(Hết hàng)'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            ((Array.isArray(product.variations) && product.variations.length > 0) || (Array.isArray(product.versions) && product.versions.length > 0)) && (
              <div className="space-y-2.5">
                <label className="block text-xs font-mono font-bold tracking-wider text-neutral-500 uppercase">
                  ⚙️ PHÂN LOẠI ({product.variationName || "VERSION / SIZE"}):
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {Array.isArray(product.variations) && product.variations.length > 0 ? (
                    product.variations.map((v) => {
                      const isSelected = selectedVersion === v.name;
                      const isOutOfStock = v.stock === 0;
                      return (
                        <button
                          key={v.name}
                          type="button"
                          disabled={isOutOfStock}
                          onClick={() => setSelectedVersion(v.name)}
                          className={`w-full text-left p-3.5 rounded-lg border text-xs font-display transition-all ${
                            isOutOfStock
                              ? 'bg-neutral-50 border-neutral-200 text-neutral-400 cursor-not-allowed line-through'
                              : isSelected 
                              ? 'border-blue-400 bg-blue-50/25 font-semibold text-blue-900' 
                              : 'border-neutral-200 bg-white hover:border-neutral-400'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>
                              {v.name} - <span className="font-mono font-bold text-neutral-800">{v.price.toLocaleString('vi-VN')} VND</span>
                              {isOutOfStock && <span className="text-rose-600 font-bold ml-2">(Hết hàng)</span>}
                            </span>
                            {isSelected && <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />}
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    Array.isArray(product.versions) && product.versions.map((ver) => {
                      const isSelected = selectedVersion === ver;
                      const isOutOfStock = product.stock === 0;
                      return (
                        <button
                          key={ver}
                          type="button"
                          disabled={isOutOfStock}
                          onClick={() => setSelectedVersion(ver)}
                          className={`w-full text-left p-3.5 rounded-lg border text-xs font-display transition-all ${
                            isOutOfStock
                              ? 'bg-neutral-50 border-neutral-200 text-neutral-400 cursor-not-allowed line-through'
                              : isSelected 
                              ? 'border-blue-400 bg-blue-50/25 font-semibold text-blue-900' 
                              : 'border-neutral-200 bg-white hover:border-neutral-400'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>
                              {ver}
                              {isOutOfStock && <span className="text-rose-600 font-bold ml-2">(Hết hàng)</span>}
                            </span>
                            {isSelected && <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
                {activeVariation && activeVariation.description && (
                  <div className="mt-2.5 p-3 rounded-lg bg-emerald-50/10 border border-emerald-100 text-xs text-neutral-600 leading-relaxed font-sans">
                    <span className="font-bold text-emerald-800 block mb-1">ℹ️ Chi tiết {product.variationName || "phân loại"} {activeVariation.name}:</span>
                    {activeVariation.description}
                  </div>
                )}
              </div>
            )
          )}

          {/* Quantity numeric adjuster */}
          <div className="space-y-2.5">
            <label className="block text-xs font-mono font-bold tracking-wider text-neutral-500 uppercase">
              SỐ LƯỢNG:
            </label>
            <div className="flex items-center space-x-3">
              <div className="flex items-center border border-neutral-300 rounded-lg bg-neutral-50">
                <button
                  type="button"
                  onClick={minusQuantity}
                  className="px-3.5 py-2 text-neutral-600 hover:text-black font-semibold transition-colors border-r border-neutral-300"
                >
                  -
                </button>
                <input 
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-14 text-center font-mono font-medium text-sm border-0 focus:outline-none focus:ring-0 bg-transparent text-neutral-800"
                />
                <button
                  type="button"
                  onClick={plusQuantity}
                  className="px-3.5 py-2 text-neutral-600 hover:text-black font-semibold transition-colors border-l border-neutral-300"
                >
                  +
                </button>
              </div>
            </div>
          </div>

           {/* Big CTA buy button */}
          <div className="pt-4">
            <button
               onClick={handleAddToCart}
               disabled={isSelectedOutOfStock}
              className={`w-full py-4 px-6 border font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-md transition-all flex items-center justify-center space-x-3 ${
                isSelectedOutOfStock
                  ? 'bg-neutral-100 border-neutral-200 text-neutral-400 cursor-not-allowed shadow-none'
                  : 'bg-[#E8F0FE] hover:bg-[#D2E3FC] border-[#E8F0FE] text-[#1A73E8] hover:translate-y-[-1px] active:translate-y-0'
              }`}
            >
              <ShoppingBag className={`w-4 h-4 ${isSelectedOutOfStock ? 'text-neutral-400' : 'text-[#1A73E8]'}`} />
              <span>{isSelectedOutOfStock ? 'HẾT HÀNG (OUT OF STOCK)' : 'THÊM HÀNG VÀO GIỎ'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Complete detailed text descriptives */}
      <div className="border-t border-neutral-200 pt-10 space-y-6">
        {/* NOTICE box */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-neutral-700 leading-relaxed font-sans shadow-sm">
          <p className="font-bold text-amber-900 flex items-center space-x-1.5 mb-1 text-[13px]">
            <span>⚠️</span>
            <span>THÔNG BÁO (NOTICE)</span>
          </p>
          <p className="font-medium">
            * Hộp ngoài (Outbox) được thiết kế để chống sốc và bảo vệ sản phẩm, vì vậy các vết trầy xước, nếp nhăn, biến màu, v.v. có thể xảy ra trong quá trình đóng gói/vận chuyển và không phải là lý do để đổi trả hàng.
          </p>
        </div>

        <h3 className="text-lg font-display font-bold text-neutral-900 tracking-tight flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 text-neutral-850" />
          <span>MÔ TẢ SẢN PHẨM</span>
        </h3>

        <p className="text-sm text-neutral-600 leading-relaxed font-sans whitespace-pre-line max-w-4xl bg-white p-6 rounded-xl border border-neutral-200/80 shadow-sm">
          {product.detailedDesc || "Không có thông tin mô tả phụ thêm cho sản phẩm này. Hãy liên hệ với trực tiếp với shop để được giải đáp thắc mắc của bạn."}
        </p>
      </div>
    </div>
  );
}

function getBadgeStyles(tag?: string) {
  if (!tag) {
    return 'bg-neutral-50 text-neutral-700 border-neutral-200';
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
