alter table public.payment_orders
  add column if not exists customer_name text;

create index if not exists payment_orders_customer_name_idx
  on public.payment_orders(customer_name);
