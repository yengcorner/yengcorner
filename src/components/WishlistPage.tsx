import React, { useState, useEffect } from 'react';
import { Heart, ArrowRight, ShoppingBag } from 'lucide-react';
import { Product } from '../types';
import { getProducts, subscribeProducts, resolveDefaultVersionForProduct } from '../utils/products';

interface WishlistPageProps {
  wishlist: number[];
  toggleWishlist: (id: number) => void;
  navigateToProduct: (id: number) => void;
  addToCart: (product: Product, quantity?: number, version?: string) => void;
  setCurrentPage: (page: string) => void;
}

export default function WishlistPage({
  wishlist,
  toggleWishlist,
  navigateToProduct,
  addToCart,
  setCurrentPage
}: WishlistPageProps) {
  // Read all current products in real-time
  const [allProducts, setAllProducts] = useState<Product[]>(() => getProducts());

  useEffect(() => {
    const unsubscribe = subscribeProducts((list) => {
      setAllProducts(list);
    });
    return unsubscribe;
  }, []);

  const likedProducts = allProducts.filter((p) => wishlist.includes(p.id));

  return (
    <div className="space-y-8">
      {/* Title block */}
      <div className="border-b border-neutral-200 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-neutral-900 tracking-tight flex items-center space-x-2">
            <Heart className="w-6 h-6 text-red-500 fill-red-500" />
            <span>SẢN PHẨM YÊU THÍCH</span>
          </h2>
          <p className="text-sm text-neutral-500 mt-1">
            Danh sách lưu giữ các sản phẩm bạn đang quan tâm và muốn sở hữu.
          </p>
        </div>
        <button
          onClick={() => setCurrentPage('shop')}
          className="inline-flex items-center space-x-1 text-xs font-mono font-bold tracking-wider text-blue-600 hover:text-blue-900 uppercase bg-[#e8f0ff] px-4 py-2 rounded-xl border border-blue-250 transition-colors"
        >
          <span>Xem tất cả sản phẩm</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Core Showcase list */}
      {likedProducts.length === 0 ? (
        <div className="text-center py-20 bg-white border border-dashed border-neutral-300 rounded-2xl max-w-lg mx-auto p-6 space-y-4">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <Heart className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-display font-semibold text-neutral-800">
              Danh sách trống rỗng
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
              Bạn chưa nhấn thả tim sản phẩm nào tại Yeng Corner cả. Hãy dạo quanh cửa hàng và tìm món đồ ưng ý nhé!
            </p>
          </div>
          <button
            onClick={() => setCurrentPage('shop')}
            className="px-6 py-2.5 bg-black hover:bg-neutral-800 text-white text-xs font-display font-medium rounded-xl transition-colors shadow-sm"
          >
            ĐI TỚI CỬA HÀNG
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {likedProducts.map((product) => (
            <div
              key={product.id}
              className="group bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md hover:border-neutral-300 transition-all duration-300"
            >
              {/* Product Thumbnail Banner */}
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
                <div className="absolute top-3 left-3 z-10">
                  <span className={`px-2.5 py-1 text-[10px] font-mono tracking-wider font-semibold rounded uppercase border ${getBadgeTagStyles(product.tag)}`}>
                    {product.tag}
                  </span>
                </div>
                {/* Save item Button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleWishlist(product.id);
                  }}
                  className="absolute top-3 right-3 p-2 rounded-full transition-colors shadow-sm bg-red-50 text-red-500"
                  title="Xóa khỏi danh sách yêu thích"
                >
                  <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                </button>
              </div>

              {/* Card specifications details */}
              <div className="p-5 flex flex-col flex-1 space-y-4">
                <div className="space-y-1">
                  <h3 
                    onClick={() => navigateToProduct(product.id)} 
                    className="text-sm font-semibold text-neutral-900 group-hover:text-black cursor-pointer leading-tight line-clamp-2 h-10 tracking-tight"
                  >
                    {product.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-mono tracking-wider bg-neutral-100 text-neutral-600 border border-neutral-200 px-1.5 py-0.5 rounded uppercase font-medium">
                      {product.category}
                    </span>
                    {product.artist && (
                      <span className="text-[10px] font-mono tracking-wider bg-blue-50 text-blue-700 border border-blue-250 px-1.5 py-0.5 rounded uppercase font-semibold">
                        {product.artist}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bullet Spec Highlights */}
                <div className="p-3 bg-neutral-50 rounded-lg text-[11px] text-neutral-600 min-h-[48px] flex flex-col justify-center space-y-0.5 leading-normal">
                  <div className="flex items-center gap-1">
                    <span>• Hạn order:</span>
                    <strong className="text-neutral-850 font-semibold">{product.orderDeadline || "Sẵn hàng"}</strong>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>• Phát hành:</span>
                    <strong className="text-neutral-850 font-semibold">{product.releaseDate || "Đã ra mắt"}</strong>
                  </div>
                </div>

                {/* Confirm pricing and quickly add to card */}
                <div className="pt-2 flex flex-col space-y-3 mt-auto">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-mono text-neutral-400 uppercase">GIÁ:</span>
                    <span className="text-lg font-mono font-bold text-black">
                      {product.price.toLocaleString('vi-VN')} <span className="text-xs font-sans">VND</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button 
                      onClick={() => navigateToProduct(product.id)}
                      className="py-2.5 px-3 border border-neutral-200 hover:border-black text-neutral-700 hover:text-black text-xs font-display font-medium rounded-lg text-center transition-colors shadow-sm"
                    >
                      CHI TIẾT
                    </button>
                    {(() => {
                      let hasAvailableVariant = true;
                      if (product.attribute1Name && product.variantMatrix && product.variantMatrix.length > 0) {
                        hasAvailableVariant = product.variantMatrix.some(v => v.stock === undefined || v.stock > 0);
                      } else if (product.variations && product.variations.length > 0) {
                        hasAvailableVariant = product.variations.some(v => v.stock === undefined || v.stock > 0);
                      }

                      const isSoldOut = 
                        product.status?.toLowerCase() === 'sold_out' || 
                        product.status?.toLowerCase() === 'sold out' || 
                        product.status === 'Hết hàng' ||
                        product.tag?.toLowerCase().trim() === 'sold_out' || 
                        product.tag?.toLowerCase().trim() === 'sold out' || 
                        product.tag?.toLowerCase().trim() === 'hết hàng' ||
                        (product.stock !== undefined && product.stock <= 0) ||
                        !hasAvailableVariant;

                      return (
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
                          className={`py-2.5 px-3 text-xs font-display font-medium rounded-lg flex items-center justify-center space-x-1.5 transition-colors shadow-sm ${
                            isSoldOut
                              ? "bg-neutral-100 border border-neutral-200 text-neutral-400 cursor-not-allowed"
                              : "bg-[#E8F0FE] hover:bg-[#D2E3FC] border border-[#E8F0FE] text-[#1A73E8]"
                          }`}
                        >
                          <ShoppingBag className={`w-3.5 h-3.5 ${isSoldOut ? "text-neutral-400" : "text-[#1A73E8]"}`} />
                          <span>{isSoldOut ? "HẾT HÀNG" : "MUA NGAY"}</span>
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getBadgeTagStyles(tag?: string) {
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
