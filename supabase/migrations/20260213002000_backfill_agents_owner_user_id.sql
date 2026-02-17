-- Backfill ownership for pre-existing agents created before owner_user_id rollout.
-- Prefer paired_by as canonical historical owner when available.

update public.agents
set owner_user_id = nullif(trim(paired_by), '')
where owner_user_id is null
  and paired_by is not null
  and trim(paired_by) <> '';

