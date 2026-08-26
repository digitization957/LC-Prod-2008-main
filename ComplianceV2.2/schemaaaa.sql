USE compliance_portal;

CREATE TABLE IF NOT EXISTS agencies (
  agency_id INT PRIMARY KEY AUTO_INCREMENT,
  plant_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  created_by VARCHAR(64),
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE (plant_id, name)
);

CREATE TABLE IF NOT EXISTS compliances (
  compliance_id INT PRIMARY KEY AUTO_INCREMENT,
  agency_id INT NOT NULL,
  plant_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  owner_token VARCHAR(64) NOT NULL,
  reviewer_token VARCHAR(64) NULL,
  start_date DATE NOT NULL,
  frequency_number INT NOT NULL,
  frequency_unit ENUM('day','week','month','year') NOT NULL,
  next_due_date DATE NOT NULL,
  status ENUM('pending','completed','overdue') DEFAULT 'pending',
  financial_year VARCHAR(9),
  created_by VARCHAR(64),
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES agencies(agency_id),
  INDEX (owner_token), INDEX (reviewer_token), INDEX (plant_id, agency_id),
  INDEX (next_due_date), INDEX (financial_year)
);

CREATE TABLE IF NOT EXISTS compliance_logs (
  log_id INT PRIMARY KEY AUTO_INCREMENT,
  compliance_id INT NOT NULL,
  action_date DATE NOT NULL,
  done_by VARCHAR(64) NOT NULL,
  remarks TEXT,
  next_due_date_snapshot DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (compliance_id) REFERENCES compliances(compliance_id)
);

CREATE TABLE IF NOT EXISTS compliance_attachments (
  attachment_id INT PRIMARY KEY AUTO_INCREMENT,
  log_id INT,
  compliance_id INT,
  file_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  uploaded_by VARCHAR(64),
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (log_id) REFERENCES compliance_logs(log_id),
  FOREIGN KEY (compliance_id) REFERENCES compliances(compliance_id)
);

CREATE TABLE IF NOT EXISTS compliance_log_reverts (
  revert_id INT PRIMARY KEY AUTO_INCREMENT,
  compliance_id INT NOT NULL,
  original_log_id INT NOT NULL,
  action_date DATE NOT NULL,
  done_by VARCHAR(64) NOT NULL,
  remarks TEXT,
  attachments_json JSON,
  logged_at DATETIME NOT NULL,
  next_due_date_before_revert DATE,
  next_due_date_after_revert DATE,
  reverted_by VARCHAR(64) NOT NULL,
  revert_reason VARCHAR(250) NOT NULL,
  reviewer_token VARCHAR(64) NULL,
  reviewer_email VARCHAR(150) NULL,
  mail_sent BOOLEAN DEFAULT FALSE,
  mail_error VARCHAR(500),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (compliance_id) REFERENCES compliances(compliance_id)
);

CREATE TABLE IF NOT EXISTS compliance_history (
  history_id INT PRIMARY KEY AUTO_INCREMENT,
  compliance_id INT NOT NULL,
  field_name VARCHAR(50) NOT NULL,
  old_value VARCHAR(255),
  new_value VARCHAR(255),
  changed_by VARCHAR(64) NOT NULL,
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (compliance_id) REFERENCES compliances(compliance_id)
);

CREATE TABLE IF NOT EXISTS reminders (
  reminder_id INT PRIMARY KEY AUTO_INCREMENT,
  compliance_id INT NOT NULL,
  reminder_label ENUM('R1','R2','R3','R4') NOT NULL,
  days_before_due INT NOT NULL,
  recipient_id VARCHAR(64),
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (compliance_id) REFERENCES compliances(compliance_id),
  UNIQUE (compliance_id, reminder_label)
);

CREATE TABLE IF NOT EXISTS training_completions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  token VARCHAR(64) NOT NULL,
  plant_id INT NOT NULL,
  completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS local_sessions (
  session_id VARCHAR(64) PRIMARY KEY,
  token VARCHAR(64) NOT NULL,
  role ENUM('master','owner','reviewer') NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  audit_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id VARCHAR(64),
  action VARCHAR(100),
  entity_type VARCHAR(50),
  entity_id INT,
  details JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
