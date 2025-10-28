interface RecentItem {
  item_id: number;
  item_code: string;
  item_name: string;
  usedAt: string;
}

export const recentItemsManager = {
  add: (type: 'parent' | 'child', item: Omit<RecentItem, 'usedAt'>) => {
    const key = `recentBomItems_${type}`;
    const existing = localStorage.getItem(key);
    let items: RecentItem[] = existing ? JSON.parse(existing) : [];
    
    // 중복 제거
    items = items.filter(i => i.item_id !== item.item_id);
    
    // 최신 항목 추가
    items.unshift({
      ...item,
      usedAt: new Date().toISOString()
    });
    
    // 최대 5개만 유지
    items = items.slice(0, 5);
    
    localStorage.setItem(key, JSON.stringify(items));
  },

  get: (type: 'parent' | 'child'): RecentItem[] => {
    const key = `recentBomItems_${type}`;
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : [];
  }
};
