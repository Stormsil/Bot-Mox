-- D-02 normalization wave 3: typed projections for workspace + bots domain entities.
--
-- Backward compatibility:
--   runtime still writes JSONB `data`; projections are generated columns only.
--   this keeps API behavior stable while enabling indexed DB-first reads.

-- ============================================================
-- workspace_notes
-- ============================================================

alter table if exists public.workspace_notes
  add column if not exists note_title text generated always as (nullif(data ->> 'title', '')) stored,
  add column if not exists note_bot_id_ref text generated always as (nullif(data ->> 'bot_id', '')) stored,
  add column if not exists note_project_id_ref text generated always as (nullif(data ->> 'project_id', '')) stored,
  add column if not exists note_is_pinned boolean generated always as (
    case
      when lower(coalesce(data ->> 'is_pinned', '')) in ('true', 'false') then (data ->> 'is_pinned')::boolean
      else null
    end
  ) stored,
  add column if not exists note_tags_count integer generated always as (
    case
      when jsonb_typeof(data -> 'tags') = 'array' then jsonb_array_length(data -> 'tags')
      else 0
    end
  ) stored,
  add column if not exists note_created_at_ms bigint generated always as (
    case
      when coalesce(data ->> 'created_at', '') ~ '^[+-]?[0-9]+$' then (data ->> 'created_at')::bigint
      else null
    end
  ) stored,
  add column if not exists note_updated_at_ms bigint generated always as (
    case
      when coalesce(data ->> 'updated_at', '') ~ '^[+-]?[0-9]+$' then (data ->> 'updated_at')::bigint
      else null
    end
  ) stored;

alter table if exists public.workspace_notes
  drop constraint if exists workspace_notes_note_project_id_ref_chk;

alter table if exists public.workspace_notes
  add constraint workspace_notes_note_project_id_ref_chk check (
    note_project_id_ref is null
    or note_project_id_ref in ('wow_tbc', 'wow_midnight')
  );

create index if not exists idx_workspace_notes_bot_ref
  on public.workspace_notes (tenant_id, note_bot_id_ref);

create index if not exists idx_workspace_notes_project_ref
  on public.workspace_notes (tenant_id, note_project_id_ref);

create index if not exists idx_workspace_notes_pinned
  on public.workspace_notes (tenant_id, note_is_pinned);

create index if not exists idx_workspace_notes_updated_at
  on public.workspace_notes (tenant_id, note_updated_at_ms);

-- ============================================================
-- workspace_calendar_events
-- ============================================================

alter table if exists public.workspace_calendar_events
  add column if not exists event_title text generated always as (nullif(data ->> 'title', '')) stored,
  add column if not exists event_date_ymd text generated always as (
    case
      when coalesce(data ->> 'date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then data ->> 'date'
      else null
    end
  ) stored,
  add column if not exists linked_note_id_ref text generated always as (nullif(data ->> 'linked_note_id', '')) stored,
  add column if not exists event_created_at_ms bigint generated always as (
    case
      when coalesce(data ->> 'created_at', '') ~ '^[+-]?[0-9]+$' then (data ->> 'created_at')::bigint
      else null
    end
  ) stored,
  add column if not exists event_updated_at_ms bigint generated always as (
    case
      when coalesce(data ->> 'updated_at', '') ~ '^[+-]?[0-9]+$' then (data ->> 'updated_at')::bigint
      else null
    end
  ) stored;

create index if not exists idx_workspace_calendar_events_date
  on public.workspace_calendar_events (tenant_id, event_date_ymd);

create index if not exists idx_workspace_calendar_events_linked_note
  on public.workspace_calendar_events (tenant_id, linked_note_id_ref);

create index if not exists idx_workspace_calendar_events_updated_at
  on public.workspace_calendar_events (tenant_id, event_updated_at_ms);

-- ============================================================
-- workspace_kanban_tasks
-- ============================================================

alter table if exists public.workspace_kanban_tasks
  add column if not exists task_title text generated always as (nullif(data ->> 'title', '')) stored,
  add column if not exists task_status text generated always as (nullif(data ->> 'status', '')) stored,
  add column if not exists task_due_date_ymd text generated always as (
    case
      when coalesce(data ->> 'due_date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then data ->> 'due_date'
      else null
    end
  ) stored,
  add column if not exists task_order_value integer generated always as (
    case
      when coalesce(data ->> 'order', '') ~ '^[+-]?[0-9]+$' then (data ->> 'order')::integer
      else null
    end
  ) stored,
  add column if not exists task_created_at_ms bigint generated always as (
    case
      when coalesce(data ->> 'created_at', '') ~ '^[+-]?[0-9]+$' then (data ->> 'created_at')::bigint
      else null
    end
  ) stored,
  add column if not exists task_updated_at_ms bigint generated always as (
    case
      when coalesce(data ->> 'updated_at', '') ~ '^[+-]?[0-9]+$' then (data ->> 'updated_at')::bigint
      else null
    end
  ) stored;

alter table if exists public.workspace_kanban_tasks
  drop constraint if exists workspace_kanban_tasks_task_status_chk;

alter table if exists public.workspace_kanban_tasks
  add constraint workspace_kanban_tasks_task_status_chk check (
    task_status is null
    or task_status in ('todo', 'in_progress', 'done')
  );

create index if not exists idx_workspace_kanban_tasks_status
  on public.workspace_kanban_tasks (tenant_id, task_status);

create index if not exists idx_workspace_kanban_tasks_due_date
  on public.workspace_kanban_tasks (tenant_id, task_due_date_ymd);

create index if not exists idx_workspace_kanban_tasks_order
  on public.workspace_kanban_tasks (tenant_id, task_order_value);

create index if not exists idx_workspace_kanban_tasks_updated_at
  on public.workspace_kanban_tasks (tenant_id, task_updated_at_ms);

-- ============================================================
-- bots
-- ============================================================

alter table if exists public.bots
  add column if not exists bot_name text generated always as (nullif(data ->> 'name', '')) stored,
  add column if not exists bot_status text generated always as (nullif(data ->> 'status', '')) stored,
  add column if not exists project_id_ref text generated always as (nullif(data ->> 'project_id', '')) stored,
  add column if not exists character_name text generated always as (nullif(data #>> '{character,name}', '')) stored,
  add column if not exists character_level integer generated always as (
    case
      when coalesce(data #>> '{character,level}', '') ~ '^[+-]?[0-9]+$' then (data #>> '{character,level}')::integer
      else null
    end
  ) stored,
  add column if not exists last_seen_ms bigint generated always as (
    case
      when coalesce(data ->> 'last_seen', '') ~ '^[+-]?[0-9]+$' then (data ->> 'last_seen')::bigint
      else null
    end
  ) stored,
  add column if not exists lifecycle_current_stage text generated always as (
    nullif(data #>> '{lifecycle,current_stage}', '')
  ) stored,
  add column if not exists lifecycle_transitions_count integer generated always as (
    case
      when jsonb_typeof(data #> '{lifecycle,stage_transitions}') = 'array' then jsonb_array_length(data #> '{lifecycle,stage_transitions}')
      else 0
    end
  ) stored;

alter table if exists public.bots
  drop constraint if exists bots_bot_status_chk;

alter table if exists public.bots
  add constraint bots_bot_status_chk check (
    bot_status is null
    or bot_status in ('offline', 'prepare', 'leveling', 'profession', 'farming', 'banned')
  );

alter table if exists public.bots
  drop constraint if exists bots_project_id_ref_chk;

alter table if exists public.bots
  add constraint bots_project_id_ref_chk check (
    project_id_ref is null
    or project_id_ref in ('wow_tbc', 'wow_midnight')
  );

alter table if exists public.bots
  drop constraint if exists bots_lifecycle_current_stage_chk;

alter table if exists public.bots
  add constraint bots_lifecycle_current_stage_chk check (
    lifecycle_current_stage is null
    or lifecycle_current_stage in ('prepare', 'leveling', 'profession', 'farming', 'banned')
  );

create index if not exists idx_bots_status
  on public.bots (tenant_id, bot_status);

create index if not exists idx_bots_project
  on public.bots (tenant_id, project_id_ref);

create index if not exists idx_bots_last_seen
  on public.bots (tenant_id, last_seen_ms);

create index if not exists idx_bots_character_level
  on public.bots (tenant_id, character_level);

create index if not exists idx_bots_lifecycle_stage
  on public.bots (tenant_id, lifecycle_current_stage);
