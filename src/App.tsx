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
import { getProducts, convertToSlug } from './utils/products';
import { isVersionPurchasable } from './utils/inventory';

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
