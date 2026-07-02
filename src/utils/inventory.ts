import { Product, VariantMatrixItem } from '../types';

const SOLD_OUT_VALUES = new Set(['sold_out', 'sold out', 'het hang', 'hết hàng']);

function normalizeValue(value?: string) {
  return value?.trim().toLowerCase() || '';
}

export function isSoldOutStatus(value?: string) {
  return SOLD_OUT_VALUES.has(normalizeValue(value));
}

export function hasStock(stock?: number | null) {
  return stock === undefined || stock === null || Number(stock) > 0;
}

function isProductMarkedSoldOut(product: Product) {
  return (
    isSoldOutStatus(product.status) ||
    isSoldOutStatus(product.tag) ||
    (product.stock !== undefined && Number(product.stock) <= 0)
  );
}

function getMatrixVersion(item: VariantMatrixItem) {
  return item.option2 ? `${item.option1} - ${item.option2}` : item.option1;
}

export function getQuickBuyVersion(product: Product): string | null {
  if (Array.isArray(product.variantMatrix) && product.variantMatrix.length > 0) {
    const availableVariant = product.variantMatrix.find((item) => item && hasStock(item.stock));
    return availableVariant ? getMatrixVersion(availableVariant) : null;
  }

  if (Array.isArray(product.variations) && product.variations.length > 0) {
    const availableVariation = product.variations.find((item) => item && hasStock(item.stock));
    return availableVariation ? availableVariation.name : null;
  }

  if (isProductMarkedSoldOut(product)) {
    return null;
  }

  if (Array.isArray(product.versions) && product.versions.length > 0) {
    return product.versions[0];
  }

  return '';
}

export function isVersionPurchasable(product: Product, version = '') {
  if (Array.isArray(product.variantMatrix) && product.variantMatrix.length > 0) {
    const matchedVariant = product.variantMatrix.find((item) => item && getMatrixVersion(item) === version);
    return Boolean(matchedVariant && hasStock(matchedVariant.stock));
  }

  if (Array.isArray(product.variations) && product.variations.length > 0) {
    const matchedVariation = product.variations.find((item) => item && item.name === version);
    return Boolean(matchedVariation && hasStock(matchedVariation.stock));
  }

  return !isProductMarkedSoldOut(product);
}
