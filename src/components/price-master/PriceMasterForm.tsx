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
import { useToast } from '@/components/ui/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, DollarSign } from 'lucide-react';

const priceMasterSchema = z.object({
  item_id: z.string().min(1, '품목을 선택해주세요'),
  unit_price: z.number().min(0, '단가는 0 이상이어야 합니다'),
  effective_date: z.string().min(1, '적용일자를 선택해주세요'),
  price_type: z.enum(['purchase', 'production', 'manual'], {
    errorMap: () => ({ message: '단가 유형을 선택해주세요' })
  }),
  notes: z.string().optional()
});

type PriceMasterFormData = z.infer<typeof priceMasterSchema>;

interface Item {
  item_id: number;
  item_code: string;
  item_name: string;
  spec: string;
  unit: string;
  category: string;
}

interface PriceMasterFormProps {
  onSuccess?: () => void;
}

export default function PriceMasterForm({ onSuccess }: PriceMasterFormProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(true);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch
  } = useForm<PriceMasterFormData>({
    resolver: zodResolver(priceMasterSchema),
    defaultValues: {
      effective_date: new Date().toISOString().split('T')[0],
      price_type: 'manual'
    }
  });

  const selectedItemId = watch('item_id');

  // Fetch items on mount
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await fetch('/api/items?is_active=true&limit=1000');
        const data = await response.json();

        if (data.success) {
          setItems(data.data.data || []);
        } else {
          toast({
            variant: 'destructive',
            title: '품목 조회 실패',
            description: data.error || '품목 목록을 불러올 수 없습니다'
          });
        }
      } catch (error) {
        toast({
          variant: 'destructive',
          title: '오류 발생',
          description: '품목 목록을 불러오는 중 오류가 발생했습니다'
        });
      } finally {
        setItemsLoading(false);
      }
    };

    fetchItems();
  }, [toast]);

  const onSubmit = async (data: PriceMasterFormData) => {
    setLoading(true);

    try {
      const response = await fetch('/api/price-master', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          item_id: parseInt(data.item_id),
          unit_price: Number(data.unit_price)
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '단가 등록에 실패했습니다');
      }

      if (result.success) {
        toast({
          title: '단가 등록 완료',
          description: (
            <div className="space-y-1">
              <p>{result.message}</p>
              <p className="text-sm text-muted-foreground">
                이전 단가는 자동으로 이력으로 전환되었습니다
              </p>
            </div>
          ),
        });

        // Reset form
        reset({
          effective_date: new Date().toISOString().split('T')[0],
          price_type: 'manual',
          item_id: '',
          unit_price: undefined,
          notes: ''
        });

        // Trigger parent refresh
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: error.message || '단가 등록 중 오류가 발생했습니다'
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedItem = items.find(item => item.item_id === parseInt(selectedItemId));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

        {/* Price Type */}
        <div className="space-y-2">
          <Label htmlFor="price_type">
            단가 유형 <span className="text-destructive">*</span>
          </Label>
          <Select
            value={watch('price_type')}
            onValueChange={(value) => setValue('price_type', value as 'purchase' | 'production' | 'manual')}
          >
            <SelectTrigger>
              <SelectValue placeholder="단가 유형 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="purchase">매입 단가</SelectItem>
              <SelectItem value="production">생산 단가</SelectItem>
              <SelectItem value="manual">수동 입력</SelectItem>
            </SelectContent>
          </Select>
          {errors.price_type && (
            <p className="text-sm text-destructive">{errors.price_type.message}</p>
          )}
        </div>

        {/* Unit Price */}
        <div className="space-y-2">
          <Label htmlFor="unit_price">
            단가 <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="unit_price"
              type="number"
              step="0.01"
              placeholder="0"
              className="pl-9"
              {...register('unit_price', { valueAsNumber: true })}
            />
          </div>
          {errors.unit_price && (
            <p className="text-sm text-destructive">{errors.unit_price.message}</p>
          )}
        </div>

        {/* Effective Date */}
        <div className="space-y-2">
          <Label htmlFor="effective_date">
            적용일자 <span className="text-destructive">*</span>
          </Label>
          <Input
            id="effective_date"
            type="date"
            {...register('effective_date')}
            max={new Date().toISOString().split('T')[0]}
          />
          {errors.effective_date && (
            <p className="text-sm text-destructive">{errors.effective_date.message}</p>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">비고</Label>
        <Textarea
          id="notes"
          placeholder="단가 변경 사유나 추가 메모를 입력하세요"
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
          {loading ? '등록 중...' : '단가 등록'}
        </Button>
      </div>
    </form>
  );
}
