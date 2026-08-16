-- Shared atomic rate limits for Edge Functions. No client table access is granted.

create table if not exists public.edge_request_limits (
  rate_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.edge_request_limits enable row level security;
revoke all on public.edge_request_limits from public, anon, authenticated;

create or replace function public.consume_edge_rate_limit(
  p_rate_key text,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service authorization required' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_rate_key, ''))) < 16
    or p_max_requests < 1
    or p_window_seconds < 60 then
    raise exception 'Invalid rate-limit parameters';
  end if;

  insert into public.edge_request_limits (
    rate_key, window_started_at, request_count, updated_at
  ) values (p_rate_key, now(), 1, now())
  on conflict (rate_key) do update
  set request_count = case
        when edge_request_limits.window_started_at
          <= now() - make_interval(secs => p_window_seconds)
          then 1
        else edge_request_limits.request_count + 1
      end,
      window_started_at = case
        when edge_request_limits.window_started_at
          <= now() - make_interval(secs => p_window_seconds)
          then now()
        else edge_request_limits.window_started_at
      end,
      updated_at = now()
  returning request_count into next_count;

  return next_count <= p_max_requests;
end;
$$;

revoke all on function public.consume_edge_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_edge_rate_limit(text, integer, integer)
  to service_role;
