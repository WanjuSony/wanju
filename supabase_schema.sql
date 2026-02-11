-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Projects Table
create table projects (
  id text primary key, -- Converting existing IDs to use text specific IDs or we can migrate to UUIDs. Keeping text for compatibility for now.
  title text not null,
  description text,
  goal text,
  exit_criteria text,
  status text default 'planning',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  "order" integer default -1
);

-- 2. Personas Table
create table personas (
  id text primary key,
  project_id text references projects(id) on delete cascade not null,
  name text not null,
  description text,
  avatar text,
  characteristics jsonb
);

-- 3. Studies Table
create table studies (
  id text primary key,
  project_id text references projects(id) on delete cascade not null,
  title text not null,
  description text,
  questions jsonb, -- Storing list of questions as JSON array for simplicity
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Interviews Table
create table interviews (
  id text primary key,
  study_id text references studies(id) on delete cascade not null,
  project_id text references projects(id) on delete cascade not null, -- Redundant but helpful for queries
  title text not null,
  date timestamp with time zone,
  participants jsonb, -- JSON array of participant info
  transcript text, -- Full text transcript
  recording_url text, -- URL to storage
  summary text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Insights Table
create table insights (
  id text primary key,
  interview_id text references interviews(id) on delete cascade not null,
  project_id text references projects(id) on delete cascade not null,
  type text not null,
  content text not null,
  evidence text,
  importance text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Row Level Security (RLS)
-- For now, we enable public access until Auth is set up in Phase 3
alter table projects enable row level security;
alter table personas enable row level security;
alter table studies enable row level security;
alter table interviews enable row level security;
alter table insights enable row level security;

-- Open access policies (Temporary for Phase 1 & 2)
create policy "Public Access Projects" on projects for all using (true);
create policy "Public Access Personas" on personas for all using (true);
create policy "Public Access Studies" on studies for all using (true);
create policy "Public Access Interviews" on interviews for all using (true);
create policy "Public Access Insights" on insights for all using (true);
