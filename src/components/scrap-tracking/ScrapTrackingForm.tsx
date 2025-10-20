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
import { Loader2, AlertCircle, DollarSign, Weight, Package } from 'lucide-react';

const scrapTrackingSchema = z.object({
  tracking_date: z.string().min(1, '추적 날짜를 선택해주세요'),
  item_id: z.string().min(1, '품목을 선택해주세요'),
  production_quantity: z.number().positive('생산 수량은 0보다 커야 합니다'),
  scrap_weight: z.number().positive('스크랩 무게는 0보다 커야 합니다'),
  scrap_unit_price: z.number().min(0, '스크랩 단가는 0 이상이어야 합니다'),
  notes: z.string().optional()
});

type ScrapTrackingFormData = z.infer<typeof scrapTrackingSchema>;

interface Item {
  item_id: number;
  item_code: string;
  item_name: string;
  spec: string;
  unit: string;
  category: string;
}

interface ScrapTrackingFormProps {
  onSuccess?: () => void;
}

export default function ScrapTrackingForm({ onSuccess }: ScrapTrackingFormProps) {
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
  } = useForm<ScrapTrackingFormData>({
    resolver: zodResolver(scrapTrackingSchema),
    defaultValues: {
      tracking_date: new Date().toISOString().split('T')[0]
    }
  });

  const selectedItemId = watch('item_id');
  const scrapWeight = watch('scrap_weight');
  const scrapUnitPrice = watch('scrap_unit_price');

  // Calculate scrap revenue in real-time
  const scrapRevenue = scrapWeight && scrapUnitPrice
    ? scrapWeight * scrapUnitPrice
    : 0;

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

  const onSubmit = async (data: ScrapTrackingFormData) => {
    setLoading(true);

    try {
      const response = await fetch('/api/scrap-tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          item_id: parseInt(data.item_id),
          production_quantity: Number(data.production_quantity),
          scrap_weight: Number(data.scrap_weight),
          scrap_unit_price: Number(data.scrap_unit_price),
          scrap_revenue: scrapRevenue // Include calculated revenue
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '스크랩 등록에 실패했습니다');
      }

      if (result.success) {
        toast({
          title: '스크랩 등록 완료',
          description: (
            <div className="space-y-1">
              <p>{result.message}</p>
              <p className="text-sm text-muted-foreground">
                스크랩 수익: {scrapRevenue.toLocaleString('ko-KR')}원
              </p>
            </div>
          ),
        });

        // Reset form
        reset({
          tracking_date: new Date().toISOString().split('T')[0],
          item_id: '',
          production_quantity: undefined,
          scrap_weight: undefined,
          scrap_unit_price: undefined,
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
        description: error.message || '스크랩 등록 중 오류가 발생했습니다'
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedItem = items.find(item => item.item_id === parseInt(selectedItemId));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tracking Date */}
        <div className="space-y-2">
          <Label htmlFor="tracking_date">
            추적 날짜 <span className="text-destructive">*</span>
          </Label>
          <Input
            id="tracking_date"
            type="date"
            {...register('tracking_date')}
            max={new Date().toISOString().split('T')[0]}
          />
          {errors.tracking_date && (
            <p className="text-sm text-destructive">{errors.tracking_date.message}</p>
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

        {/* Production Quantity */}
        <div className="space-y-2">
          <Label htmlFor="production_quantity">
            생산 수량 <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Package className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="production_quantity"
              type="number"
              step="0.01"
              placeholder="0"
              className="pl-9"
              {...register('production_quantity', { valueAsNumber: true })}
            />
          </div>
          {errors.production_quantity && (
            <p className="text-sm text-destructive">{errors.production_quantity.message}</p>
          )}
        </div>

        {/* Scrap Weight */}
        <div className="space-y-2">
          <Label htmlFor="scrap_weight">
            스크랩 무게 (kg) <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Weight className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="scrap_weight"
              type="number"
              step="0.01"
              placeholder="0.00"
              className="pl-9"
              {...register('scrap_weight', { valueAsNumber: true })}
            />
          </div>
          {errors.scrap_weight && (
            <p className="text-sm text-destructive">{errors.scrap_weight.message}</p>
          )}
        </div>

        {/* Scrap Unit Price */}
        <div className="space-y-2">
          <Label htmlFor="scrap_unit_price">
            스크랩 단가 (원/kg) <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="scrap_unit_price"
              type="number"
              step="0.01"
              placeholder="0"
              className="pl-9"
              {...register('scrap_unit_price', { valueAsNumber: true })}
            />
          </div>
          {errors.scrap_unit_price && (
            <p className="text-sm text-destructive">{errors.scrap_unit_price.message}</p>
          )}
        </div>

        {/* Scrap Revenue (Calculated, Read-only) */}
        <div className="space-y-2">
          <Label htmlFor="scrap_revenue">
            스크랩 수익 (원)
          </Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="scrap_revenue"
              type="text"
              value={scrapRevenue.toLocaleString('ko-KR')}
              className="pl-9 bg-muted font-semibold"
              readOnly
            />
          </div>
          <p className="text-xs text-muted-foreground">
            자동 계산: 스크랩 무게 × 스크랩 단가
          </p>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">비고</Label>
        <Textarea
          id="notes"
          placeholder="추가 메모나 특이사항을 입력하세요"
          rows={3}
          {...register('notes')}
        />
      </div>

      {/* Revenue Preview Alert */}
      {scrapRevenue > 0 && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900">
          <DollarSign className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-900 dark:text-green-100">
            예상 스크랩 수익
          </AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-300">
            이번 스크랩 등록으로 <span className="font-bold">{scrapRevenue.toLocaleString('ko-KR')}원</span>의 수익이 발생합니다.
          </AlertDescription>
        </Alert>
      )}

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
          {loading ? '등록 중...' : '스크랩 등록'}
        </Button>
      </div>
    </form>
  );
}
