      } else {
        return '/';
      }
    };

    const target = getTargetURL();
    if (window.location.pathname !== target) {
      window.history.pushState({}, '', target);
    }
  }, [currentPage, selectedProductId]);

  const addToCart = (product: Product, quantity = 1, version = "") => {
    setCart((prevCart) => {
      const existingIdx = prevCart.findIndex(
        (item) => item.product.id === product.id && item.version === version
      );
      if (existingIdx > -1) {
        const nextCart = [...prevCart];
        nextCart[existingIdx] = {
          ...nextCart[existingIdx],
          quantity: nextCart[existingIdx].quantity + quantity,
        };
        return nextCart;
      }
      return [...prevCart, { product, quantity, version }];
    });
    triggerToast("Đã thêm sản phẩm vào giỏ hàng thành công!");
  };

  const removeFromCart = (id: number, version: string) => {
    setCart((prevCart) => 
      prevCart.filter((item) => !(item.product.id === id && item.version === version))
    );
  };

  const updateCartQuantity = (id: number, version: string, newQty: number) => {
    if (newQty < 1) return;
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.product.id === id && item.version === version
          ? { ...item, quantity: newQty }
          : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const navigateToProduct = (id: number) => {
    setSelectedProductId(id);
    setCurrentPage('product-detail');
  };

  return (
    <div className="bg-[#fafafa] min-h-screen text-neutral-900 flex flex-col font-sans selection:bg-neutral-900 selection:text-white antialiased">
      {/* Premium Header with marquee strips */}
      <Header 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage} 
        cart={cart} 
        wishlist={wishlist}
      />

      {/* Main Core View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="animate-fade-in duration-300">
          {currentPage === 'home' && (
            <HomePage 
              navigateToProduct={navigateToProduct} 
              addToCart={addToCart} 
              setCurrentPage={setCurrentPage} 
              wishlist={wishlist}
              toggleWishlist={toggleWishlist}
            />
          )}

          {currentPage === 'shop' && (
            <ShopAllPage 
              navigateToProduct={navigateToProduct} 
              addToCart={addToCart} 
              wishlist={wishlist}
              toggleWishlist={toggleWishlist}
            />
          )}

          {currentPage === 'wishlist' && (
            <WishlistPage
              wishlist={wishlist}
              toggleWishlist={toggleWishlist}
              navigateToProduct={navigateToProduct}
              addToCart={addToCart}
              setCurrentPage={setCurrentPage}
            />
          )}

          {currentPage === 'product-detail' && (
            <ProductDetailPage 
              id={selectedProductId} 
              addToCart={addToCart} 
              setCurrentPage={setCurrentPage} 
            />
          )}

          {currentPage === 'cart' && (
            <CartPage 
              cart={cart} 
              removeFromCart={removeFromCart} 
              updateCartQuantity={updateCartQuantity} 
              setCurrentPage={setCurrentPage} 
              appliedCoupon={appliedCoupon}
              setAppliedCoupon={setAppliedCoupon}
            />
          )}

          {currentPage === 'checkout' && (
            <CheckoutPage 
              cart={cart} 
              setCurrentPage={setCurrentPage} 
              clearCart={clearCart} 
              appliedCoupon={appliedCoupon}
              setAppliedCoupon={setAppliedCoupon}
            />
          )}

          {currentPage === 'rules' && (
            <RulesPage rulesAnchor={rulesAnchor} setRulesAnchor={setRulesAnchor} />
          )}

          {currentPage === 'about' && (
            <AboutPage />
          )}

          {currentPage === 'track-order' && (
            <TrackOrderPage setCurrentPage={setCurrentPage} />
          )}

          {currentPage === 'admin-yeng' && (
            <AdminPage setCurrentPage={setCurrentPage} />
          )}
        </div>
      </main>

      {/* Footer benefits & navigation */}
      <Footer setCurrentPage={setCurrentPage} navigateToRulesSection={navigateToRulesSection} />

      {/* Floating Success Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-[9999] bg-white border border-neutral-250 text-neutral-950 px-5 py-3.5 rounded-xl shadow-2xl flex items-center space-x-3 max-w-xs font-sans animate-bounce">
          <div className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-550 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-neutral-900 tracking-wider uppercase">YENG CORNER</p>
            <p className="text-[11px] text-neutral-500 font-semibold">{toastMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}
