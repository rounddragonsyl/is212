-- US18 Check venue suitability (SCRUM-165), slice 3: capacity per room layout (Q&A #112).
-- venues.layout/capacity stay as each venue's primary layout, because US8 search reads them.
-- Safe to replay.
begin;

-- 'U-Shape', 'u shape' and 'U_SHAPE' must be one layout, or a capacity lookup silently misses.
create or replace function public.layout_code(raw text)
returns text language sql immutable set search_path = '' as $$
  select nullif(btrim(regexp_replace(lower(btrim(coalesce(raw, ''))), '[^a-z0-9]+', '_', 'g'), '_'), '')
$$;

create table if not exists public.venue_layouts (
  venue_id uuid not null references public.venues (id) on delete cascade,
  layout   text not null references public.layout_types (code),
  capacity integer not null check (capacity > 0),
  primary key (venue_id, layout)
);

commit;