'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search } from 'lucide-react';

export default function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [query, setQuery] = useState(searchParams.get('search') || '');

  // Debounce the search input
  useEffect(() => {
    const handler = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (query.trim()) {
        params.set('search', query.trim());
      } else {
        params.delete('search');
      }
      
      // Prevent pushing if it hasn't actually changed
      const currentSearch = searchParams.get('search') || '';
      if (currentSearch !== query.trim()) {
        router.push(`${pathname}?${params.toString()}`);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [query, router, searchParams, pathname]);

  // Update input if URL changes externally
  useEffect(() => {
    setQuery(searchParams.get('search') || '');
  }, [searchParams]);

  return (
    <div className="search-bar" style={{ position: 'relative', flex: 1, maxWidth: '300px', marginLeft: '16px', marginRight: '16px' }}>
      <Search 
        size={16} 
        strokeWidth={1.5}
        style={{ 
          position: 'absolute', 
          left: '12px', 
          top: '50%', 
          transform: 'translateY(-50%)', 
          color: 'var(--text-muted)' 
        }} 
      />
      <input
        type="text"
        placeholder="Find places, stories..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="input"
        style={{ 
          paddingLeft: '36px', 
          borderRadius: 'var(--radius-full)', 
          height: '36px', 
          fontSize: '13px',
          background: 'var(--bg-glass-hover)',
          border: '1px solid var(--border-subtle)'
        }}
      />
    </div>
  );
}
