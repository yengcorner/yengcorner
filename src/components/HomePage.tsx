            <button 
              onClick={() => setCurrentPage('rules')}
              className="px-6 py-3 sm:px-7 sm:py-3.5 bg-[#e8f0ff] border border-blue-300 text-blue-900 font-semibold rounded-xl hover:bg-white active:scale-95 transition-all text-sm uppercase"
            >
              CHÍNH SÁCH SHOP
            </button>
          </motion.div>
        </div>
      </section>

      {/* Category Filter section & Products Grid listing */}
      <section className="space-y-8">
        <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
          <div className="flex items-center space-x-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
            <h2 className="text-xl font-display font-semibold tracking-wider text-black uppercase">Khám phá sản phẩm</h2>
          </div>
        </div>

        {displayProducts.length === 0 ? (
          <div className="text-center py-16 bg-white border border-dashed border-neutral-200 rounded-2xl">
            <p className="text-sm text-neutral-500">Chưa có sản phẩm nào thuộc danh mục này.</p>
          </div>
        ) : (
          <div className="space-y-10">
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-100px" }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
              {displayProducts.map((product) => (
                <motion.div
                  key={product.id}
                  variants={itemVariants}
                  className="group bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md hover:border-neutral-300 transition-all duration-300"
                >
                  {/* Image Section */}
                  <div className="relative aspect-square overflow-hidden bg-neutral-100 cursor-pointer border-b border-neutral-100" onClick={() => navigateToProduct(product.id)}>
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    {/* Category tag */}
                    <div className="absolute top-3 left-3 z-10">
                      <span className={`px-2.5 py-1 text-[10px] font-mono tracking-wider font-semibold rounded uppercase border ${exportTagStyles(product.tag)}`}>
                        {product.tag}
                      </span>
                    </div>
                    {/* Heart button */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWishlist(product.id);
                      }}
                      className={`absolute top-3 right-3 p-2 rounded-full transition-colors shadow-sm ${
                        wishlist.includes(product.id)
                          ? 'bg-red-50 text-red-500'
                          : 'bg-white/80 hover:bg-white text-neutral-600 hover:text-red-500'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${wishlist.includes(product.id) ? 'fill-red-500 text-red-500' : ''}`} />
                    </button>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 flex flex-col flex-1 space-y-4">
                    <div className="space-y-1">
                      <h3 
                        onClick={() => navigateToProduct(product.id)} 
                        className="text-sm font-semibold text-neutral-900 group-hover:text-black cursor-pointer leading-tight line-clamp-2 h-10 tracking-tight"
                      >
                        {product.name}
                      </h3>
                      {product.artist && (
                        <p className="text-[11.5px] text-blue-600 font-sans line-clamp-1 font-semibold flex items-center gap-1">
                          <span>🎤</span> 
                          <span>{product.artist}</span>
                        </p>
                      )}
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

                    {/* Pricing and CTAs */}
                    <div className="pt-2 flex flex-col space-y-3 mt-auto">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs font-mono text-neutral-400 uppercase">GIÁ:</span>
                        <span className="text-lg font-mono font-bold text-black text-right">
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
                          const quickBuyVersion = getQuickBuyVersion(product);
                          const isSoldOut = quickBuyVersion === null;

                          return (
                            <button
                              onClick={() => addToCart(product, 1, quickBuyVersion ?? "")}
                              className={`py-2.5 px-3 text-xs font-display font-medium rounded-lg flex items-center justify-center space-x-1.5 transition-colors shadow-sm ${
                                isSoldOut
                                  ? "bg-neutral-100 border border-neutral-200 text-neutral-400 hover:bg-neutral-200"
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
                </motion.div>
              ))}
            </motion.div>
 
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
        )}
      </section>
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
