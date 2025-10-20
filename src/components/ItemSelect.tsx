'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Package, Loader2, AlertCircle } from 'lucide-react';
import { ItemForComponent as Item } from '@/types/inventory';
import type { ItemTypeCode } from '@/types/supabase';

export interface ItemSelectProps {
  value?: number;
  onChange: (item: Item | null) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  className?: string;
  showPrice?: boolean;
  itemType?: 'ALL' | ItemTypeCode;
}

interface ApiSuccessResponse {
  success: true;
  data: {
    items: Item[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    };
  };
}

interface ApiErrorResponse {
  success: false;
  error?: string;
}

type ApiResponse = ApiSuccessResponse | ApiErrorResponse;

export default function ItemSelect({
  value,
  onChange,
  placeholder = "품번 또는 품명으로 검색...",
  label = "품목",
  required = false,
  error,
  disabled = false,
  className = "",
  showPrice = true,
  itemType = 'ALL'
}: ItemSelectProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch items from API
  useEffect(() => {
    fetchItems();
  }, [itemType]);

  // Handle search filtering
  useEffect(() => {
    if (search.trim()) {
      const filtered = items.filter(item =>
        item.item_code.toLowerCase().includes(search.toLowerCase()) ||
        item.item_name.toLowerCase().includes(search.toLowerCase())
      );
      setFilteredItems(filtered.slice(0, 10)); // Limit to 10 results for performance
      setIsOpen(true);
    } else {
      setFilteredItems([]);
      setIsOpen(false);
    }
  }, [search, items]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update search when value changes externally
  useEffect(() => {
    if (value && items.length > 0) {
      const item = items.find(item => item.item_id === value);
      if (item) {
        setSelectedItem(item);
        setSearch(`${item.item_code} - ${item.item_name}`);
      }
    } else if (!value) {
      setSelectedItem(null);
      setSearch('');
    }
  }, [value, items]);

  const fetchItems = async () => {
    setLoading(true);
    setLoadError('');

    try {
      let url = '/api/items';
      if (itemType !== 'ALL') {
        url += `?type=${itemType}`;
      }

      const response = await fetch(url);
      const data: ApiResponse = await response.json();

      if (data.success && data.data && data.data.items) {
        // Transform data to match ItemForComponent interface
        const transformedItems: Item[] = data.data.items.map(item => ({
          ...item,
          item_id: item.item_id || item.id,
          item_name: item.item_name || item.name,
          unit_price: item.unit_price || 0
        }));

        setItems(transformedItems);
      } else {
        throw new Error(data.error || '품목 목록을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to fetch items:', error);
      setLoadError(error instanceof Error ? error.message : '품목 목록을 불러오는데 실패했습니다.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearch = e.target.value;
    setSearch(newSearch);

    // Clear selection if search is cleared
    if (!newSearch) {
      setSelectedItem(null);
      onChange(null);
    }
  };

  const handleItemSelect = (item: Item) => {
    setSelectedItem(item);
    setSearch(`${item.item_code} - ${item.item_name}`);
    setIsOpen(false);
    onChange(item);
  };

  const handleInputFocus = () => {
    if (search && filteredItems.length > 0) {
      setIsOpen(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown' && filteredItems.length > 0) {
      e.preventDefault();
      setIsOpen(true);
    } else if (e.key === 'Enter' && isOpen && filteredItems.length === 1) {
      e.preventDefault();
      handleItemSelect(filteredItems[0]);
    }
  };

  const handleRefresh = () => {
    fetchItems();
  };

  return (
    <div className={`relative ${className}`}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <Package className="w-4 h-4 inline mr-2" />
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Search Input */}
      <div className="relative" ref={dropdownRef}>
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={handleSearchChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || loading}
          className={`w-full px-4 py-2 pl-10 pr-10 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
            error ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
          }`}
        />

        {/* Search Icon */}
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />

        {/* Loading/Refresh Button */}
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed"
          title="품목 목록 새로고침"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Package className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Error Message */}
      {(error || loadError) && (
        <div className="mt-1 flex items-center gap-1 text-sm text-red-500">
          <AlertCircle className="w-3 h-3" />
          <span>{error || loadError}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && !items.length && (
        <div className="mt-2 text-sm text-gray-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          품목 목록을 불러오는 중...
        </div>
      )}

      {/* Dropdown */}
      {isOpen && filteredItems.length > 0 && !disabled && (
        <div className="absolute z-[9999] w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredItems.map(item => (
            <button
              key={item.item_id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleItemSelect(item);
              }}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600 last:border-b-0 focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {item.item_code}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {item.item_name}
                  </div>
                </div>
                <div className="text-right ml-2 flex-shrink-0">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {item.unit}
                  </div>
                  {showPrice && (
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      ₩{item.unit_price?.toLocaleString() || 0}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No Results */}
      {isOpen && search && filteredItems.length === 0 && !loading && (
        <div className="absolute z-[9999] w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg">
          <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
            검색 결과가 없습니다.
          </div>
        </div>
      )}

      {/* Selected Item Info */}
      {selectedItem && !isOpen && (
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          선택된 품목: {selectedItem.item_code} - {selectedItem.item_name}
          {showPrice && ` (₩${selectedItem.unit_price?.toLocaleString() || 0})`}
        </div>
      )}
    </div>
  );
}