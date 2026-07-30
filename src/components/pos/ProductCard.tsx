import { useState } from 'react';
import { Milk, Package, Plus, Wheat } from 'lucide-react';
import type { ProductView } from '../../models/types';
import { cx, formatCurrency, normalizeText, productInitials } from '../../utils/helpers';
import { optimizedCatalogImageSrc } from '../../utils/images';

interface ProductCardProps {
  product: ProductView;
  cartQuantity?: number;
  onClick: () => void;
}

export function ProductCard({ product, cartQuantity = 0, onClick }: ProductCardProps) {
  const isLowStock = product.stock > 0 && product.stock <= product.minStock;
  const isOutOfStock = product.stock <= 0;
  const remainingStock = Math.max(0, product.stock - cartQuantity);

  return (
    <button
      onClick={onClick}
      disabled={isOutOfStock}
      aria-label={isOutOfStock ? `${product.name}, agotado` : `Agregar ${product.name} a la venta`}
      className="pos-product-card group animate-fadeIn text-left disabled:cursor-not-allowed disabled:opacity-55"
    >
      <div className="product-visual">
        <ProductVisual product={product} />
        {cartQuantity > 0 && <span className="product-cart-badge">{cartQuantity} en venta</span>}
        <span
          className={`product-stock ${
            isOutOfStock ? 'product-stock-out' : isLowStock ? 'product-stock-low' : ''
          }`}
        >
          {isOutOfStock ? 'Agotado' : `${remainingStock} disp.`}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-3">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <p className="truncate text-xs font-semibold text-primary">{product.category}</p>
          {cartQuantity > 0 && (
            <span className="shrink-0 text-[0.65rem] font-extrabold text-slate-500 dark:text-slate-400">
              x{cartQuantity}
            </span>
          )}
        </div>
        <h4 className="mt-1 line-clamp-2 min-h-10 text-sm font-bold leading-5 text-slate-950 dark:text-white">
          {product.name}
        </h4>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <p className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
            {formatCurrency(product.price)}
          </p>
          <span
            className={cx(
              'product-add-button',
              cartQuantity > 0 && remainingStock === 0 && 'product-add-button-max',
            )}
            aria-hidden="true"
          >
            <Plus size={16} />
          </span>
        </div>
      </div>
    </button>
  );
}

export function ProductVisual({
  product,
  compact = false,
}: {
  product: ProductView;
  compact?: boolean;
}) {
  const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null);
  const rawProductImage = product.imageUrl?.trim() || null;
  const imageFailed = rawProductImage ? failedImageSrc === rawProductImage : false;
  const productImage = rawProductImage ? optimizedCatalogImageSrc(rawProductImage) : null;

  if (productImage && !imageFailed) {
    return (
      <img
        key={productImage}
        src={productImage}
        alt=""
        className={`product-packshot h-full w-full object-contain ${compact ? 'p-1' : 'p-3'}`}
        loading="lazy"
        decoding="async"
        onError={(event) => {
          if (
            rawProductImage &&
            rawProductImage !== productImage &&
            event.currentTarget.dataset.fallback !== 'true'
          ) {
            event.currentTarget.dataset.fallback = 'true';
            event.currentTarget.src = rawProductImage;
            return;
          }

          setFailedImageSrc(rawProductImage);
        }}
      />
    );
  }

  const category = normalizeText(product.category);
  const icon = category.includes('lacteo') ? (
    <Milk size={compact ? 21 : 30} />
  ) : category.includes('pan') ? (
    <Wheat size={compact ? 21 : 30} />
  ) : (
    <Package size={compact ? 21 : 30} />
  );
  const placeholderClass = category.includes('lacteo')
    ? 'product-placeholder-lacteos'
    : category.includes('pan')
      ? 'product-placeholder-pan'
      : 'product-placeholder-general';

  return (
    <div
      className={`product-placeholder ${placeholderClass} relative flex h-full w-full items-center justify-center text-slate-500 dark:text-slate-300`}
    >
      <div
        className={`product-placeholder-pack ${compact ? 'product-placeholder-pack-compact' : ''}`}
      >
        {icon}
        {!compact && <span>{productInitials(product.name)}</span>}
      </div>
      {!compact && (
        <span className="product-placeholder-label absolute bottom-2 left-2">
          {product.category}
        </span>
      )}
    </div>
  );
}
