

## Problem: Infinite Recursion in Database Policies

All queries are failing with error `42P17: infinite recursion detected in policy for relation "order_measurements"`. This is caused by circular references between RLS policies:

- `projects` SELECT policy checks `order_measurements` -> `measurement_orders`
- `measurement_orders` SELECT policy checks `order_measurements`
- `order_measurements` SELECT policy checks `measurement_orders`

## Solution

Replace the cross-referencing RLS policies with **SECURITY DEFINER helper functions** that bypass RLS and break the recursion cycle.

### Step 1: Create helper functions

Create two `SECURITY DEFINER` functions:
- `is_order_creator(uuid, uuid)` -- checks if a user created a given measurement_order
- `is_measurement_assigned(uuid, uuid)` -- checks if a user is assigned to any order_measurement for a given order

These functions run with elevated privileges and don't trigger RLS checks on the tables they query, breaking the recursion.

### Step 2: Replace RLS policies

Drop and recreate the following policies using the helper functions instead of sub-selects:

1. **`measurement_orders` SELECT** -- use `is_measurement_assigned` instead of sub-select on `order_measurements`
2. **`order_measurements` SELECT/INSERT/UPDATE** -- use `is_order_creator` instead of sub-select on `measurement_orders`
3. **`projects` SELECT** -- use a dedicated function or simplified logic

### Step 3: Database migration

A single migration will:
1. Create `is_order_creator(_user_id uuid, _order_id uuid)` function
2. Create `is_assigned_to_order(_user_id uuid, _order_id uuid)` function
3. Drop all affected policies (on `projects`, `measurement_orders`, `order_measurements`, `measurement_parameters`, `work_logs`, `documents`)
4. Recreate them using the helper functions

### Technical Details

```sql
-- Example helper function
CREATE OR REPLACE FUNCTION public.is_order_creator(_user_id uuid, _order_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM measurement_orders WHERE id = _order_id AND created_by = _user_id
  )
$$;
```

No frontend code changes needed -- this is purely a database-level fix.

