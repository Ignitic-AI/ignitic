import React from 'react';
import { ExternalLink, Star } from 'lucide-react';

export function AmazonProductResponse({ products }: { products: any[] }) {
    if (!products || products.length === 0) return null;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 object-contain" onClick={(e) => e.stopPropagation()}>
            {products.map((product: any, i: number) => (
                <a key={product.asin || i} href={product.url} target="_blank" rel="noopener noreferrer" className="flex flex-col bg-white dark:bg-zinc-800 rounded-xl border dark:border-zinc-700 p-3 hover:shadow-md transition-shadow group">
                    {product.imageUrl && <img src={product.imageUrl} alt={product.title} className="h-32 w-full object-contain mb-2 rounded" />}
                    <p className="text-sm font-medium line-clamp-2 group-hover:text-primary leading-tight text-slate-900 dark:text-slate-100">{product.title}</p>
                    <div className="mt-auto pt-2 flex items-center justify-between">
                        <span className="text-lg font-bold text-green-600">${product.price}</span>
                        {product.rating && <div className="flex items-center text-xs text-gray-500"><Star className="w-3 h-3 fill-yellow-400 text-yellow-400 mr-1" />{product.rating.split(' ')[0]}</div>}
                    </div>
                    <div className="text-[10px] text-blue-500 flex items-center mt-1">View on Amazon <ExternalLink className="w-2 h-2 ml-1" /></div>
                </a>
            ))}
        </div>
    );
}
