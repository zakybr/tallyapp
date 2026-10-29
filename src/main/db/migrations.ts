/*
  Forward-only migrations. Append a new entry; never edit a shipped one.
  `schema_migrations` records which versions have run.
*/
export const MIGRATIONS: { version: number; name: string; sql: string }[] = [
  {
    version: 1,
    name: 'initial',
    sql: `
CREATE TABLE companies (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  legal_name TEXT,
  website TEXT,
  domain TEXT,
  phone TEXT,
  address TEXT,
  area TEXT,
  vertical TEXT,
  google_listing_url TEXT,
  stage TEXT NOT NULL DEFAULT 'discovered',
  verdict TEXT,
  verdict_reason TEXT,
  next_step TEXT,
  next_step_due TEXT,
  monthly_value REAL,
  offsite_only INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  source TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX companies_stage ON companies(stage);
CREATE INDEX companies_domain ON companies(domain);

CREATE TABLE contacts (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT,
  role TEXT,
  email TEXT,
  phone TEXT,
  email_source_url TEXT,
  consent_basis TEXT NOT NULL DEFAULT 'unknown',
  created_at TEXT NOT NULL
);
CREATE INDEX contacts_company ON contacts(company_id);

CREATE TABLE research_records (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  finding TEXT NOT NULL,
  gap_type TEXT,
  source_url TEXT,
  pages_checked TEXT NOT NULL DEFAULT '[]',
  screenshot_path TEXT,
  checked_at TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 1,
  job_id TEXT
);
CREATE INDEX research_company ON research_records(company_id);

CREATE TABLE benchmarks (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  handle TEXT NOT NULL,
  is_prospect INTEGER NOT NULL DEFAULT 0,
  followers INTEGER,
  posts_last30 INTEGER,
  reels_share REAL,
  avg_engagement REAL,
  source_url TEXT,
  checked_at TEXT NOT NULL
);

CREATE TABLE scores (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  verdict TEXT NOT NULL,
  gates TEXT NOT NULL,
  verified_gaps TEXT NOT NULL,
  rule_outs TEXT NOT NULL,
  reason TEXT NOT NULL,
  first_call_question TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX scores_company ON scores(company_id);

CREATE TABLE outreach (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  file_path TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX outreach_company ON outreach(company_id);

CREATE TABLE activities (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  outcome TEXT,
  at TEXT NOT NULL
);
CREATE INDEX activities_company ON activities(company_id);

CREATE TABLE debriefs (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  raw_notes TEXT NOT NULL,
  summary TEXT NOT NULL,
  new_stage TEXT,
  next_step TEXT,
  next_step_due TEXT,
  follow_up_draft TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE suppression_list (
  id INTEGER PRIMARY KEY,
  email TEXT,
  domain TEXT,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX suppression_email ON suppression_list(email) WHERE email IS NOT NULL;

CREATE TABLE conflicts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE revenue (
  id INTEGER PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  amount REAL NOT NULL,
  kind TEXT NOT NULL,
  received_at TEXT NOT NULL,
  note TEXT
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_ms INTEGER,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL,
  turns INTEGER NOT NULL DEFAULT 0,
  error TEXT
);

CREATE TABLE job_logs (
  id INTEGER PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  at TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  detail TEXT
);
CREATE INDEX job_logs_job ON job_logs(job_id);
`
  },
  {
    version: 2,
    name: 'lead_runs',
    sql: `
CREATE TABLE lead_runs (
  id INTEGER PRIMARY KEY,
  job_id TEXT,
  category TEXT NOT NULL,
  area TEXT NOT NULL,
  leads TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`
  },
  {
    version: 3,
    name: 'money_moves',
    sql: `
CREATE TABLE money_moves (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,
  amount REAL NOT NULL,
  moved_at TEXT NOT NULL,
  note TEXT
);
CREATE INDEX money_moves_at ON money_moves(moved_at);
`
  },
  {
    version: 4,
    name: 'relationships',
    sql: `
CREATE TABLE people (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  phone TEXT,
  phone_source TEXT,
  email TEXT,
  email_source_url TEXT,
  linkedin_url TEXT,
  how_met TEXT,
  introduced_by TEXT,
  interests TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  stage TEXT NOT NULL DEFAULT 'identified',
  cadence TEXT NOT NULL DEFAULT '{}',
  met_on TEXT,
  last_touch_on TEXT,
  next_touch_on TEXT,
  next_touch_kind TEXT,
  next_touch_manual INTEGER NOT NULL DEFAULT 0,
  pitch_override_at TEXT,
  external_ids TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX people_stage ON people(stage);
CREATE INDEX people_next ON people(next_touch_on);

CREATE TABLE interactions (
  id INTEGER PRIMARY KEY,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  occurred_on TEXT NOT NULL,
  kind TEXT NOT NULL,
  touch_kind TEXT,
  notes TEXT,
  told_me TEXT,
  advice TEXT,
  promised TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX interactions_person ON interactions(person_id, occurred_on);

CREATE TABLE promises (
  id INTEGER PRIMARY KEY,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  interaction_id INTEGER REFERENCES interactions(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  done_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX promises_person ON promises(person_id);

CREATE TABLE relationship_drafts (
  id INTEGER PRIMARY KEY,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  touch_kind TEXT NOT NULL,
  channel TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  overrode_pitch_gate INTEGER NOT NULL DEFAULT 0,
  sent_by_me_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- For a later HubSpot or Notion sync: {"hubspot":"123","notion":"abc"}
ALTER TABLE companies ADD COLUMN external_ids TEXT NOT NULL DEFAULT '{}';
`
  },
  {
    version: 5,
    name: 'boards',
    sql: `
-- Board content lives in Boards/<id>/board.json; this is the index for the library.
CREATE TABLE boards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  folder TEXT NOT NULL DEFAULT '',
  favourite INTEGER NOT NULL DEFAULT 0,
  is_template INTEGER NOT NULL DEFAULT 0,
  trashed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE board_links (
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  person_id INTEGER REFERENCES people(id) ON DELETE CASCADE,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE
);
CREATE INDEX board_links_board ON board_links(board_id);
CREATE TABLE board_presets (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  style TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`
  }
]
