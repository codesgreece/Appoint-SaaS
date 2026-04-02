-- Inventory module: categories and stock items with custom low-stock thresholds.

CREATE TABLE IF NOT EXISTS public.inventory_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.inventory_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit_type text NOT NULL CHECK (unit_type IN ('pieces', 'meters', 'kg')),
  quantity_current numeric(12,2) NOT NULL DEFAULT 0 CHECK (quantity_current >= 0),
  orange_threshold numeric(12,2) NOT NULL DEFAULT 0 CHECK (orange_threshold >= 0),
  red_threshold numeric(12,2) NOT NULL DEFAULT 0 CHECK (red_threshold >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_items_thresholds_valid CHECK (orange_threshold >= red_threshold),
  UNIQUE (business_id, category_id, name)
);

CREATE INDEX IF NOT EXISTS idx_inventory_categories_business_name
  ON public.inventory_categories (business_id, name);

CREATE INDEX IF NOT EXISTS idx_inventory_items_business_category
  ON public.inventory_items (business_id, category_id);

CREATE INDEX IF NOT EXISTS idx_inventory_items_business_quantity
  ON public.inventory_items (business_id, quantity_current);

DROP TRIGGER IF EXISTS inventory_categories_updated_at ON public.inventory_categories;
CREATE TRIGGER inventory_categories_updated_at
BEFORE UPDATE ON public.inventory_categories
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS inventory_items_updated_at ON public.inventory_items;
CREATE TRIGGER inventory_items_updated_at
BEFORE UPDATE ON public.inventory_items
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_categories_select ON public.inventory_categories;
CREATE POLICY inventory_categories_select
  ON public.inventory_categories FOR SELECT
  USING (business_id = public.get_current_user_business_id() OR public.is_current_user_super_admin());

DROP POLICY IF EXISTS inventory_categories_insert ON public.inventory_categories;
CREATE POLICY inventory_categories_insert
  ON public.inventory_categories FOR INSERT
  WITH CHECK (business_id = public.get_current_user_business_id() OR public.is_current_user_super_admin());

DROP POLICY IF EXISTS inventory_categories_update ON public.inventory_categories;
CREATE POLICY inventory_categories_update
  ON public.inventory_categories FOR UPDATE
  USING (business_id = public.get_current_user_business_id() OR public.is_current_user_super_admin())
  WITH CHECK (business_id = public.get_current_user_business_id() OR public.is_current_user_super_admin());

DROP POLICY IF EXISTS inventory_categories_delete ON public.inventory_categories;
CREATE POLICY inventory_categories_delete
  ON public.inventory_categories FOR DELETE
  USING (business_id = public.get_current_user_business_id() OR public.is_current_user_super_admin());

DROP POLICY IF EXISTS inventory_items_select ON public.inventory_items;
CREATE POLICY inventory_items_select
  ON public.inventory_items FOR SELECT
  USING (business_id = public.get_current_user_business_id() OR public.is_current_user_super_admin());

DROP POLICY IF EXISTS inventory_items_insert ON public.inventory_items;
CREATE POLICY inventory_items_insert
  ON public.inventory_items FOR INSERT
  WITH CHECK (business_id = public.get_current_user_business_id() OR public.is_current_user_super_admin());

DROP POLICY IF EXISTS inventory_items_update ON public.inventory_items;
CREATE POLICY inventory_items_update
  ON public.inventory_items FOR UPDATE
  USING (business_id = public.get_current_user_business_id() OR public.is_current_user_super_admin())
  WITH CHECK (business_id = public.get_current_user_business_id() OR public.is_current_user_super_admin());

DROP POLICY IF EXISTS inventory_items_delete ON public.inventory_items;
CREATE POLICY inventory_items_delete
  ON public.inventory_items FOR DELETE
  USING (business_id = public.get_current_user_business_id() OR public.is_current_user_super_admin());
