-- =====================================================================
-- ANJIR — Slice 4a: Realtime via Supabase Postgres CDC
--
-- Enables Supabase Realtime on the orders table so the staff dashboard
-- and customer tracking page receive instant updates without polling.
--
-- How it works: Supabase listens to Postgres logical replication and
-- broadcasts row changes to subscribed clients over WebSocket.
-- Anon key clients see only rows allowed by RLS policies.
-- =====================================================================

-- Enable replica identity FULL so updates include the previous row data
-- (needed for reliable change detection on the client)
alter table orders replica identity full;
alter table order_events replica identity full;

-- Add tables to the supabase_realtime publication
-- (Supabase auto-creates this publication; we extend it)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- Drop if already in the publication, then re-add (idempotent)
    begin
      alter publication supabase_realtime drop table orders;
    exception when undefined_object then
      -- table wasn't in the publication; that's fine
      null;
    end;
    alter publication supabase_realtime add table orders;

    begin
      alter publication supabase_realtime drop table order_events;
    exception when undefined_object then
      null;
    end;
    alter publication supabase_realtime add table order_events;
  end if;
end $$;
