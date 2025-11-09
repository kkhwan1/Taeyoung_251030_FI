import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';


/**
 * POST /api/coil-specs/calculate
 * Calculate weight and price preview without saving
 * Body: { thickness, width, length, sep_factor?, density?, kg_unit_price? }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const text = await request.text();
    const data = JSON.parse(text);

    const {
      thickness,
      width,
      length,
      sep_factor = 1.0,
      density = 7.85,
      kg_unit_price
    } = data;

    // Validation
    if (!thickness || !width || !length) {
      return NextResponse.json({
        success: false,
        error: '필수 필드: thickness, width, length'
      }, { status: 400 });
    }

    if (thickness <= 0 || width <= 0 || length <= 0 || sep_factor <= 0 || density <= 0) {
      return NextResponse.json({
        success: false,
        error: '모든 수치는 0보다 커야 합니다.'
      }, { status: 400 });
    }

    // Calculate EA중량 = (비중×길이×폭×두께) / 1M / SEP
    const weight_per_piece = (density * length * width * thickness / 1000000.0 / sep_factor);
    const rounded_weight = Math.round(weight_per_piece * 10000) / 10000;

    // Calculate 단품단가 = KG단가 × EA중량
    let piece_unit_price = null;
    if (kg_unit_price !== null && kg_unit_price !== undefined) {
      piece_unit_price = Math.round(kg_unit_price * weight_per_piece);
    }

    return NextResponse.json({
      success: true,
      data: {
        inputs: {
          thickness,
          width,
          length,
          sep_factor,
          density,
          kg_unit_price
        },
        calculations: {
          weight_per_piece: rounded_weight,
          piece_unit_price,
          formula: 'EA중량 = (비중×길이×폭×두께) / 1,000,000 / SEP',
          price_formula: '단품단가 = KG단가 × EA중량'
        }
      }
    });
  } catch (error) {
    console.error('Error calculating coil specs:', error);
    return NextResponse.json({
      success: false,
      error: '계산에 실패했습니다.'
    }, { status: 500 });
  }
}
