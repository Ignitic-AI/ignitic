import dynamic from 'next/dynamic';
import { parseShopifyProducts } from './ShopifyProductResponse';

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
  'amazon_search': {
    component: dynamic(() => import('./AmazonProductResponse').then(mod => mod.AmazonProductResponse), {
        loading: () => <div className="text-xs text-slate-500 animate-pulse py-2">Loading products...</div>
    }),
    extractProps: (parsedObj: any) => {
        const products = Array.isArray(parsedObj) ? parsedObj : [];
        return { products };
    }
  },
  'get_zendesk_tickets': {
    component: dynamic(() => import('./ZendeskTicketResponse').then(mod => mod.ZendeskTicketResponse), {
        loading: () => <div className="text-xs text-slate-500 animate-pulse py-2">Loading ticket details...</div>
    }),
    extractProps: (parsedObj: any) => {
        return { tickets: parsedObj };
    }
  }
};

// Explicit exports for direct usage if needed
export { ShopifyProductResponse, parseShopifyProducts } from './ShopifyProductResponse';
export { AmazonProductResponse } from './AmazonProductResponse';
export { ZendeskTicketResponse } from './ZendeskTicketResponse';
