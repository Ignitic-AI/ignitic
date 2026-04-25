import dynamic from 'next/dynamic';
import { parseShopifyProducts } from './ShopifyProductResponse';
import { parseShopifySingleProduct } from './ShopifySingleProductResponse';
import { parseShopifyCreatedProduct } from './ShopifyProductCreatedResponse';

export const ToolResponseRegistry: Record<string, { component: React.ComponentType<any>, parser?: (data: any) => any, extractProps?: (data: any) => any }> = {
  'get_products': {
    component: dynamic(() => import('./ShopifyProductResponse').then(mod => mod.ShopifyProductResponse), {
        loading: () => <div className="text-xs text-slate-500 animate-pulse py-2">Loading store items...</div>
    }),
    parser: (rawResponse: any) => {
        const products = parseShopifyProducts(rawResponse);
        return { products };
    }
  },
  'get_product_by_id': {
    component: dynamic(() => import('./ShopifySingleProductResponse').then(mod => mod.ShopifySingleProductResponse), {
      loading: () => <div className="text-xs text-slate-500 animate-pulse py-2">Loading product details...</div>
    }),
    parser: (rawResponse: any) => {
      const product = parseShopifySingleProduct(rawResponse);
      return { product };
    }
  },
  'create_product': {
    component: dynamic(() => import('./ShopifyProductCreatedResponse').then(mod => mod.ShopifyProductCreatedResponse), {
      loading: () => <div className="text-xs text-slate-500 animate-pulse py-2">Loading created product...</div>
    }),
    parser: (rawResponse: any) => {
      const product = parseShopifyCreatedProduct(rawResponse);
      return { product };
    }
  }
};

// Explicit exports for direct usage if needed
export { ShopifyProductResponse, parseShopifyProducts } from './ShopifyProductResponse';
export { ShopifySingleProductResponse, parseShopifySingleProduct } from './ShopifySingleProductResponse';
export { ShopifyProductCreatedResponse, parseShopifyCreatedProduct } from './ShopifyProductCreatedResponse';
