import dynamic from 'next/dynamic';
import { parseShopifyProducts } from './ShopifyProductResponse';
import { parseShopifySingleProduct } from './ShopifySingleProductResponse';
import { parseShopifyCreatedProduct } from './ShopifyProductCreatedResponse';
import { parseAmazonProducts } from './AmazonProductResponse';
import { parseAlibabaSuppliers } from './AlibabaSupplierResponse';
import { parseAlibabaProducts } from './AlibabaProductResponse';
import { parseAliExpressProducts } from './AliExpressProductResponse';
import { parseShopifyScraperProducts } from './ShopifyScraperResponse';
import { parseHubSpotBatchCreate } from './HubSpotBatchCreateResponse';
import { parseFacebookPost } from './FacebookPostResponse';
import { parseFacebookCreatePost } from './FacebookCreatePostResponse';
import { parseFacebookPagePosts } from './FacebookPagePostsResponse';
import { parseInstagramProfile } from './InstagramProfileResponse';
import { parseInstagramMedia } from './InstagramMediaResponse';
import { parseDriveFolder } from './GoogleDriveFolderResponse';
import { parseDriveFile } from './GoogleDriveFileResponse';
import { parseDriveUpdate } from './GoogleDriveUpdateResponse';
import { parseDriveFiles } from './GoogleDriveListResponse';

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
  },
  'hubspot_crm_batch_create': {
    component: dynamic(() => import('./HubSpotBatchCreateResponse').then(mod => mod.HubSpotBatchCreateResponse), {
      loading: () => <div className="text-xs text-slate-500 animate-pulse py-2">Loading HubSpot contacts...</div>
    }),
    parser: (rawResponse: any) => {
      const results = parseHubSpotBatchCreate(rawResponse);
      return { results };
    }
  },
  'post_image': {
    component: dynamic(() => import('./FacebookPostResponse').then(mod => mod.FacebookPostResponse), {
      loading: () => <div className="text-xs text-slate-500 animate-pulse py-2">Publishing Facebook post...</div>
    }),
    parser: (rawResponse: any) => {
      const data = parseFacebookPost(rawResponse);
      return { data };
    }
  },
  'create_post': {
    component: dynamic(() => import('./FacebookCreatePostResponse').then(mod => mod.FacebookCreatePostResponse), {
      loading: () => <div className="text-xs text-slate-500 animate-pulse py-2">Creating Facebook post...</div>
    }),
    parser: (rawResponse: any) => {
      const data = parseFacebookCreatePost(rawResponse);
      return { data };
    }
  },
  'get_page_posts': {
    component: dynamic(() => import('./FacebookPagePostsResponse').then(mod => mod.FacebookPagePostsResponse), {
      loading: () => <div className="text-xs text-slate-500 animate-pulse py-2">Loading page posts...</div>
    }),
    parser: (rawResponse: any) => {
      const posts = parseFacebookPagePosts(rawResponse);
      return { posts };
    }
  },
  'get_profile_info': {
    component: dynamic(() => import('./InstagramProfileResponse').then(mod => mod.InstagramProfileResponse), {
      loading: () => <div className="text-xs text-slate-500 animate-pulse py-2">Loading Instagram profile...</div>
    }),
    parser: (rawResponse: any) => {
      const data = parseInstagramProfile(rawResponse);
      return { data };
    }
  },
  'get_media_posts': {
    component: dynamic(() => import('./InstagramMediaResponse').then(mod => mod.InstagramMediaResponse), {
      loading: () => <div className="text-xs text-slate-500 animate-pulse py-2">Loading Instagram media posts...</div>
    }),
    parser: (rawResponse: any) => {
      const posts = parseInstagramMedia(rawResponse);
      return { posts };
    }
  },
  'create_folder': {
    component: dynamic(() => import('./GoogleDriveFolderResponse').then(mod => mod.GoogleDriveFolderResponse), {
      loading: () => <div className="text-xs text-slate-500 animate-pulse py-2">Creating Google Drive folder...</div>
    }),
    parser: (rawResponse: any) => {
      const data = parseDriveFolder(rawResponse);
      return { data };
    }
  },
  'create_text_file': {
    component: dynamic(() => import('./GoogleDriveFileResponse').then(mod => mod.GoogleDriveFileResponse), {
      loading: () => <div className="text-xs text-slate-500 animate-pulse py-2">Creating Google Drive file...</div>
    }),
    parser: (rawResponse: any) => {
      const data = parseDriveFile(rawResponse);
      return { data };
    }
  },
  'update_file_content': {
    component: dynamic(() => import('./GoogleDriveUpdateResponse').then(mod => mod.GoogleDriveUpdateResponse), {
      loading: () => <div className="text-xs text-slate-500 animate-pulse py-2">Updating Google Drive file...</div>
    }),
    parser: (rawResponse: any) => {
      const data = parseDriveUpdate(rawResponse);
      return { data };
    }
  },
  'list_files': {
    component: dynamic(() => import('./GoogleDriveListResponse').then(mod => mod.GoogleDriveListResponse), {
      loading: () => <div className="text-xs text-slate-500 animate-pulse py-2">Loading Google Drive files...</div>
    }),
    parser: (rawResponse: any) => {
      const files = parseDriveFiles(rawResponse);
      return { files };
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
export { HubSpotBatchCreateResponse, parseHubSpotBatchCreate } from './HubSpotBatchCreateResponse';
export { FacebookPostResponse, parseFacebookPost } from './FacebookPostResponse';
export { FacebookCreatePostResponse, parseFacebookCreatePost } from './FacebookCreatePostResponse';
export { FacebookPagePostsResponse, parseFacebookPagePosts } from './FacebookPagePostsResponse';
export { InstagramProfileResponse, parseInstagramProfile } from './InstagramProfileResponse';
export { InstagramMediaResponse, parseInstagramMedia } from './InstagramMediaResponse';
export { GoogleDriveFolderResponse, parseDriveFolder } from './GoogleDriveFolderResponse';
export { GoogleDriveFileResponse, parseDriveFile } from './GoogleDriveFileResponse';
export { GoogleDriveUpdateResponse, parseDriveUpdate } from './GoogleDriveUpdateResponse';
export { GoogleDriveListResponse, parseDriveFiles } from './GoogleDriveListResponse';
