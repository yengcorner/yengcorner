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

interface ParsedRoute {
  page: string;
  productId: number | null;
  productSlug: string | null;
}

const parseRouteFromLocation = (): ParsedRoute => {
  if (typeof window === 'undefined') {
    return { page: 'home', productId: null, productSlug: null };
  }

  const pathname = window.location.pathname;
  const searchParams = new URLSearchParams(window.location.search);
  const prodIdParam = searchParams.get('id') || searchParams.get('productId');

  if (pathname === '/admin' || pathname === '/admin-yeng') {
    return { page: 'admin-yeng', productId: null, productSlug: null };
  }

  if (pathname.startsWith('/product')) {
    const raw = pathname.replace(/^\/product\/?/, '').replace(/\/+$/, '');
    if (raw) {
      const decoded = decodeURIComponent(raw).trim();
      const numId = parseInt(decoded, 10);
      if (!isNaN(numId) && String(numId) === decoded) {
        return { page: 'product-detail', productId: numId, productSlug: null };
      }
      return { page: 'product-detail', productId: null, productSlug: decoded };
    }
    return { page: 'shop', productId: null, productSlug: null };
  }

  if (prodIdParam) {
    const decoded = decodeURIComponent(prodIdParam).trim();
    const numId = parseInt(decoded, 10);
    if (!isNaN(numId) && String(numId) === decoded) {
      return { page: 'product-detail', productId: numId, productSlug: null };
    }
    return { page: 'product-detail', productId: null, productSlug: decoded };
  }

  if (pathname === '/shop') return { page: 'shop', productId: null, productSlug: null };
  if (pathname === '/wishlist') return { page: 'wishlist', productId: null, productSlug: null };
  if (pathname === '/cart') return { page: 'cart', productId: null, productSlug: null };
  if (pathname === '/checkout') return { page: 'checkout', productId: null, productSlug: null };
  if (pathname === '/rules') return { page: 'rules', productId: null, productSlug: null };
  if (pathname === '/about') return { page: 'about', productId: null, productSlug: null };
  if (pathname === '/track-order') return { page: 'track-order', productId: null, productSlug: null };

  return { page: 'home', productId: null, productSlug: null };
};

export default function App() {
  const initialRoute = parseRouteFromLocation();
  const [currentPage, setCurrentPage] = useState<string>(initialRoute.page);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(initialRoute.productId);
  const [selectedProductSlug, setSelectedProductSlug] = useState<string | null>(initialRoute.productSlug);
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

  // Real-time synchronization of cart items and product route resolution with latest Firestore products
  useEffect(() => {
    fetchProductsFromServer().catch(err => console.warn("Failed to fetch fresh products:", err));

    const unsubscribe = subscribeProducts((latestProducts) => {
      if (!latestProducts || latestProducts.length === 0) return;

      // If on product-detail and waiting for slug resolution to a concrete product
      if (selectedProductSlug && selectedProductId === null) {
        const match = latestProducts.find(
          (p) => convertToSlug(p.name) === selectedProductSlug || String(p.id) === selectedProductSlug
        );
        if (match) {
          setSelectedProductId(match.id);
        }
      }

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
  }, [selectedProductSlug, selectedProductId]);

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
    const route = parseRouteFromLocation();
    setCurrentPage(route.page);
    setSelectedProductId(route.productId);
    setSelectedProductSlug(route.productSlug);

    // If slug is provided and products already exist in cache, map numeric ID
    if (route.page === 'product-detail' && route.productSlug && route.productId === null) {
      const list = getProducts();
      const match = list.find(
        (p) => convertToSlug(p.name) === route.productSlug || String(p.id) === route.productSlug
      );
      if (match) {
        setSelectedProductId(match.id);
      }
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
      } else if (currentPage === 'product-detail') {
        if (selectedProductId !== null) {
          const productsList = getProducts();
          const currentProd = productsList.find((p) => Number(p.id) === Number(selectedProductId));
          if (currentProd) {
            return `/product/${convertToSlug(currentProd.name)}`;
          }
          if (selectedProductSlug) {
            return `/product/${selectedProductSlug}`;
          }
          return `/product/${selectedProductId}`;
        }
        if (selectedProductSlug) {
          return `/product/${selectedProductSlug}`;
        }
        return window.location.pathname.startsWith('/product') ? window.location.pathname : '/shop';
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
  }, [currentPage, selectedProductId, selectedProductSlug]);

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

  const navigateToProduct = (id: number, slug?: string) => {
    setSelectedProductId(id);
    if (slug) {
      setSelectedProductSlug(slug);
    } else {
      const p = getProducts().find((item) => Number(item.id) === Number(id));
      setSelectedProductSlug(p ? convertToSlug(p.name) : null);
    }
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
              slug={selectedProductSlug}
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
