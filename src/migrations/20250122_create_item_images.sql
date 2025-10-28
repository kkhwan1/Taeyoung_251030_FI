-- Migration: Create item_images table for image management
-- Created: 2025-01-22
-- Description: Adds support for multiple images per item with primary image selection

-- Create item_images table
CREATE TABLE IF NOT EXISTS item_images (
  image_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id BIGINT NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_item_images_item_id ON item_images(item_id);
CREATE INDEX IF NOT EXISTS idx_item_images_is_primary ON item_images(is_primary) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_item_images_display_order ON item_images(item_id, display_order);

-- Create or replace trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic updated_at update
DROP TRIGGER IF EXISTS update_item_images_updated_at ON item_images;
CREATE TRIGGER update_item_images_updated_at
BEFORE UPDATE ON item_images
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Function to ensure only one primary image per item
CREATE OR REPLACE FUNCTION ensure_single_primary_image()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = TRUE THEN
    -- Set all other images for this item to non-primary
    UPDATE item_images
    SET is_primary = FALSE
    WHERE item_id = NEW.item_id
      AND image_id != NEW.image_id
      AND is_primary = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for primary image enforcement
DROP TRIGGER IF EXISTS ensure_single_primary_on_insert ON item_images;
CREATE TRIGGER ensure_single_primary_on_insert
AFTER INSERT ON item_images
FOR EACH ROW
EXECUTE FUNCTION ensure_single_primary_image();

DROP TRIGGER IF EXISTS ensure_single_primary_on_update ON item_images;
CREATE TRIGGER ensure_single_primary_on_update
AFTER UPDATE OF is_primary ON item_images
FOR EACH ROW
WHEN (NEW.is_primary = TRUE)
EXECUTE FUNCTION ensure_single_primary_image();

-- Add comment to table
COMMENT ON TABLE item_images IS '품목 이미지 관리 테이블 - 품목별 다중 이미지 지원';
COMMENT ON COLUMN item_images.image_id IS '이미지 고유 ID';
COMMENT ON COLUMN item_images.item_id IS '연결된 품목 ID';
COMMENT ON COLUMN item_images.image_url IS 'Supabase Storage 이미지 URL';
COMMENT ON COLUMN item_images.is_primary IS '대표 이미지 여부 (품목당 1개만 가능)';
COMMENT ON COLUMN item_images.display_order IS '표시 순서';
