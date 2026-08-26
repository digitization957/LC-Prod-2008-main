CREATE DATABASE IF NOT EXISTS compliance_portal CHARACTER SET utf8mb4;
USE compliance_portal;

CREATE TABLE IF NOT EXISTS departments (
  department_id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(20),
  department_id INT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_master BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(department_id)
);

CREATE TABLE IF NOT EXISTS plants (
  plant_id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(50) UNIQUE,
  location VARCHAR(255),
  created_by INT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS agencies (
  agency_id INT PRIMARY KEY AUTO_INCREMENT,
  plant_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  created_by INT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (plant_id) REFERENCES plants(plant_id),
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  UNIQUE (plant_id, name)
);

CREATE TABLE IF NOT EXISTS compliances (
  compliance_id INT PRIMARY KEY AUTO_INCREMENT,
  agency_id INT NOT NULL,
  plant_id INT NOT NULL,
  department_id INT,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  owner_id INT NOT NULL,
  reviewer_id INT NULL,
  start_date DATE NOT NULL,
  frequency_number INT NOT NULL,
  frequency_unit ENUM('day','week','month','year') NOT NULL,
  next_due_date DATE NOT NULL,
  status ENUM('pending','completed','overdue') DEFAULT 'pending',
  financial_year VARCHAR(9),
  created_by INT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES agencies(agency_id),
  FOREIGN KEY (plant_id) REFERENCES plants(plant_id),
  FOREIGN KEY (department_id) REFERENCES departments(department_id),
  FOREIGN KEY (owner_id) REFERENCES users(user_id),
  FOREIGN KEY (reviewer_id) REFERENCES users(user_id),
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  INDEX (owner_id), INDEX (reviewer_id), INDEX (plant_id, agency_id),
  INDEX (next_due_date), INDEX (financial_year)
);

CREATE TABLE IF NOT EXISTS compliance_logs (
  log_id INT PRIMARY KEY AUTO_INCREMENT,
  compliance_id INT NOT NULL,
  action_date DATE NOT NULL,
  done_by INT NOT NULL,
  remarks TEXT,
  next_due_date_snapshot DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (compliance_id) REFERENCES compliances(compliance_id),
  FOREIGN KEY (done_by) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS compliance_attachments (
  attachment_id INT PRIMARY KEY AUTO_INCREMENT,
  log_id INT,
  compliance_id INT,
  file_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_size_kb INT,
  uploaded_by INT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (log_id) REFERENCES compliance_logs(log_id),
  FOREIGN KEY (compliance_id) REFERENCES compliances(compliance_id),
  FOREIGN KEY (uploaded_by) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS reminders (
  reminder_id INT PRIMARY KEY AUTO_INCREMENT,
  compliance_id INT NOT NULL,
  reminder_label ENUM('R1','R2','R3','R4') NOT NULL,
  days_before_due INT NOT NULL,
  recipient_id INT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (compliance_id) REFERENCES compliances(compliance_id),
  FOREIGN KEY (recipient_id) REFERENCES users(user_id),
  UNIQUE (compliance_id, reminder_label)
);

CREATE TABLE IF NOT EXISTS reminder_dispatch_log (
  dispatch_id INT PRIMARY KEY AUTO_INCREMENT,
  reminder_id INT,
  compliance_id INT,
  scheduled_date DATE NOT NULL,
  sent_at DATETIME,
  sent_status ENUM('pending','sent','failed') DEFAULT 'pending',
  channel ENUM('email','sms','push','in_app') DEFAULT 'email',
  FOREIGN KEY (reminder_id) REFERENCES reminders(reminder_id),
  FOREIGN KEY (compliance_id) REFERENCES compliances(compliance_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  notification_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  compliance_id INT,
  notification_type ENUM('overdue','due_this_month') NOT NULL,
  message VARCHAR(500),
  is_read BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (compliance_id) REFERENCES compliances(compliance_id)
);

CREATE TABLE IF NOT EXISTS compliance_history (
  history_id INT PRIMARY KEY AUTO_INCREMENT,
  compliance_id INT NOT NULL,
  field_name VARCHAR(50) NOT NULL,
  old_value VARCHAR(255),
  new_value VARCHAR(255),
  changed_by INT NOT NULL,
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (compliance_id) REFERENCES compliances(compliance_id),
  FOREIGN KEY (changed_by) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS local_sessions (
  session_id VARCHAR(64) PRIMARY KEY,
  user_id INT NOT NULL,
  role ENUM('master','owner','reviewer') NOT NULL,
  source_token VARCHAR(500) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  audit_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  action VARCHAR(100),
  entity_type VARCHAR(50),
  entity_id INT,
  details JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);
