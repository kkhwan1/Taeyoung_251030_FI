'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToastNotification } from '@/hooks/useToast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Loader2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import BOMDeductionResults from './BOMDeductionResults';

const productionSchema = z.object({
  transaction_date: z.string().min(1, '거래일자를 선택해주세요'),
  item_id: z.string().min(1, '품목을 선택해주세요'),
  quantity: z.number().positive('수량은 0보다 커야 합니다'),
  unit_price: z.number().min(0, '단가는 0 이상이어야 합니다'),
  transaction_type: z.enum(['생산입고', '생산출고'], '거래유형을 선택해주세요'),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
  created_by: z.number().positive('작성자 ID가 필요합니다')
});

type ProductionFormData = z.infer<typeof productionSchema>;

interface Item {
  item_id: number;
  item_code: string;
  item_name: string;
  spec: string;
  unit: string;
  category: string;
}

interface BOMDeduction {
  log_id: number;
  child_item_id: number;
  item_code: string;
  item_name: string;
  unit: string;
  deducted_quantity: number;
  usage_rate: number;
  stock_before: number;
  stock_after: number;
}

interface ProductionEntryFormProps {
  onSuccess?: () => void;
}

export default function ProductionEntryForm({ onSuccess }: ProductionEntryFormProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [bomDeductions, setBomDeductions] = useState<BOMDeduction[]>([]);
  const [stockError, setStockError] = useState<string | null>(null);
  const toast = useToastNotification();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch
  } = useForm<ProductionFormData>({
    resolver: zodResolver(productionSchema),
    defaultValues: {
      transaction_date: new Date().toISOString().split('T')[0],
      transaction_type: '생산입고',
      created_by: 1 // admin user_id from users table
    }
  });

  const selectedItemId = watch('item_id');
  const quantity = watch('quantity');
  const unitPrice = watch('unit_price');
  const totalAmount = quantity && unitPrice ? quantity * unitPrice : 0;

  // Fetch items on mount
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await fetch('/api/items?is_active=true&limit=1000');
        const data = await response.json();

        if (data.success) {
          setItems(data.data.items || []);
        } else {
          toast.error('품목 조회 실패', data.error || '품목 목록을 불러올 수 없습니다');
        }
      } catch (error) {
        toast.error('오류 발생', '품목 목록을 불러오는 중 오류가 발생했습니다');
      } finally {
        setItemsLoading(false);
      }
    };

    fetchItems();
  }, [toast]);

  const onSubmit = async (data: ProductionFormData) => {
    setLoading(true);
    setStockError(null);
    setBomDeductions([]);

    try {
      const response = await fetch('/api/inventory/production', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          item_id: parseInt(data.item_id),
          quantity: Number(data.quantity),
          unit_price: Number(data.unit_price)
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Check for stock shortage error
        if (result.error?.includes('재고 부족')) {
          setStockError(result.error);
          if (result.hint) {
            setStockError(`${result.error}\n${result.hint}`);
          }
          toast.error('재고 부족', result.error);
        } else {
          throw new Error(result.error || '생산 등록에 실패했습니다');
        }
        return;
      }

      if (result.success) {
        const deductionMsg = result.data.auto_deductions && result.data.auto_deductions.length > 0
          ? `${result.message} (${result.data.auto_deductions.length}개 원자재 자동 차감 완료)`
          : result.message;

        toast.success('생산 등록 완료', deductionMsg);

        // Display BOM deduction results
        if (result.data.auto_deductions && result.data.auto_deductions.length > 0) {
          setBomDeductions(result.data.auto_deductions);
        }

        // Reset form
        reset({
          transaction_date: new Date().toISOString().split('T')[0],
          transaction_type: '생산입고',
          created_by: 1, // admin user_id from users table
          item_id: '',
          quantity: undefined,
          unit_price: undefined,
          reference_number: '',
          notes: ''
        });

        // Trigger parent refresh
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (error: any) {
      toast.error('오류 발생', error.message || '생산 등록 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const selectedItem = items.find(item => item.item_id === parseInt(selectedItemId));

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Stock Error Alert */}
        {stockError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>재고 부족</AlertTitle>
            <AlertDescription className="whitespace-pre-line">
              {stockError}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Transaction Date */}
          <div className="space-y-2">
            <Label htmlFor="transaction_date">
              거래일자 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="transaction_date"
              type="date"
              {...register('transaction_date')}
              max={new Date().toISOString().split('T')[0]}
            />
            {errors.transaction_date && (
              <p className="text-sm text-destructive">{errors.transaction_date.message}</p>
            )}
          </div>

          {/* Transaction Type */}
          <div className="space-y-2">
            <Label htmlFor="transaction_type">
              거래유형 <span className="text-destructive">*</span>
            </Label>
            <Select
              value={watch('transaction_type')}
              onValueChange={(value) => setValue('transaction_type', value as '생산입고' | '생산출고')}
            >
              <SelectTrigger>
                <SelectValue placeholder="거래유형 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="생산입고">생산입고</SelectItem>
                <SelectItem value="생산출고">생산출고</SelectItem>
              </SelectContent>
            </Select>
            {errors.transaction_type && (
              <p className="text-sm text-destructive">{errors.transaction_type.message}</p>
            )}
          </div>

          {/* Item Selection */}
          <div className="space-y-2">
            <Label htmlFor="item_id">
              품목 <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedItemId}
              onValueChange={(value) => setValue('item_id', value)}
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
            {errors.item_id && (
              <p className="text-sm text-destructive">{errors.item_id.message}</p>
            )}
            {selectedItem && (
              <p className="text-sm text-muted-foreground">
                단위: {selectedItem.unit} | 분류: {selectedItem.category}
              </p>
            )}
          </div>

          {/* Reference Number */}
          <div className="space-y-2">
            <Label htmlFor="reference_number">참조번호</Label>
            <Input
              id="reference_number"
              placeholder="예: PROD-2025-001"
              {...register('reference_number')}
            />
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">
              수량 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="quantity"
              type="number"
              step="0.01"
              placeholder="0"
              {...register('quantity', { valueAsNumber: true })}
            />
            {errors.quantity && (
              <p className="text-sm text-destructive">{errors.quantity.message}</p>
            )}
          </div>

          {/* Unit Price */}
          <div className="space-y-2">
            <Label htmlFor="unit_price">
              단가 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="unit_price"
              type="number"
              step="0.01"
              placeholder="0"
              {...register('unit_price', { valueAsNumber: true })}
            />
            {errors.unit_price && (
              <p className="text-sm text-destructive">{errors.unit_price.message}</p>
            )}
          </div>

          {/* Total Amount Display */}
          <div className="space-y-2">
            <Label>총 금액</Label>
            <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 py-2">
              <span className="text-lg font-semibold">
                {totalAmount.toLocaleString('ko-KR')} 원
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">비고</Label>
          <Textarea
            id="notes"
            placeholder="추가 메모사항을 입력하세요"
            rows={3}
            {...register('notes')}
          />
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => reset()}
            disabled={loading}
          >
            초기화
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? '등록 중...' : '생산 등록'}
          </Button>
        </div>
      </form>

      {/* BOM Deduction Results */}
      {bomDeductions.length > 0 && (
        <div className="mt-8">
          <BOMDeductionResults deductions={bomDeductions} />
        </div>
      )}
    </div>
  );
}
