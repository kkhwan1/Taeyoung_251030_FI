'use client';

import React from 'react';

interface QuickDateSelectorProps {
  onDateRangeChange: (startDate: string, endDate: string) => void;
}

export function QuickDateSelector({ onDateRangeChange }: QuickDateSelectorProps) {
  const getDateRange = (type: 'today' | 'this_week' | 'this_month' | 'last_month') => {
    const today = new Date();
    let startDate = new Date();
    let endDate = new Date();

    switch (type) {
      case 'today':
        startDate = today;
        endDate = today;
        break;
      case 'this_week':
        startDate = new Date(today.setDate(today.getDate() - today.getDay()));
        endDate = new Date();
        break;
      case 'this_month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date();
        break;
      case 'last_month':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
    }

    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    };
  };

  return (
    <div className="flex gap-2">
      <button 
        onClick={() => {
          const { start, end } = getDateRange('today');
          onDateRangeChange(start, end);
        }} 
        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm transition-colors"
      >
        오늘
      </button>
      <button 
        onClick={() => {
          const { start, end } = getDateRange('this_week');
          onDateRangeChange(start, end);
        }} 
        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm transition-colors"
      >
        이번주
      </button>
      <button 
        onClick={() => {
          const { start, end } = getDateRange('this_month');
          onDateRangeChange(start, end);
        }} 
        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm transition-colors"
      >
        이번달
      </button>
      <button 
        onClick={() => {
          const { start, end } = getDateRange('last_month');
          onDateRangeChange(start, end);
        }} 
        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm transition-colors"
      >
        지난달
      </button>
    </div>
  );
}
