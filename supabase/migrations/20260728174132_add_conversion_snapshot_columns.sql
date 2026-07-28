-- Add conversion-at-entry snapshot columns to salary_bank and line_style_costs.
-- These record what the IE typed, in what currency, at what rate — so historical
-- values are fully reproducible and audit-proof. The canonical USD column remains
-- the value used by all formulas.

alter table public.salary_bank
  add column original_amount numeric(12,4),
  add column original_currency text,
  add column conversion_rate_at_entry numeric(14,6);

comment on column public.salary_bank.original_amount is 'The number the IE typed (in their local currency)';
comment on column public.salary_bank.original_currency is 'Currency the IE entered the value in (e.g. BDT, INR)';
comment on column public.salary_bank.conversion_rate_at_entry is 'FX rate (currency/USD) at the moment of entry; monthly_salary_usd = original_amount / this rate';

alter table public.line_style_costs
  add column original_cm_amount numeric(12,4),
  add column original_currency text,
  add column conversion_rate_at_entry numeric(14,6);

comment on column public.line_style_costs.original_cm_amount is 'The CM/pc the IE typed (in their local currency)';
comment on column public.line_style_costs.original_currency is 'Currency the IE entered the CM in (e.g. BDT, INR)';
comment on column public.line_style_costs.conversion_rate_at_entry is 'FX rate (currency/USD) at the moment of entry; cm_per_pc_usd = original_cm_amount / this rate';

-- Backfill existing rows with the current rate (best effort for seed data).
update public.salary_bank set
  original_amount = monthly_salary_usd * 123.44,
  original_currency = 'BDT',
  conversion_rate_at_entry = 123.44
where original_amount is null;

update public.line_style_costs set
  original_cm_amount = cm_per_pc_usd * 123.44,
  original_currency = 'BDT',
  conversion_rate_at_entry = 123.44
where original_cm_amount is null;;
