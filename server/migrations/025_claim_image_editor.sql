-- 025_claim_image_editor.sql
-- Add image editing parameters to claims for the masking editor system

ALTER TABLE claims ADD COLUMN IF NOT EXISTS img_scale DECIMAL(6,2) DEFAULT 100;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS img_rotate DECIMAL(5,1) DEFAULT 0;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS img_offset_x INT DEFAULT 0;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS img_offset_y INT DEFAULT 0;
