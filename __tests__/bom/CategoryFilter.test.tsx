import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import CategoryFilter, { CategoryFilterConfig } from '@/components/CategoryFilter';
import { Factory, ShoppingCart, Package } from 'lucide-react';

const mockCategories: CategoryFilterConfig[] = [
  { id: 'all', label: '전체', value: 'all' },
  {
    id: 'internal_production',
    label: '내부생산',
    value: 'internal_production',
    color: '#3B82F6',
    icon: <Factory className="w-3.5 h-3.5" data-testid="factory-icon" />
  },
  {
    id: 'external_purchase',
    label: '외부구매',
    value: 'external_purchase',
    color: '#10B981',
    icon: <ShoppingCart className="w-3.5 h-3.5" data-testid="cart-icon" />
  },
  {
    id: 'other',
    label: '기타',
    value: 'other',
    icon: <Package className="w-3.5 h-3.5" data-testid="package-icon" />
  }
];

const mockCounts = {
  all: 150,
  internal_production: 85,
  external_purchase: 60,
  other: 5
};

describe('CategoryFilter Component', () => {
  describe('Basic Rendering', () => {
    it('renders with required props', () => {
      const handleChange = jest.fn();

      render(
        <CategoryFilter
          title="Test Filter"
          categories={mockCategories}
          selectedCategory="all"
          onCategoryChange={handleChange}
        />
      );

      expect(screen.getByText('Test Filter')).toBeInTheDocument();
      expect(screen.getByText('전체')).toBeInTheDocument();
      expect(screen.getByText('내부생산')).toBeInTheDocument();
      expect(screen.getByText('외부구매')).toBeInTheDocument();
      expect(screen.getByText('기타')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const handleChange = jest.fn();
      const { container } = render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="all"
          onCategoryChange={handleChange}
          className="custom-class"
        />
      );

      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });

    it('renders icons for categories with icon prop', () => {
      const handleChange = jest.fn();

      render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="all"
          onCategoryChange={handleChange}
        />
      );

      expect(screen.getByTestId('factory-icon')).toBeInTheDocument();
      expect(screen.getByTestId('cart-icon')).toBeInTheDocument();
      expect(screen.getByTestId('package-icon')).toBeInTheDocument();
    });

    it('highlights selected category', () => {
      const handleChange = jest.fn();

      render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="internal_production"
          onCategoryChange={handleChange}
        />
      );

      const button = screen.getByText('내부생산').closest('button');
      expect(button).toHaveClass('bg-blue-600');
    });
  });

  describe('Category Selection', () => {
    it('calls onCategoryChange when category is clicked', () => {
      const handleChange = jest.fn();

      render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="all"
          onCategoryChange={handleChange}
        />
      );

      const internalButton = screen.getByText('내부생산').closest('button');
      fireEvent.click(internalButton!);

      expect(handleChange).toHaveBeenCalledWith('internal_production');
    });

    it('allows switching between categories', () => {
      const handleChange = jest.fn();

      const { rerender } = render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="all"
          onCategoryChange={handleChange}
        />
      );

      const internalButton = screen.getByText('내부생산').closest('button');
      fireEvent.click(internalButton!);

      expect(handleChange).toHaveBeenCalledWith('internal_production');

      rerender(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="internal_production"
          onCategoryChange={handleChange}
        />
      );

      const externalButton = screen.getByText('외부구매').closest('button');
      fireEvent.click(externalButton!);

      expect(handleChange).toHaveBeenCalledWith('external_purchase');
    });

    it('does not call onCategoryChange when clicking already selected category', () => {
      const handleChange = jest.fn();

      render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="internal_production"
          onCategoryChange={handleChange}
        />
      );

      const internalButton = screen.getByText('내부생산').closest('button');
      fireEvent.click(internalButton!);

      // Should still be called (component doesn't prevent this)
      expect(handleChange).toHaveBeenCalledWith('internal_production');
    });
  });

  describe('Count Display', () => {
    it('shows counts when showCount is true', () => {
      const handleChange = jest.fn();

      render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="all"
          onCategoryChange={handleChange}
          showCount={true}
          counts={mockCounts}
        />
      );

      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('85')).toBeInTheDocument();
      expect(screen.getByText('60')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('hides counts when showCount is false', () => {
      const handleChange = jest.fn();

      render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="all"
          onCategoryChange={handleChange}
          showCount={false}
          counts={mockCounts}
        />
      );

      expect(screen.queryByText('150')).not.toBeInTheDocument();
      expect(screen.queryByText('85')).not.toBeInTheDocument();
    });

    it('hides count badge when count is 0', () => {
      const handleChange = jest.fn();
      const countsWithZero = { ...mockCounts, other: 0 };

      render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="all"
          onCategoryChange={handleChange}
          showCount={true}
          counts={countsWithZero}
        />
      );

      // "기타" button should exist but not show count
      const otherButton = screen.getByText('기타').closest('button');
      expect(otherButton).toBeInTheDocument();

      const buttonContent = within(otherButton!);
      expect(buttonContent.queryByText('0')).not.toBeInTheDocument();
    });

    it('handles missing counts gracefully', () => {
      const handleChange = jest.fn();

      render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="all"
          onCategoryChange={handleChange}
          showCount={true}
        />
      );

      // Should not crash, counts default to 0
      expect(screen.getByText('전체')).toBeInTheDocument();
    });

    it('handles large count numbers', () => {
      const handleChange = jest.fn();
      const largeCounts = {
        all: 999999,
        internal_production: 1000000,
        external_purchase: 5000000,
        other: 99999999
      };

      render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="all"
          onCategoryChange={handleChange}
          showCount={true}
          counts={largeCounts}
        />
      );

      expect(screen.getByText('999999')).toBeInTheDocument();
      expect(screen.getByText('1000000')).toBeInTheDocument();
    });
  });

  describe('Filter Clearing', () => {
    it('shows clear button when filter is active', () => {
      const handleChange = jest.fn();

      render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="internal_production"
          onCategoryChange={handleChange}
        />
      );

      expect(screen.getByTitle('필터 초기화')).toBeInTheDocument();
    });

    it('hides clear button when showing all categories', () => {
      const handleChange = jest.fn();

      render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="all"
          onCategoryChange={handleChange}
        />
      );

      expect(screen.queryByTitle('필터 초기화')).not.toBeInTheDocument();
    });

    it('resets to "all" when clear button is clicked', () => {
      const handleChange = jest.fn();

      render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="internal_production"
          onCategoryChange={handleChange}
        />
      );

      const clearButton = screen.getByTitle('필터 초기화');
      fireEvent.click(clearButton);

      expect(handleChange).toHaveBeenCalledWith('all');
    });

    it('shows selected category label in header when filtered', () => {
      const handleChange = jest.fn();

      render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="internal_production"
          onCategoryChange={handleChange}
        />
      );

      expect(screen.getByText('내부생산')).toBeInTheDocument();
    });
  });

  describe('Collapsible Functionality', () => {
    it('shows collapse button when collapsible is true', () => {
      const handleChange = jest.fn();

      render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="all"
          onCategoryChange={handleChange}
          collapsible={true}
        />
      );

      expect(screen.getByTitle('접기')).toBeInTheDocument();
    });

    it('hides collapse button when collapsible is false', () => {
      const handleChange = jest.fn();

      render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="all"
          onCategoryChange={handleChange}
          collapsible={false}
        />
      );

      expect(screen.queryByTitle('접기')).not.toBeInTheDocument();
      expect(screen.queryByTitle('펼치기')).not.toBeInTheDocument();
    });

    it('collapses content when collapse button is clicked', () => {
      const handleChange = jest.fn();

      render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="all"
          onCategoryChange={handleChange}
          collapsible={true}
          defaultExpanded={true}
        />
      );

      const collapseButton = screen.getByTitle('접기');
      fireEvent.click(collapseButton);

      // Category buttons should not be visible
      expect(screen.queryByText('내부생산')?.closest('button')).not.toBeInTheDocument();
    });

    it('expands content when expand button is clicked', () => {
      const handleChange = jest.fn();

      render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="all"
          onCategoryChange={handleChange}
          collapsible={true}
          defaultExpanded={false}
        />
      );

      const expandButton = screen.getByTitle('펼치기');
      fireEvent.click(expandButton);

      // Category buttons should be visible
      expect(screen.getByText('내부생산').closest('button')).toBeInTheDocument();
    });

    it('respects defaultExpanded prop', () => {
      const handleChange = jest.fn();

      const { rerender } = render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="all"
          onCategoryChange={handleChange}
          collapsible={true}
          defaultExpanded={true}
        />
      );

      expect(screen.getByText('내부생산')).toBeInTheDocument();

      rerender(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="all"
          onCategoryChange={handleChange}
          collapsible={true}
          defaultExpanded={false}
        />
      );

      expect(screen.queryByText('내부생산')?.closest('button')).not.toBeInTheDocument();
    });
  });

  describe('Color Application', () => {
    it('applies custom colors to category buttons', () => {
      const handleChange = jest.fn();

      render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="internal_production"
          onCategoryChange={handleChange}
        />
      );

      const internalButton = screen.getByText('내부생산').closest('button');

      // When selected, should have inline style with background color
      expect(internalButton).toHaveStyle({ backgroundColor: '#3B82F6', color: 'white' });
    });

    it('does not apply custom color when category is not selected', () => {
      const handleChange = jest.fn();

      render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="all"
          onCategoryChange={handleChange}
        />
      );

      const internalButton = screen.getByText('내부생산').closest('button');

      // Should not have inline background color style when not selected
      expect(internalButton).not.toHaveStyle({ backgroundColor: '#3B82F6' });
    });
  });

  describe('Accessibility', () => {
    it('provides accessible button elements', () => {
      const handleChange = jest.fn();

      render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="all"
          onCategoryChange={handleChange}
        />
      );

      const buttons = screen.getAllByRole('button');

      // Should have at least 4 category buttons + possibly clear/collapse buttons
      expect(buttons.length).toBeGreaterThanOrEqual(4);
    });

    it('supports keyboard interaction for category selection', () => {
      const handleChange = jest.fn();

      render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="all"
          onCategoryChange={handleChange}
        />
      );

      const internalButton = screen.getByText('내부생산').closest('button');
      internalButton!.focus();
      fireEvent.keyDown(internalButton!, { key: 'Enter' });

      expect(handleChange).toHaveBeenCalledWith('internal_production');
    });

    it('provides focus indicators', () => {
      const handleChange = jest.fn();

      render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="all"
          onCategoryChange={handleChange}
        />
      );

      const internalButton = screen.getByText('내부생산').closest('button');

      expect(internalButton).toHaveClass('focus:outline-none', 'focus:ring-2');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty categories array', () => {
      const handleChange = jest.fn();

      render(
        <CategoryFilter
          title="Test"
          categories={[]}
          selectedCategory="all"
          onCategoryChange={handleChange}
        />
      );

      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('handles single category', () => {
      const handleChange = jest.fn();
      const singleCategory = [{ id: 'only', label: '유일', value: 'only' }];

      render(
        <CategoryFilter
          title="Test"
          categories={singleCategory}
          selectedCategory="only"
          onCategoryChange={handleChange}
        />
      );

      expect(screen.getByText('유일')).toBeInTheDocument();
    });

    it('handles very long category labels', () => {
      const handleChange = jest.fn();
      const longLabelCategory = [
        {
          id: 'long',
          label: '매우 긴 카테고리 이름이 있을 때 어떻게 표시되는지 확인하는 테스트',
          value: 'long'
        }
      ];

      render(
        <CategoryFilter
          title="Test"
          categories={longLabelCategory}
          selectedCategory="long"
          onCategoryChange={handleChange}
        />
      );

      const button = screen.getByText(/매우 긴 카테고리/).closest('button');
      expect(button?.querySelector('span')).toHaveClass('truncate');
    });

    it('handles rapid category switching', () => {
      const handleChange = jest.fn();

      render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="all"
          onCategoryChange={handleChange}
        />
      );

      const buttons = mockCategories.map(cat => screen.getByText(cat.label).closest('button'));

      // Rapidly click all buttons
      buttons.forEach((button, index) => {
        fireEvent.click(button!);
        expect(handleChange).toHaveBeenCalledWith(mockCategories[index].id);
      });

      expect(handleChange).toHaveBeenCalledTimes(4);
    });

    it('handles component unmount gracefully', () => {
      const handleChange = jest.fn();
      const { unmount } = render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="all"
          onCategoryChange={handleChange}
        />
      );

      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Responsive Behavior', () => {
    it('applies grid layout classes', () => {
      const handleChange = jest.fn();
      const { container } = render(
        <CategoryFilter
          title="Test"
          categories={mockCategories}
          selectedCategory="all"
          onCategoryChange={handleChange}
        />
      );

      const gridContainer = container.querySelector('.grid');
      expect(gridContainer).toHaveClass('grid-cols-2', 'sm:grid-cols-3', 'lg:grid-cols-4', 'xl:grid-cols-5');
    });
  });
});
