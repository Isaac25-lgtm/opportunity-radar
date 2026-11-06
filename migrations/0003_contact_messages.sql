-- Messages submitted through the public contact form; visible to administrators only.
CREATE TABLE contact_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  topic TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'handled')),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_contact_messages_created ON contact_messages(created_at);
