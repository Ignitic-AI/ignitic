import dynamic from 'next/dynamic';
import { parseShopifyProducts } from './ShopifyProductResponse';
import { parseShopifySingleProduct } from './ShopifySingleProductResponse';
import { parseShopifyCreatedProduct } from './ShopifyProductCreatedResponse';
import { parseAmazonProducts } from './AmazonProductResponse';
import { parseAlibabaSuppliers } from './AlibabaSupplierResponse';
import { parseAlibabaProducts } from './AlibabaProductResponse';
import { parseAliExpressProducts } from './AliExpressProductResponse';
import { parseShopifyScraperProducts } from './ShopifyScraperResponse';

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
  },
  'apify_amazon_search': {
    component: dynamic(() => import('./AmazonProductResponse').then(mod => mod.AmazonProductResponse), {
      loading: () => <div className="text-xs text-slate-500 animate-pulse py-2">Loading Amazon products...</div>
    }),
    parser: (rawResponse: any) => {
      const products = parseAmazonProducts(rawResponse);
      return { products };
    }
  },
  'apify_alibaba_supplier_search': {
    component: dynamic(() => import('./AlibabaSupplierResponse').then(mod => mod.AlibabaSupplierResponse), {
      loading: () => <div className="text-xs text-slate-500 animate-pulse py-2">Loading Alibaba suppliers...</div>
    }),
    parser: (rawResponse: any) => {
      const suppliers = parseAlibabaSuppliers(rawResponse);
      return { suppliers };
    }
  },
  'apify_alibaba_product_search': {
    component: dynamic(() => import('./AlibabaProductResponse').then(mod => mod.AlibabaProductResponse), {
      loading: () => <div className="text-xs text-slate-500 animate-pulse py-2">Loading Alibaba products...</div>
    }),
    parser: (rawResponse: any) => {
      const products = parseAlibabaProducts(rawResponse);
      return { products };
    }
  },
  'apify_aliexpress_search': {
    component: dynamic(() => import('./AliExpressProductResponse').then(mod => mod.AliExpressProductResponse), {
      loading: () => <div className="text-xs text-slate-500 animate-pulse py-2">Loading AliExpress products...</div>
    }),
    parser: (rawResponse: any) => {
      const products = parseAliExpressProducts(rawResponse);
      return { products };
    }
  },
  'shopify_product_scraper': {
    component: dynamic(() => import('./ShopifyScraperResponse').then(mod => mod.ShopifyScraperResponse), {
      loading: () => <div className="text-xs text-slate-500 animate-pulse py-2">Loading Shopify products...</div>
    }),
    parser: (rawResponse: any) => {
      const products = parseShopifyScraperProducts(rawResponse);
      return { products };
    }
  }
};

// Explicit exports for direct usage if needed
export { ShopifyProductResponse, parseShopifyProducts } from './ShopifyProductResponse';
export { ShopifySingleProductResponse, parseShopifySingleProduct } from './ShopifySingleProductResponse';
export { ShopifyProductCreatedResponse, parseShopifyCreatedProduct } from './ShopifyProductCreatedResponse';
export { AmazonProductResponse, parseAmazonProducts } from './AmazonProductResponse';
export { AlibabaSupplierResponse, parseAlibabaSuppliers } from './AlibabaSupplierResponse';
export { AlibabaProductResponse, parseAlibabaProducts } from './AlibabaProductResponse';
export { AliExpressProductResponse, parseAliExpressProducts } from './AliExpressProductResponse';
export { ShopifyScraperResponse, parseShopifyScraperProducts } from './ShopifyScraperResponse';
