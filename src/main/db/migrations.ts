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
  }
]
