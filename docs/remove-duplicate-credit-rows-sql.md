# Remove duplicate credit rows RPC

Run this SQL once in the Supabase SQL editor before using the admin dashboard
**Duplicate Remove** button. The dashboard calls this function through Supabase
RPC and the function executes the duplicate-removal `DELETE` statement.

```sql
create or replace function public.remove_duplicate_credit_rows()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  DELETE FROM credit_rows
  WHERE id IN (
    SELECT id
    FROM (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY
            customer_code,
            invoice_no,
            item_no,
            quantity,
            piece_price
          ORDER BY id
        ) AS rn
      FROM credit_rows
    ) x
    WHERE x.rn > 1
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
end;
$$;
```
