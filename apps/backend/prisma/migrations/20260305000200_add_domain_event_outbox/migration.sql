CREATE TABLE IF NOT EXISTS public.domain_event_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  event_type text NOT NULL,
  event_version integer NOT NULL DEFAULT 1,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_domain_event_outbox_relay
  ON public.domain_event_outbox (status, next_attempt_at, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_domain_event_outbox_tenant_created
  ON public.domain_event_outbox (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.processed_domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  consumer text NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ux_processed_domain_events_event_consumer UNIQUE (event_id, consumer)
);

CREATE INDEX IF NOT EXISTS idx_processed_domain_events_consumer_processed
  ON public.processed_domain_events (consumer, processed_at DESC);
