import React, { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, HelpCircle, Heart, ShoppingBag, Tag } from 'lucide-react';
import { Product } from '../types';
import { getProducts, subscribeProducts } from '../utils/products';

interface ShopAllPageProps {
  navigateToProduct: (id: number) => void;
  addToCart: (product: Product, quantity?: number, version?: string) => void;
  wishlist: number[];
  toggleWishlist: (id: number) => void;
}

export default function ShopAllPage({ 
  navigateToProduct, 
  addToCart, 
  wishlist, 
  toggleWishlist 
}: ShopAllPageProps) {
  // Filter out retired K-POP category
  const [productsList, setProductsList] = useState<Product[]>(() => 
    getProducts().filter(p => p.category.toLowerCase() !== 'k-pop')
  );

  useEffect(() => {
    const unsubscribe = subscribeProducts((list) => {
      setProductsList(list.filter(p => p.category.toLowerCase() !== 'k-pop'));
    });
    return unsubscribe;
  }, []);

  const [filter, setFilter] = useState('All');
  const [artistFilter, setArtistFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('default'); // default, price-asc, price-desc, name-asc

  // Dynamically extract active categories
  const dynamicCategories = Array.from(
    new Set(productsList.map(p => p.category).filter(Boolean))
  ) as string[];

  // Dynamically extract active artists/brands
  const dynamicArtists = Array.from(
    new Set(productsList.map(p => p.artist).filter(Boolean))
  ) as string[];

  // 1. Filter by category
  let products = filter === 'All' 
    ? productsList 
    : productsList.filter(p => p.category.toLowerCase() === filter.toLowerCase());

  // 1.5 Filter by artist / brand
  if (artistFilter !== 'All') {
    products = products.filter(p => p.artist && p.artist.toLowerCase() === artistFilter.toLowerCase());
  }

  // 2. Filter by search query
  if (searchQuery.trim().length > 0) {
    products = products.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.info.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // 3. Sort
  if (sortBy === 'price-asc') {
    products = [...products].sort((a, b) => a.price - b.price);
  } else if (sortBy === 'price-desc') {
    products = [...products].sort((a, b) => b.price - a.price);
  } else if (sortBy === 'name-asc') {
    products = [...products].sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="border-b border-neutral-200 pb-5">
        <h2 className="text-2xl font-display font-bold text-neutral-900 tracking-tight">DANH MỤC SẢN PHẨM</h2>
        <p className="text-sm text-neutral-500 mt-1">Khám phá và đặt mua các vật phẩm K-Pop chính hãng.</p>
      </div>

      {/* Control panel: Search, Sort dropdown */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-3 bg-white p-4 rounded-xl border border-neutral-200/80 shadow-sm">
        {/* Search bar */}
        <div className="relative flex-1 max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
            <Search className="w-5 h-5" />
          </div>
          <input 
            type="text"
            placeholder="Tìm kiếm sản phẩm (NCT, Aespa, Mũ, Áo...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg text-sm bg-neutral-50 placeholder-neutral-400 text-neutral-800 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
          />
        </div>

        {/* Filters/Sorting controls */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Category Filter */}
          <div className="flex items-center space-x-1.5 text-xs text-neutral-500 font-mono">
            <Tag className="w-4 h-4" />
            <span>LỌC:</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-xs font-semibold border border-neutral-300 rounded-lg py-2 px-3 focus:outline-none bg-neutral-50 focus:ring-1 focus:ring-blue-400 cursor-pointer text-neutral-850"
            >
              <option value="All">Tất cả danh mục</option>
              {dynamicCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Artist/Brand Filter */}
          <div className="flex items-center space-x-1.5 text-xs text-neutral-500 font-mono">
            <Tag className="w-4 h-4 text-neutral-400" />
            <span>ARTIST / BRAND:</span>
            <select
              value={artistFilter}
              onChange={(e) => setArtistFilter(e.target.value)}
              className="text-xs font-semibold border border-neutral-300 rounded-lg py-2 px-3 focus:outline-none bg-neutral-50 focus:ring-1 focus:ring-blue-400 cursor-pointer text-neutral-850"
            >
              <option value="All">Tất cả Artist/Brand</option>
              {dynamicArtists.map((art) => (
                <option key={art} value={art}>{art}</option>
              ))}
            </select>
          </div>

          {/* Sort & config selector */}
          <div className="flex items-center space-x-1.5 text-xs text-neutral-500 font-mono">
            <SlidersHorizontal className="w-4 h-4" />
            <span>SẮP XẾP:</span>
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs font-semibold border border-neutral-300 rounded-lg py-2 px-3 focus:outline-none bg-neutral-50 focus:ring-1 focus:ring-blue-400 cursor-pointer text-neutral-850"
            >
              <option value="default">Mặc định ban đầu</option>
              <option value="price-asc">Giá tăng dần (Thấp → Cao)</option>
              <option value="price-desc">Giá giảm dần (Cao → Thấp)</option>
              <option value="name-asc">Tên sản phẩm (A → Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid List Products */}
      {products.length === 0 ? (
        <div className="text-center py-20 bg-white border border-dashed border-neutral-300 rounded-2xl">
          <HelpCircle className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
          <h3 className="text-lg font-display font-medium text-neutral-800">Không tìm thấy sản phẩm</h3>
          <p className="text-sm text-neutral-500 mt-1">Xin lỗi, không có mặt hàng nào phù hợp với từ khóa tìm kiếm của bạn.</p>
          <button 
            onClick={() => { setFilter('All'); setArtistFilter('All'); setSearchQuery(''); setSortBy('default'); }}
            className="mt-4 px-5 py-2 bg-[#e8f0ff] text-blue-900 text-xs font-bold rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors"
          >
            Reset bộ lọc
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
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
                  className={`absolute top-3 right-3 p-2 rounded-full transition-colors shadow-sm ${
                    wishlist.includes(product.id)
                      ? 'bg-red-50 text-red-500'
                      : 'bg-white/80 hover:bg-white text-neutral-600 hover:text-red-500'
                  }`}
                  title="Thêm vào danh sách yêu thích"
                >
                  <Heart className={`w-4 h-4 ${wishlist.includes(product.id) ? 'fill-red-500 text-red-500' : ''}`} />
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
                    <button 
                      onClick={() => {
                        addToCart(product, 1, product.versions && product.versions.length > 0 ? product.versions[0] : "");
                      }}
                      className="py-2.5 px-3 bg-[#E8F0FE] hover:bg-[#D2E3FC] border border-[#E8F0FE] text-[#1A73E8] text-xs font-display font-medium rounded-lg flex items-center justify-center space-x-1.5 transition-colors shadow-sm"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-[#1A73E8]" />
                      <span>MUA NGAY</span>
                    </button>
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

function showInfoAlert(name: string) {
  alert(`🛒 Đã thêm thành công: "${name}" vào giỏ hàng!`);
}

function getBadgeTagStyles(tag: string) {
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
