ALTER TYPE public.order_priority ADD VALUE IF NOT EXISTS 'niedrig';
ALTER TYPE public.order_priority ADD VALUE IF NOT EXISTS 'hoch';
ALTER TYPE public.order_priority ADD VALUE IF NOT EXISTS 'sehr_hoch';