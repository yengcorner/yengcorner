export interface VariantMatrixItem {
  option1: string;
  option2?: string;
  price: number;
  pob?: string;
  stock?: number;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  image: string;
  tag?: string;
  info?: string;
  detailedDesc?: string;
  versions?: string[];
  artist?: string;
  // Thêm các trường này dưới dạng tùy chọn (có dấu ?) để nếu trống cũng không bị lỗi code
  weight?: string;
  orderDeadline?: string;
  releaseDate?: string;
  preorderGift?: string;
  images?: string[];
  variationName?: string;
  variations?: { name: string; price: number; description?: string; stock?: number }[];
  stock?: number;
  status?: string;
  hasInsurance?: boolean;
  
  // Multi-tier variants properties
  attribute1Name?: string;
  attribute1Options?: string[];
  attribute2Name?: string;
  attribute2Options?: string[];
  variantMatrix?: VariantMatrixItem[];
}

export interface CartItem {
  product: Product;
  quantity: number;
  version: string;
}

export interface OrderContact {
  email: string;
  snsLink: string;
}

export interface OrderShipping {
  receiverName: string;
  phone: string;
  address: string;
  method: string;
}

export interface OrderPayload {
  id: string;
  status: string; // e.g. "Chờ xác nhận", "Đang gom hàng", "Đã bay kho Hàn", "Đã về Sài Gòn", "Đã giao khách", etc.
  items: CartItem[];
  subtotal: number;
  contact: OrderContact;
  payment: {
    method: string;
    invoiceImage: string | null;
  };
  shipping: OrderShipping;
  note: string;
  timestamp: string;
  trackingCode?: string;
}

export interface Coupon {
  code: string;
  expiryDate: string;
  applicableProducts: string;
  maxUsage: number;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  usedCount: number;
}

