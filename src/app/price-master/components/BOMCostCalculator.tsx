'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Calculator,
  Loader2,
  ChevronDown,
  ChevronRight,
  Download,
  TreePine
} from 'lucide-react';
import type { 
  BOMCalculationRequest, 
  BOMCalculationResponse, 
  BOMItem 
} from '@/types/api/price-master';

interface Item {
  item_id: number;
  item_code: string;
  item_name: string;
  spec?: string;
  unit: string;
  category: string;
}

interface BOMCostCalculatorProps {
  onApplyPrice?: (price: number) => void;
}

export default function BOMCostCalculator({ onApplyPrice }: BOMCostCalculatorProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [effectiveDate, setEffectiveDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [includeLabor, setIncludeLabor] = useState(false);
  const [includeOverhead, setIncludeOverhead] = useState(false);
  const [loading, setLoading] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [calculationResult, setCalculationResult] = useState<BOMCalculationResponse['data'] | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Fetch items on mount
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await fetch('/api/items?is_active=true&limit=1000');
        const data = await response.json();

        if (data.success) {
          // API 응답 구조에 맞게 수정
          setItems(data.data.items || []);
        } else {
          console.error('Failed to fetch items:', data.error);
        }
      } catch (error) {
        console.error('Failed to fetch items:', error);
      } finally {
        setItemsLoading(false);
      }
    };

    fetchItems();
  }, []);

  const handleCalculate = async () => {
    if (!selectedItemId) return;

    setLoading(true);
    setCalculationResult(null);

    try {
      const requestData: BOMCalculationRequest = {
        item_id: selectedItemId,
        effective_date: effectiveDate,
        include_labor: includeLabor,
        include_overhead: includeOverhead
      };

      const response = await fetch('/api/price-master/calculate-from-bom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();

      if (result.success) {
        setCalculationResult(result.data);
        // Expand all nodes by default
        const allNodeIds = new Set<string>();
        const collectNodeIds = (node: BOMItem) => {
          allNodeIds.add(node.item_id);
          if (node.children) {
            node.children.forEach(collectNodeIds);
          }
        };
        collectNodeIds(result.data.bom_tree);
        setExpandedNodes(allNodeIds);
      } else {
        throw new Error(result.error || 'BOM 계산에 실패했습니다');
      }
    } catch (error: any) {
      console.error('BOM calculation error:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  const renderBOMTree = (node: BOMItem, level: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.item_id);
    const indentClass = `ml-${level * 4}`;

    return (
      <div key={node.item_id} className={`${indentClass} border-l-2 border-gray-200 pl-4 mb-2`}>
        <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
          {hasChildren && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleNode(node.item_id)}
              className="h-6 w-6 p-0"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
          {!hasChildren && <div className="w-6" />}

          <div className="flex-1 grid grid-cols-5 gap-4 text-sm">
            <div>
              <div className="font-medium">{node.item_code}</div>
              <div className="text-gray-600 text-xs">{node.item_name}</div>
            </div>
            <div className="text-center">
              <Badge variant="outline" className="text-xs">
                레벨 {node.level}
              </Badge>
            </div>
            <div className="text-center">
              {node.quantity}
            </div>
            <div className="text-right">
              {node.unit_price ? (
                <span className="font-medium">{formatCurrency(node.unit_price)}원</span>
              ) : (
                <span className="text-gray-600 text-xs flex items-center">
                  
                  가격 없음
                </span>
              )}
            </div>
            <div className="text-right">
              {node.subtotal_cost ? (
                <span className="font-semibold text-gray-600">
                  {formatCurrency(node.subtotal_cost)}원
                </span>
              ) : (
                <span className="text-gray-400">-</span>
              )}
            </div>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-2">
            {node.children!.map(child => renderBOMTree(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const exportToPDF = () => {
    // Simple PDF export using browser print
    const printWindow = window.open('', '_blank');
    if (printWindow && calculationResult) {
      const content = `
        <html>
          <head>
            <title>BOM 원가 계산서</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .summary { background: #f5f5f5; padding: 15px; margin-bottom: 20px; }
              .tree { margin-top: 20px; }
              .node { margin: 5px 0; padding: 5px; border-left: 2px solid #ccc; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>BOM 원가 계산서</h1>
              <p>품목: ${calculationResult.item_code} - ${calculationResult.item_name}</p>
              <p>계산일: ${calculationResult.calculation_date}</p>
            </div>
            <div class="summary">
              <h3>원가 요약</h3>
              <p>총 재료비: ${formatCurrency(calculationResult.total_material_cost)}원</p>
              <p>총 노무비: ${formatCurrency(calculationResult.total_labor_cost)}원</p>
              <p>총 간접비: ${formatCurrency(calculationResult.total_overhead_cost)}원</p>
              <p><strong>계산된 원가: ${formatCurrency(calculationResult.calculated_price)}원</strong></p>
            </div>
          </body>
        </html>
      `;
      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const selectedItem = items.find(item => item.item_id === parseInt(selectedItemId));

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calculator className="h-5 w-5" />
            <span>BOM 원가 계산</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Item Selection */}
            <div className="space-y-2">
              <Label htmlFor="item_id">
                품목 <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedItemId}
                onValueChange={setSelectedItemId}
                disabled={itemsLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={itemsLoading ? "품목 불러오는 중..." : "품목 선택"} />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.item_id} value={item.item_id.toString()}>
                      [{item.item_code}] {item.item_name} {item.spec && `(${item.spec})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedItem && (
                <p className="text-sm text-muted-foreground">
                  단위: {selectedItem.unit} | 분류: {selectedItem.category}
                </p>
              )}
            </div>

            {/* Effective Date */}
            <div className="space-y-2">
              <Label htmlFor="effective_date">기준일</Label>
              <Input
                id="effective_date"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <Label>계산 옵션</Label>
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include_labor"
                  checked={includeLabor}
                  onCheckedChange={(checked) => setIncludeLabor(checked as boolean)}
                />
                <Label htmlFor="include_labor" className="text-sm">
                  노무비 포함 (재료비의 10%)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include_overhead"
                  checked={includeOverhead}
                  onCheckedChange={(checked) => setIncludeOverhead(checked as boolean)}
                />
                <Label htmlFor="include_overhead" className="text-sm">
                  간접비 포함 (재료비의 5%)
                </Label>
              </div>
            </div>
          </div>

          {/* Calculate Button */}
          <Button
            onClick={handleCalculate}
            disabled={!selectedItemId || loading}
            className="w-full"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? '계산 중...' : '원가 계산'}
          </Button>
        </CardContent>
      </Card>

      {/* Results Section */}
      {calculationResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <TreePine className="h-5 w-5" />
                <span>계산 결과</span>
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToPDF}
                >
                  <Download className="h-4 w-4 mr-2" />
                  PDF 내보내기
                </Button>
                {onApplyPrice && (
                  <Button
                    size="sm"
                    onClick={() => onApplyPrice(calculationResult.calculated_price)}
                  >
                    
                    단가 마스터에 반영
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Cost Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-lg font-bold text-gray-600">
                  {formatCurrency(calculationResult.total_material_cost)}원
                </div>
                <div className="text-sm text-gray-600">총 재료비</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-lg font-bold text-gray-600">
                  {formatCurrency(calculationResult.total_labor_cost)}원
                </div>
                <div className="text-sm text-gray-600">총 노무비</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-lg font-bold text-gray-600">
                  {formatCurrency(calculationResult.total_overhead_cost)}원
                </div>
                <div className="text-sm text-gray-600">총 간접비</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-xl font-bold text-gray-600">
                  {formatCurrency(calculationResult.calculated_price)}원
                </div>
                <div className="text-sm text-gray-600">계산된 원가</div>
              </div>
            </div>

            {/* Missing Prices Alert */}
            {calculationResult.missing_prices.length > 0 && (
              <Alert variant="destructive">
                
                <AlertDescription>
                  <div className="space-y-1">
                    <p>다음 부품들의 가격 정보가 없습니다:</p>
                    <ul className="list-disc list-inside text-sm">
                      {calculationResult.missing_prices.map((item, index) => (
                        <li key={index}>
                          [{item.item_code}] {item.item_name} (레벨 {item.level})
                        </li>
                      ))}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* BOM Tree */}
            <div className="space-y-4">
              <h4 className="font-semibold">BOM 구조</h4>
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="grid grid-cols-5 gap-4 text-sm font-medium text-gray-600 mb-3 pb-2 border-b">
                  <div>품목</div>
                  <div className="text-center">레벨</div>
                  <div className="text-center">수량</div>
                  <div className="text-right">단가</div>
                  <div className="text-right">소계</div>
                </div>
                {renderBOMTree(calculationResult.bom_tree)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
