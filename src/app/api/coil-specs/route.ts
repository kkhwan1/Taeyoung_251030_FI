import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';

/**
 * Coil Specifications API
 *
 * Table: coil_specs
 * - item_id (PK, FK to items)
 * - material_grade (VARCHAR)
 * - thickness (NUMERIC)
 * - width (NUMERIC)
 * - length (NUMERIC)
 * - sep_factor (NUMERIC)
 * - density (NUMERIC)
 * - kg_unit_price (NUMERIC)
 * - weight_per_piece (NUMERIC GENERATED)
 * - piece_unit_price (NUMERIC GENERATED)
 * - created_at (TIMESTAMP)
 * - updated_at (TIMESTAMP)
 */

/**
 * GET /api/coil-specs
 * List all coil specifications with optional filtering
 *
 * Query Parameters:
 * - item_id: Filter by item ID
 * - material_grade: Filter by material grade
 *
 * Response: Array of coil specs with item details and GENERATED columns
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);

    const itemId = searchParams.get('item_id');
    const materialGrade = searchParams.get('material_grade');

    // Build query with items join for item details
    let query = supabase
      .from('coil_specs')
      .select(`
        *,
        item:items!coil_specs_item_id_fkey (
          item_id,
          item_name,
          item_code,
          spec
        )
      `);

    // Apply filters
    if (itemId) {
      query = query.eq('item_id', parseInt(itemId));
    }
    if (materialGrade) {
      query = query.ilike('material_grade', `%${materialGrade}%`);
    }

    // Order by item_id
    query = query.order('item_id', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('[Coil Specs] GET failed:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('[Coil Specs] GET exception:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/coil-specs
 * Create new coil specification
 *
 * Request Body:
 * - item_id (required): FK to items table
 * - material_grade (required): Material grade (e.g., "SPHC", "SPCC")
 * - thickness (required): Thickness in mm (> 0)
 * - width (required): Width in mm (> 0)
 * - length (required): Length in mm (> 0)
 * - sep_factor (required): Separation factor (> 0)
 * - density (required): Density in g/cm³ (> 0)
 * - kg_unit_price (required): Price per kg (> 0)
 *
 * GENERATED Columns (auto-calculated):
 * - weight_per_piece: thickness * width * length * density * sep_factor / 1000000
 * - piece_unit_price: weight_per_piece * kg_unit_price
 *
 * Response: Created coil spec with calculated values
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    // CRITICAL: Korean encoding pattern
    const text = await request.text();
    const body = JSON.parse(text);

    const {
      item_id,
      material_grade,
      thickness,
      width,
      length,
      sep_factor,
      density,
      kg_unit_price
    } = body;

    // Validation
    if (!item_id) {
      return NextResponse.json(
        { success: false, error: 'item_id is required' },
        { status: 400 }
      );
    }
    if (!material_grade || material_grade.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'material_grade is required' },
        { status: 400 }
      );
    }
    if (thickness === undefined || thickness <= 0) {
      return NextResponse.json(
        { success: false, error: 'thickness must be greater than 0' },
        { status: 400 }
      );
    }
    if (width === undefined || width <= 0) {
      return NextResponse.json(
        { success: false, error: 'width must be greater than 0' },
        { status: 400 }
      );
    }
    if (length === undefined || length <= 0) {
      return NextResponse.json(
        { success: false, error: 'length must be greater than 0' },
        { status: 400 }
      );
    }
    if (sep_factor === undefined || sep_factor <= 0) {
      return NextResponse.json(
        { success: false, error: 'sep_factor must be greater than 0' },
        { status: 400 }
      );
    }
    if (density === undefined || density <= 0) {
      return NextResponse.json(
        { success: false, error: 'density must be greater than 0' },
        { status: 400 }
      );
    }
    if (kg_unit_price === undefined || kg_unit_price <= 0) {
      return NextResponse.json(
        { success: false, error: 'kg_unit_price must be greater than 0' },
        { status: 400 }
      );
    }

    // Check if item exists
    const { data: itemExists, error: itemError } = await supabase
      .from('items')
      .select('item_id')
      .eq('item_id', item_id)
      .single();

    if (itemError || !itemExists) {
      return NextResponse.json(
        { success: false, error: 'Item not found' },
        { status: 404 }
      );
    }

    // Check for duplicate (coil_specs has item_id as PK)
    const { data: existing } = await supabase
      .from('coil_specs')
      .select('item_id')
      .eq('item_id', item_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Coil spec already exists for this item' },
        { status: 409 }
      );
    }

    // Insert coil spec
    // GENERATED columns (weight_per_piece, piece_unit_price) auto-calculate
    const { data, error } = (await supabase
      .from('coil_specs')
      .insert({
        item_id,
        material_grade: material_grade.trim(),
        thickness,
        width,
        length,
        sep_factor,
        density,
        kg_unit_price
      } as any)
      .select(`
        *,
        item:items!coil_specs_item_id_fkey (
          item_id,
          item_name,
          item_code,
          spec
        )
      `)
      .single()) as any;

    if (error) {
      console.error('[Coil Specs] POST failed:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data
    }, { status: 201 });

  } catch (error) {
    console.error('[Coil Specs] POST exception:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/coil-specs
 * Update existing coil specification
 *
 * Request Body:
 * - item_id (required): Primary key
 * - material_grade: Material grade
 * - thickness: Thickness in mm (> 0)
 * - width: Width in mm (> 0)
 * - length: Length in mm (> 0)
 * - sep_factor: Separation factor (> 0)
 * - density: Density in g/cm³ (> 0)
 * - kg_unit_price: Price per kg (> 0)
 *
 * GENERATED columns recalculate automatically on update
 *
 * Response: Updated coil spec with recalculated values
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    // CRITICAL: Korean encoding pattern
    const text = await request.text();
    const body = JSON.parse(text);

    const {
      item_id,
      material_grade,
      thickness,
      width,
      length,
      sep_factor,
      density,
      kg_unit_price
    } = body;

    // Validation
    if (!item_id) {
      return NextResponse.json(
        { success: false, error: 'item_id is required' },
        { status: 400 }
      );
    }

    // Check if coil spec exists
    const { data: existing, error: existError } = await supabase
      .from('coil_specs')
      .select('item_id')
      .eq('item_id', item_id)
      .single();

    if (existError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Coil spec not found' },
        { status: 404 }
      );
    }

    // Build update object (only include provided fields)
    const updates: any = { updated_at: new Date().toISOString() };

    if (material_grade !== undefined) {
      if (material_grade.trim() === '') {
        return NextResponse.json(
          { success: false, error: 'material_grade cannot be empty' },
          { status: 400 }
        );
      }
      updates.material_grade = material_grade.trim();
    }
    if (thickness !== undefined) {
      if (thickness <= 0) {
        return NextResponse.json(
          { success: false, error: 'thickness must be greater than 0' },
          { status: 400 }
        );
      }
      updates.thickness = thickness;
    }
    if (width !== undefined) {
      if (width <= 0) {
        return NextResponse.json(
          { success: false, error: 'width must be greater than 0' },
          { status: 400 }
        );
      }
      updates.width = width;
    }
    if (length !== undefined) {
      if (length <= 0) {
        return NextResponse.json(
          { success: false, error: 'length must be greater than 0' },
          { status: 400 }
        );
      }
      updates.length = length;
    }
    if (sep_factor !== undefined) {
      if (sep_factor <= 0) {
        return NextResponse.json(
          { success: false, error: 'sep_factor must be greater than 0' },
          { status: 400 }
        );
      }
      updates.sep_factor = sep_factor;
    }
    if (density !== undefined) {
      if (density <= 0) {
        return NextResponse.json(
          { success: false, error: 'density must be greater than 0' },
          { status: 400 }
        );
      }
      updates.density = density;
    }
    if (kg_unit_price !== undefined) {
      if (kg_unit_price <= 0) {
        return NextResponse.json(
          { success: false, error: 'kg_unit_price must be greater than 0' },
          { status: 400 }
        );
      }
      updates.kg_unit_price = kg_unit_price;
    }

    // Update coil spec
    // GENERATED columns recalculate automatically
    const { data, error } = (await supabase
      .from('coil_specs')
      .update(updates as any)
      .eq('item_id', item_id)
      .select(`
        *,
        item:items!coil_specs_item_id_fkey (
          item_id,
          item_name,
          item_code,
          spec
        )
      `)
      .single()) as any;

    if (error) {
      console.error('[Coil Specs] PUT failed:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('[Coil Specs] PUT exception:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/coil-specs
 * Remove coil specification (hard delete)
 *
 * Query Parameters:
 * - item_id (required): Primary key of coil spec to delete
 *
 * Note: Hard delete (no is_active column in coil_specs table)
 *
 * Response: Success confirmation
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);

    const itemId = searchParams.get('item_id');

    if (!itemId) {
      return NextResponse.json(
        { success: false, error: 'item_id is required' },
        { status: 400 }
      );
    }

    // Check if coil spec exists
    const numericItemId = parseInt(itemId);
    const { data: existing, error: existError } = await supabase
      .from('coil_specs')
      .select('item_id')
      .eq('item_id', numericItemId)
      .single();

    if (existError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Coil spec not found' },
        { status: 404 }
      );
    }

    // Hard delete
    const { error } = await supabase
      .from('coil_specs')
      .delete()
      .eq('item_id', numericItemId);

    if (error) {
      console.error('[Coil Specs] DELETE failed:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Coil spec deleted successfully'
    });

  } catch (error) {
    console.error('[Coil Specs] DELETE exception:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
