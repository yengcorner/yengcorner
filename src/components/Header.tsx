import React, { useState } from 'react';
import { ShoppingBag, ChevronRight, Menu, X, ArrowUpRight, ShieldCheck, HelpCircle, Heart } from 'lucide-react';
import { CartItem } from '../types';
// @ts-ignore
import yengLogo from '../assets/images/yeng_corner_logo_1782054975769.jpg';

interface HeaderProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
  cart: CartItem[];
  wishlist: number[];
}

export default function Header({ currentPage, setCurrentPage, cart, wishlist }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const cartCount = cart.reduce((acc, curr) => acc + curr.quantity, 0);
  const wishlistCount = wishlist.length;

  const navItems = [
    { id: 'home', label: 'HOME' },
    { id: 'shop', label: 'STORE' },
    { id: 'track-order', label: 'TRA CỨU' },
    { id: 'rules', label: 'RULES' },
    { id: 'about', label: 'ABOUT US' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-neutral-200">
      {/* Dynamic Marquee Alert Bar */}
      <div className="w-full bg-[#e8f0ff] text-blue-900 py-2 overflow-hidden border-b border-blue-200 select-none">
        <div className="flex whitespace-nowrap animate-marquee-slow text-xs font-mono font-bold tracking-widest uppercase">
          <span>
            ✦ WELCOME TO YENG CORNER • ORDER TẤT CẢ CÁC WEB HÀN QUỐC • VẬN CHUYỂN HÀN - VIỆT • NHẬN SĨ SỐ LƯỢNG LỚN ALBUM KPOP • HÀNG ORDER VỀ NHANH CHẬM TÙY THUỘC VÀO BÊN NGƯỜI BÁN • ĐỔI TIỀN PAYPAL USD &lt;-&gt; VND ✦&nbsp;
          </span>
          <span>
            ✦ WELCOME TO YENG CORNER • ORDER TẤT CẢ CÁC WEB HÀN QUỐC • VẬN CHUYỂN HÀN - VIỆT • NHẬN SĨ SỐ LƯỢNG LỚN ALBUM KPOP • HÀNG ORDER VỀ NHANH CHẬM TÙY THUỘC VÀO BÊN NGƯỜI BÁN • ĐỔI TIỀN PAYPAL USD &lt;-&gt; VND ✦&nbsp;
          </span>
        </div>
      </div>

      {/* Main Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand Logo */}
        <div 
          onClick={() => { setCurrentPage('home'); setMobileMenuOpen(false); }} 
          className="flex items-center space-x-2.5 cursor-pointer group"
        >
          <img 
            src={yengLogo} 
            alt="Yeng Corner Logo" 
            className="w-10 h-10 rounded-lg object-cover border border-[#b4cbf0] bg-[#e8f0ff] group-hover:scale-105 transition-transform duration-300"
            referrerPolicy="no-referrer"
          />
          <span className="font-display font-bold text-lg tracking-widest text-[#1e40af] self-center">YENG CORNER</span>
        </div>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center space-x-8">
          {navItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`relative py-1 text-sm tracking-wider font-display font-medium transition-colors hover:text-blue-700 ${
                  isActive ? 'text-blue-700 font-semibold' : 'text-neutral-500'
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute left-0 right-0 bottom-[-4px] h-[2px] bg-blue-600 rounded" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Actions Bar (Cart Icon, Quick Access) */}
        <div className="flex items-center space-x-3">
          {/* Wishlist Button */}
          <button
            onClick={() => { setCurrentPage('wishlist'); setMobileMenuOpen(false); }}
            className={`relative p-2.5 rounded-full border transition-all duration-300 flex items-center justify-center hover:bg-neutral-50 ${
              currentPage === 'wishlist' 
                ? 'bg-[#ffebee] text-red-700 border-red-300 hover:bg-[#ffcdd2]' 
                : 'bg-white text-neutral-800 border-neutral-200 hover:text-red-600'
            }`}
            aria-label="View Wishlist"
            title="Danh sách yêu thích"
          >
            <Heart className={`w-5 h-5 ${currentPage === 'wishlist' ? 'fill-red-600 text-red-600' : ''}`} />
            {wishlistCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold bg-red-600 text-white border border-white leading-none">
                {wishlistCount}
              </span>
            )}
          </button>

          {/* Cart Button */}
          <button
            onClick={() => { setCurrentPage('cart'); setMobileMenuOpen(false); }}
            className={`relative p-2.5 rounded-full border transition-all duration-300 flex items-center justify-center hover:bg-neutral-50 ${
              currentPage === 'cart' 
                ? 'bg-[#e8f0ff] text-blue-900 border-blue-400 hover:bg-[#d0e1fe]' 
                : 'bg-white text-neutral-800 border-neutral-200'
            }`}
            aria-label="View Shopping Cart"
          >
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && (
              <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold border ${exportCartBadgeStyles(currentPage)}`}>
                {cartCount}
              </span>
            )}
          </button>

          {/* Hamburger Menu Mobile */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2.5 rounded-full border border-neutral-200 text-neutral-800 hover:bg-neutral-50"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-neutral-200 bg-white/95 backdrop-blur px-4 pt-4 pb-6 space-y-4 absolute left-0 right-0 shadow-lg transition-transform duration-300">
          <div className="flex flex-col space-y-3">
            {navItems.map((item) => {
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentPage(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full py-3 px-4 rounded-lg text-left text-sm font-display tracking-wide transition-all ${
                    isActive 
                      ? 'bg-[#e8f0ff] text-blue-900 font-semibold shadow-sm border border-blue-200' 
                      : 'text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{item.label}</span>
                    <ChevronRight className="w-4 h-4 opacity-75" />
                  </div>
                </button>
              );
            })}

            <button
              onClick={() => {
                setCurrentPage('wishlist');
                setMobileMenuOpen(false);
              }}
              className={`w-full py-3 px-4 rounded-lg text-left text-sm font-display tracking-wide transition-all flex items-center justify-between ${
                currentPage === 'wishlist'
                  ? 'bg-red-50 text-red-900 font-semibold border border-red-200 shadow-sm'
                  : 'bg-neutral-50 text-neutral-800 border border-neutral-200 hover:bg-neutral-100 font-medium'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Heart className={`w-4 h-4 text-red-600 ${currentPage === 'wishlist' ? 'fill-red-600' : ''}`} />
                <span>SẢN PHẨM YÊU THÍCH</span>
              </div>
              <span className="font-mono bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-bold font-semibold">
                {wishlistCount} mục
              </span>
            </button>

            <button
              onClick={() => {
                setCurrentPage('cart');
                setMobileMenuOpen(false);
              }}
              className={`w-full py-3 px-4 rounded-lg text-left text-sm font-display tracking-wide transition-all flex items-center justify-between ${
                currentPage === 'cart'
                  ? 'bg-[#e8f0ff] text-blue-900 font-semibold border border-blue-200 shadow-sm'
                  : 'bg-neutral-50 text-neutral-800 border border-neutral-200 hover:bg-neutral-100 font-medium'
              }`}
            >
              <div className="flex items-center space-x-2">
                <ShoppingBag className="w-4 h-4" />
                <span>GIỎ HÀNG THỰC TẾ</span>
              </div>
              <span className="font-mono bg-neutral-200 text-neutral-900 px-2 py-0.5 rounded text-xs font-bold">
                {cartCount} sản phẩm
              </span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

// Support helper to export dynamic helper classes
function exportCartBadgeStyles(currentPage: string) {
  return currentPage === 'cart'
    ? 'bg-white text-blue-900 border-blue-200'
    : 'bg-[#e8f0ff] text-blue-900 border-blue-300';
}
