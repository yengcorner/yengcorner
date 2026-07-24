import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './components/HomePage';
import ShopAllPage from './components/ShopAllPage';
import ProductDetailPage from './components/ProductDetailPage';
import CartPage from './components/CartPage';
import CheckoutPage from './components/CheckoutPage';
import RulesPage from './components/RulesPage';
import AboutPage from './components/AboutPage';
import AdminPage from './components/AdminPage';
import WishlistPage from './components/WishlistPage';
import TrackOrderPage from './components/TrackOrderPage';
import { CartItem, Product, Coupon } from './types';
import { CheckCircle2 } from 'lucide-react';
import { getProducts, convertToSlug, getProductStockForVersion, isProductSoldOut, subscribeProducts, fetchProductsFromServer } from './utils/products';

export default function App() {
  const [currentPage, setCurrentPage] = useState<string>('home');
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [rulesAnchor, setRulesAnchor] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const navigateToRulesSection = (anchor: string) => {
    setRulesAnchor(anchor);
    setCurrentPage('rules');
  };
  
  // Persistent client-side cart storage
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('yeng_corner_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persistent client-side wishlist storage
  const [wishlist, setWishlist] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('yeng_corner_wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Keep state saved in case of page reload or review changes
  useEffect(() => {
    try {
      localStorage.setItem('yeng_corner_cart', JSON.stringify(cart));
    } catch (e) {
      console.warn("Storage exception logged:", e);
    }
  }, [cart]);

  // Real-time synchronization of cart items with latest Firestore product stock and status
  useEffect(() => {
    fetchProductsFromServer().catch(err => console.warn("Failed to fetch fresh products:", err));

    const unsubscribe = subscribeProducts((latestProducts) => {
      if (!latestProducts || latestProducts.length === 0) return;
      setCart((prevCart) => {
        let hasChanges = false;
        const updatedCart = prevCart.map((item) => {
          const freshP = latestProducts.find((p) => Number(p.id) === Number(item.product.id));
          if (freshP) {
            if (JSON.stringify(freshP) !== JSON.stringify(item.product)) {
              hasChanges = true;
              return { ...item, product: freshP };
            }
          }
          return item;
        });
        return hasChanges ? updatedCart : prevCart;
      });
    });

    return () => unsubscribe();
  }, []);

  // Keep state saved for wishlist
  useEffect(() => {
    try {
      localStorage.setItem('yeng_corner_wishlist', JSON.stringify(wishlist));
    } catch (e) {
      console.warn("Storage exception logged:", e);
    }
  }, [wishlist]);

  const toggleWishlist = (productId: number) => {
    setWishlist((prevWishlist) => {
      if (prevWishlist.includes(productId)) {
        return prevWishlist.filter((id) => id !== productId);
      } else {
        return [...prevWishlist, productId];
      }
    });
  };

  // Scroll to top upon transition page contexts
  useEffect(() => {
    if (currentPage === 'rules' && rulesAnchor) {
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage, rulesAnchor]);

  // Synchronize route from current URL
  const syncRouteFromURL = () => {
    const pathname = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    const prodIdParam = searchParams.get('id') || searchParams.get('productId');

    if (pathname === '/admin' || pathname === '/admin-yeng') {
      setCurrentPage('admin-yeng');
    } else if (pathname.startsWith('/product/')) {
      const parts = pathname.split('/');
      const slugOrId = parts[parts.length - 1];
      const id = parseInt(slugOrId, 10);
      if (!isNaN(id)) {
        setSelectedProductId(id);
        setCurrentPage('product-detail');
      } else {
        const productsList = getProducts();
        const foundProduct = productsList.find((p) => convertToSlug(p.name) === slugOrId);
        if (foundProduct) {
          setSelectedProductId(foundProduct.id);
          setCurrentPage('product-detail');
        } else {
          setCurrentPage('home');
        }
      }
    } else if (prodIdParam) {
      const id = parseInt(prodIdParam, 10);
      if (!isNaN(id)) {
        setSelectedProductId(id);
        setCurrentPage('product-detail');
      } else {
        const productsList = getProducts();
        const foundProduct = productsList.find((p) => convertToSlug(p.name) === prodIdParam);
        if (foundProduct) {
          setSelectedProductId(foundProduct.id);
          setCurrentPage('product-detail');
        } else {
          setCurrentPage('home');
        }
      }
    } else if (pathname === '/shop') {
      setCurrentPage('shop');
    } else if (pathname === '/wishlist') {
      setCurrentPage('wishlist');
    } else if (pathname === '/cart') {
      setCurrentPage('cart');
    } else if (pathname === '/checkout') {
      setCurrentPage('checkout');
    } else if (pathname === '/rules') {
      setCurrentPage('rules');
    } else if (pathname === '/about') {
      setCurrentPage('about');
    } else if (pathname === '/track-order') {
      setCurrentPage('track-order');
    } else {
      setCurrentPage('home');
    }
  };

  // Sync route on mount
  useEffect(() => {
    syncRouteFromURL();
  }, []);

  // Listen to popstate for back/forward navigation support
  useEffect(() => {
    window.addEventListener('popstate', syncRouteFromURL);
    return () => window.removeEventListener('popstate', syncRouteFromURL);
  }, []);

  // Listen to pageshow event to completely break bfcache (back-forward cache) on mobile devices (Safari/iOS)
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        window.location.reload();
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  // Sync URL gracefully when page state or selected product changes
  useEffect(() => {
    const getTargetURL = () => {
      if (currentPage === 'admin-yeng') {
        return '/admin';
      } else if (currentPage === 'product-detail' && selectedProductId !== null) {
        const productsList = getProducts();
        const currentProd = productsList.find((p) => p.id === selectedProductId);
        if (currentProd) {
          return `/product/${convertToSlug(currentProd.name)}`;
        }
        return `/product/${selectedProductId}`;
      } else if (currentPage === 'track-order') {
        return '/track-order';
      } else if (currentPage === 'shop') {
        return '/shop';
      } else if (currentPage === 'wishlist') {
        return '/wishlist';
      } else if (currentPage === 'cart') {
        return '/cart';
      } else if (currentPage === 'checkout') {
        return '/checkout';
      } else if (currentPage === 'rules') {
        return '/rules';
      } else if (currentPage === 'about') {
        return '/about';
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
    const freshProducts = getProducts();
    const freshProduct = freshProducts.find(p => p.id === product.id) || product;
    
    if (isProductSoldOut(freshProduct)) {
      alert("Sản phẩm này đã HẾT HÀNG, không thể thêm vào giỏ hàng!");
      return;
    }

    const availableStock = getProductStockForVersion(freshProduct, version);
    if (availableStock <= 0) {
      alert(`Phân loại "${version || 'Mặc định'}" của sản phẩm này đã hết hàng!`);
      return;
    }

    let isOverStock = false;
    let actualAdded = quantity;

    setCart((prevCart) => {
      const existingIdx = prevCart.findIndex(
        (item) => item.product.id === product.id && item.version === version
      );
      
      let existingQty = 0;
      if (existingIdx > -1) {
        existingQty = prevCart[existingIdx].quantity;
      }

      if (existingQty + quantity > availableStock) {
        isOverStock = true;
        actualAdded = Math.max(0, availableStock - existingQty);
        
        if (actualAdded <= 0) {
          return prevCart; // No changes possible
        }
        
        const nextCart = [...prevCart];
        if (existingIdx > -1) {
          nextCart[existingIdx] = {
            ...nextCart[existingIdx],
            quantity: availableStock,
          };
        } else {
          nextCart.push({ product: freshProduct, quantity: availableStock, version });
        }
        return nextCart;
      }

      if (existingIdx > -1) {
        const nextCart = [...prevCart];
        nextCart[existingIdx] = {
          ...nextCart[existingIdx],
          quantity: existingQty + quantity,
        };
        return nextCart;
      }
      return [...prevCart, { product: freshProduct, quantity, version }];
    });

    if (isOverStock) {
      alert(`Sản phẩm này chỉ còn tối đa ${availableStock} sản phẩm trong kho cho phân loại "${version || 'Mặc định'}"! Hệ thống đã tự động giới hạn số lượng trong giỏ hàng.`);
    } else {
      triggerToast("Đã thêm sản phẩm vào giỏ hàng thành công!");
    }
  };

  const removeFromCart = (id: number, version: string) => {
    setCart((prevCart) => 
      prevCart.filter((item) => !(item.product.id === id && item.version === version))
    );
  };

  const updateCartQuantity = (id: number, version: string, newQty: number) => {
    if (newQty < 1) return;

    const freshProducts = getProducts();
    const freshProduct = freshProducts.find(p => p.id === id);
    if (freshProduct) {
      const availableStock = getProductStockForVersion(freshProduct, version);
      if (newQty > availableStock) {
        alert(`Sản phẩm này chỉ còn tối đa ${availableStock} sản phẩm trong kho cho phân loại "${version || 'Mặc định'}"!`);
        newQty = availableStock;
      }
    }

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
