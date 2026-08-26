USE compliance_portal;

INSERT INTO departments (name) VALUES
  ('Environment'), ('Human Resources'), ('Safety'), ('Engineering'), ('Finance'), ('Safety & Operations');

INSERT INTO users (full_name, email, password_hash, is_master, department_id) VALUES
  ('Ananya Rao', 'ananya.master@example.com', 'x', TRUE, NULL),
  ('Vikram Shah', 'vikram.owner@example.com', 'x', FALSE, 2),
  ('Priya Menon', 'priya.owner@example.com', 'x', FALSE, 1),
  ('Rahul Gupta', 'rahul.reviewer@example.com', 'x', FALSE, 1),
  ('Sneha Iyer', 'sneha.reviewer@example.com', 'x', FALSE, 3);

INSERT INTO plants (name, code, location, created_by) VALUES
  ('Chennai Plant', 'CH-01', 'Chennai, Tamil Nadu', 1),
  ('Pune Plant', 'PN-02', 'Pune, Maharashtra', 1);

INSERT INTO agencies (plant_id, name, description, created_by) VALUES
  (1, 'Pollution Control Board', 'State pollution control filings', 1),
  (1, 'Labour Department', 'Labour law compliances', 1),
  (2, 'Fire Department', 'Fire safety certifications', 1);

INSERT INTO compliances (agency_id, plant_id, department_id, name, owner_id, reviewer_id, start_date, frequency_number, frequency_unit, next_due_date, financial_year, created_by) VALUES
  (1, 1, 1, 'Consent to Operate Renewal', 2, 4, '2026-01-15', 1, 'year', '2027-01-15', 'FY 2026-27', 1),
  (1, 1, 1, 'Hazardous Waste Return', 3, 4, '2026-06-01', 1, 'month', '2026-07-01', 'FY 2026-27', 1),
  (2, 1, 2, 'PF Monthly Filing', 2, 5, '2026-06-01', 1, 'month', '2026-08-01', 'FY 2026-27', 1),
  (3, 2, 3, 'Fire NOC Renewal', 3, 5, '2025-08-01', 1, 'year', '2026-08-01', 'FY 2026-27', 1);

INSERT INTO reminders (compliance_id, reminder_label, days_before_due, recipient_id) VALUES
  (1,'R1',30,2), (1,'R2',15,2), (1,'R3',7,2), (1,'R4',1,2),
  (2,'R1',30,3), (2,'R2',15,3), (2,'R3',7,3), (2,'R4',1,3),
  (3,'R1',30,2), (3,'R2',15,2), (3,'R3',7,2), (3,'R4',1,2),
  (4,'R1',30,3), (4,'R2',15,3), (4,'R3',7,3), (4,'R4',1,3);
