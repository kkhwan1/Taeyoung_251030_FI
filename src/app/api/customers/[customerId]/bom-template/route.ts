import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';

/**
 * GET /api/customers/[customerId]/bom-template
 *
 * Retrieves the default BOM template for a customer, including all materials/items.
 * Used by batch registration UI to auto-populate BOM items when customer is selected.
 *
 * @returns {Object} Template with BOM details and items array
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  const supabase = getSupabaseClient();
  const customerId = parseInt(params.customerId);

  if (isNaN(customerId)) {
    return NextResponse.json(
      { success: false, error: 'Invalid customer ID' },
      { status: 400 }
    );
  }

  try {
    // Step 1: Fetch default BOM template for customer
    const { data: template, error: templateError } = await supabase
      .from('customer_bom_templates')
      .select('template_id, customer_id, bom_id, is_default')
      .eq('customer_id', customerId)
      .eq('is_default', true)
      .single();

    if (templateError) {
      if (templateError.code === 'PGRST116') {
        // No default template found
        return NextResponse.json(
          {
            success: false,
            error: 'No default BOM template found for this customer'
          },
          { status: 404 }
        );
      }
      throw templateError;
    }

    // Step 2: Fetch BOM entry (parent-child relationship)
    const { data: bomEntry, error: bomError } = await supabase
      .from('bom')
      .select(`
        bom_id,
        parent_item_id,
        child_item_id,
        quantity_required,
        level_no,
        parent:items!bom_parent_item_id_fkey(item_id, item_code, item_name, spec, unit),
        child:items!bom_child_item_id_fkey(item_id, item_code, item_name, spec, unit, current_stock)
      `)
      .eq('bom_id', template.bom_id)
      .single();

    if (bomError) {
      throw bomError;
    }

    // Step 3: Fetch all child items for this parent (BOM components)
    const { data: bomItems, error: bomItemsError } = await supabase
      .from('bom')
      .select(`
        bom_id,
        child_item_id,
        quantity_required,
        level_no,
        child:items!bom_child_item_id_fkey(
          item_id,
          item_code,
          item_name,
          spec,
          unit,
          current_stock
        )
      `)
      .eq('parent_item_id', bomEntry.parent_item_id)
      .eq('is_active', true)
      .order('level_no');

    if (bomItemsError) {
      throw bomItemsError;
    }

    // Step 4: Format response
    const formattedItems = bomItems.map((bomItem: any) => ({
      item_id: bomItem.child.item_id,
      item_code: bomItem.child.item_code,
      item_name: bomItem.child.item_name,
      spec: bomItem.child.spec,
      unit: bomItem.child.unit,
      current_stock: bomItem.child.current_stock,
      quantity_required: bomItem.quantity_required,
      level_no: bomItem.level_no
    }));

    const response = {
      success: true,
      data: {
        template_id: template.template_id,
        customer_id: template.customer_id,
        bom: {
          bom_id: bomEntry.bom_id,
          product_item_id: bomEntry.parent.item_id,
          product_code: bomEntry.parent.item_code,
          product_name: bomEntry.parent.item_name,
          product_spec: bomEntry.parent.spec,
          product_unit: bomEntry.parent.unit,
          items: formattedItems
        }
      }
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching customer BOM template:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch BOM template'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/customers/[customerId]/bom-template
 *
 * Creates or updates a default BOM template for a customer.
 *
 * @body {number} bom_id - The BOM ID to set as default template
 * @body {boolean} is_default - Whether this is the default template (optional, defaults to true)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  const supabase = getSupabaseClient();
  const customerId = parseInt(params.customerId);

  if (isNaN(customerId)) {
    return NextResponse.json(
      { success: false, error: 'Invalid customer ID' },
      { status: 400 }
    );
  }

  try {
    // Parse request body using Korean-safe pattern
    const text = await request.text();
    const body = JSON.parse(text);
    const { bom_id, is_default = true } = body;

    if (!bom_id) {
      return NextResponse.json(
        { success: false, error: 'bom_id is required' },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults first
    if (is_default) {
      await supabase
        .from('customer_bom_templates')
        .update({ is_default: false })
        .eq('customer_id', customerId)
        .eq('is_default', true);
    }

    // Upsert the template
    const { data, error } = await supabase
      .from('customer_bom_templates')
      .upsert(
        {
          customer_id: customerId,
          bom_id,
          is_default
        },
        {
          onConflict: 'customer_id,bom_id',
          ignoreDuplicates: false
        }
      )
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(
      {
        success: true,
        data
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Error creating/updating customer BOM template:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create/update BOM template'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/customers/[customerId]/bom-template
 *
 * Removes a BOM template for a customer.
 *
 * @query {number} bom_id - The BOM ID to remove from templates
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  const supabase = getSupabaseClient();
  const customerId = parseInt(params.customerId);

  if (isNaN(customerId)) {
    return NextResponse.json(
      { success: false, error: 'Invalid customer ID' },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const bomId = searchParams.get('bom_id');

  if (!bomId) {
    return NextResponse.json(
      { success: false, error: 'bom_id query parameter is required' },
      { status: 400 }
    );
  }

  try {
    const { error } = await supabase
      .from('customer_bom_templates')
      .delete()
      .eq('customer_id', customerId)
      .eq('bom_id', parseInt(bomId));

    if (error) {
      throw error;
    }

    return NextResponse.json(
      {
        success: true,
        message: 'BOM template removed successfully'
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Error deleting customer BOM template:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete BOM template'
      },
      { status: 500 }
    );
  }
}
