-- Migration: Create item_images table
-- Description: Stores multiple images per item with primary image support
-- Date: 2025-01-22

-- Create item_images table
CREATE TABLE IF NOT EXISTS item_images (
  image_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_item_images_item_id ON item_images(item_id);
CREATE INDEX IF NOT EXISTS idx_item_images_is_primary ON item_images(item_id, is_primary) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_item_images_display_order ON item_images(item_id, display_order);

-- Add RLS policies
ALTER TABLE item_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to item_images"
  ON item_images FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to item_images"
  ON item_images FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to item_images"
  ON item_images FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete from item_images"
  ON item_images FOR DELETE
  USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_item_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER item_images_updated_at
  BEFORE UPDATE ON item_images
  FOR EACH ROW
  EXECUTE FUNCTION update_item_images_updated_at();

-- Add comment
COMMENT ON TABLE item_images IS 'Stores multiple images per item with primary image indicator and display order';
