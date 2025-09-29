-- SHPH Healthcare System - Supabase Database Schema
-- Generated from mock data structure

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE user_role AS ENUM ('ADMIN', 'DOCTOR', 'VHV', 'PATIENT');
CREATE TYPE health_worker_type AS ENUM ('DOCTOR', 'VHV');
CREATE TYPE intake_status AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED');
CREATE TYPE review_action_type AS ENUM ('APPROVE', 'REQUEST_CHANGES', 'REJECT');
CREATE TYPE chronic_condition AS ENUM (
  'DIABETES', 'HYPERTENSION', 'HEART_DISEASE', 'ASTHMA', 'COPD', 
  'ARTHRITIS', 'CANCER', 'KIDNEY_DISEASE', 'OTHER'
);
CREATE TYPE emergency_status AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED');
CREATE TYPE emergency_priority AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM');
CREATE TYPE task_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE task_status AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE assignment_status AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Health workers table
CREATE TABLE health_workers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type health_worker_type NOT NULL,
  license_number VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Patients table
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  national_id VARCHAR(50) UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  dob DATE NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assignments table (VHV to patients)
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  vhv_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status assignment_status DEFAULT 'ACTIVE',
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  vhv_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  priority task_priority DEFAULT 'MEDIUM',
  status task_status DEFAULT 'PENDING',
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Intake submissions table
CREATE TABLE intake_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  vhv_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status intake_status DEFAULT 'DRAFT',
  payload JSONB NOT NULL,
  attachments TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Review actions table
CREATE TABLE review_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES intake_submissions(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action review_action_type NOT NULL,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Emergency alerts table
CREATE TABLE emergency_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  patient_name VARCHAR(255) NOT NULL,
  triggered_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  priority emergency_priority NOT NULL,
  status emergency_status DEFAULT 'ACTIVE',
  description TEXT,
  location TEXT,
  assigned_doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_vhv_id UUID REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  response_time INTEGER, -- in minutes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Emergency responses table
CREATE TABLE emergency_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id UUID NOT NULL REFERENCES emergency_alerts(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  responder_role user_role NOT NULL,
  response_type VARCHAR(20) NOT NULL CHECK (response_type IN ('ACKNOWLEDGED', 'EN_ROUTE', 'ON_SCENE', 'RESOLVED')),
  notes TEXT,
  estimated_arrival TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Emergency contacts table
CREATE TABLE emergency_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  relationship VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit log table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_health_workers_user_id ON health_workers(user_id);
CREATE INDEX idx_health_workers_type ON health_workers(type);
CREATE INDEX idx_patients_user_id ON patients(user_id);
CREATE INDEX idx_patients_national_id ON patients(national_id);
CREATE INDEX idx_assignments_patient_id ON assignments(patient_id);
CREATE INDEX idx_assignments_vhv_id ON assignments(vhv_id);
CREATE INDEX idx_assignments_doctor_id ON assignments(doctor_id);
CREATE INDEX idx_tasks_patient_id ON tasks(patient_id);
CREATE INDEX idx_tasks_vhv_id ON tasks(vhv_id);
CREATE INDEX idx_tasks_doctor_id ON tasks(doctor_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_intake_submissions_patient_id ON intake_submissions(patient_id);
CREATE INDEX idx_intake_submissions_vhv_id ON intake_submissions(vhv_id);
CREATE INDEX idx_intake_submissions_status ON intake_submissions(status);
CREATE INDEX idx_review_actions_submission_id ON review_actions(submission_id);
CREATE INDEX idx_review_actions_reviewer_id ON review_actions(reviewer_id);
CREATE INDEX idx_emergency_alerts_patient_id ON emergency_alerts(patient_id);
CREATE INDEX idx_emergency_alerts_status ON emergency_alerts(status);
CREATE INDEX idx_emergency_alerts_priority ON emergency_alerts(priority);
CREATE INDEX idx_audit_logs_actor_user_id ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic policies - customize based on your needs)
-- Users can only see their own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

-- Health workers can see their own data
CREATE POLICY "Health workers can view own data" ON health_workers
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- Patients can see their own data
CREATE POLICY "Patients can view own data" ON patients
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- VHVs can see their assigned patients
CREATE POLICY "VHVs can view assigned patients" ON patients
  FOR SELECT USING (
    id IN (
      SELECT patient_id FROM assignments 
      WHERE vhv_id::text = auth.uid()::text
    )
  );

-- Doctors can see their assigned patients
CREATE POLICY "Doctors can view assigned patients" ON patients
  FOR SELECT USING (
    id IN (
      SELECT patient_id FROM assignments 
      WHERE doctor_id::text = auth.uid()::text
    )
  );

-- Admins can see all data
CREATE POLICY "Admins can view all data" ON users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND role = 'ADMIN'
    )
  );

-- Insert demo data
INSERT INTO users (id, email, password_hash, role, created_at) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin@demo.com', crypt('admin123', gen_salt('bf')), 'ADMIN', '2024-01-01'),
  ('00000000-0000-0000-0000-000000000002', 'doctor@demo.com', crypt('doctor123', gen_salt('bf')), 'DOCTOR', '2024-01-01'),
  ('00000000-0000-0000-0000-000000000003', 'vhv@demo.com', crypt('vhv123', gen_salt('bf')), 'VHV', '2024-01-01'),
  ('00000000-0000-0000-0000-000000000004', 'patient@demo.com', crypt('patient123', gen_salt('bf')), 'PATIENT', '2024-01-01'),
  ('00000000-0000-0000-0000-000000000005', 'dr.smith@demo.com', crypt('smith123', gen_salt('bf')), 'DOCTOR', '2024-01-15'),
  ('00000000-0000-0000-0000-000000000006', 'vhv.jane@demo.com', crypt('jane123', gen_salt('bf')), 'VHV', '2024-01-20');

INSERT INTO health_workers (id, user_id, type, license_number, created_at) VALUES
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000002', 'DOCTOR', 'MD-12345', '2024-01-01'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000003', 'VHV', 'VHV-67890', '2024-01-01'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000005', 'DOCTOR', 'MD-54321', '2024-01-15'),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000006', 'VHV', 'VHV-09876', '2024-01-20');

INSERT INTO patients (id, user_id, national_id, first_name, last_name, dob, phone, address, created_at) VALUES
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000004', 'NAT001', 'John', 'Doe', '1980-05-15', '+1234567890', '123 Main St, City, Country', '2024-01-01'),
  ('00000000-0000-0000-0000-000000000202', NULL, 'NAT002', 'Jane', 'Smith', '1975-08-22', '+1234567891', '456 Oak Ave, City, Country', '2024-01-10'),
  ('00000000-0000-0000-0000-000000000203', NULL, 'NAT003', 'Bob', 'Johnson', '1990-12-03', '+1234567892', '789 Pine Rd, City, Country', '2024-01-15'),
  ('00000000-0000-0000-0000-000000000204', NULL, 'NAT004', 'Alice', 'Brown', '1965-03-18', '+1234567893', '321 Elm St, City, Country', '2024-01-20'),
  ('00000000-0000-0000-0000-000000000205', NULL, 'NAT005', 'Charlie', 'Wilson', '1988-07-09', '+1234567894', '654 Maple Ave, City, Country', '2024-01-25');

INSERT INTO assignments (id, patient_id, vhv_id, doctor_id, status, assigned_at, created_at) VALUES
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'ACTIVE', '2024-01-01', '2024-01-01'),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'ACTIVE', '2024-01-10', '2024-01-10'),
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000005', 'ACTIVE', '2024-01-15', '2024-01-15');

INSERT INTO tasks (id, title, description, patient_id, vhv_id, doctor_id, priority, status, due_date, completed_at, created_at) VALUES
  ('00000000-0000-0000-0000-000000000401', 'Initial Health Assessment', 'Conduct comprehensive health assessment and collect vital signs', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'HIGH', 'PENDING', '2024-09-30', NULL, '2024-09-27'),
  ('00000000-0000-0000-0000-000000000402', 'Follow-up Visit', 'Check on patient progress and medication compliance', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'MEDIUM', 'COMPLETED', '2024-09-28', '2024-09-28', '2024-09-25'),
  ('00000000-0000-0000-0000-000000000403', 'Blood Pressure Monitoring', 'Monitor blood pressure and record readings', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'HIGH', 'IN_PROGRESS', '2024-09-29', NULL, '2024-09-26'),
  ('00000000-0000-0000-0000-000000000404', 'Medication Review', 'Review current medications and check for side effects', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000005', 'MEDIUM', 'PENDING', '2024-10-01', NULL, '2024-09-27');

INSERT INTO intake_submissions (id, patient_id, vhv_id, status, payload, attachments, created_at) VALUES
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000003', 'SUBMITTED', 
   '{"visitMeta":{"visitDateTime":"2024-09-27T10:00:00Z","vhvId":"00000000-0000-0000-0000-000000000003","locationText":"Patient Home"},"patientBasics":{"firstName":"John","lastName":"Doe","dob":"1980-05-15","contactPhone":"+1234567890"},"symptoms":{"chiefComplaint":"Persistent cough and fever","checklist":[true,false,true,false,false],"onsetDays":3},"vitals":{"temp":38.5,"systolic":140,"diastolic":90,"hr":85},"chronicConditions":{"list":[{"condition":"DIABETES","freeText":"Type 2 diabetes, well controlled"}]},"riskFlags":{"isAge60Plus":false,"isPregnant":false,"hasChronic":true},"consent":{"consentGiven":true}}',
   '{}', '2024-09-27 10:30:00+00'),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000003', 'APPROVED',
   '{"visitMeta":{"visitDateTime":"2024-09-26T14:00:00Z","vhvId":"00000000-0000-0000-0000-000000000003","locationText":"Community Health Center"},"patientBasics":{"firstName":"Jane","lastName":"Smith","dob":"1975-08-22","contactPhone":"+1234567891"},"symptoms":{"chiefComplaint":"Chest pain and shortness of breath","checklist":[false,true,false,true,true],"onsetDays":1},"vitals":{"temp":37.2,"systolic":160,"diastolic":95,"hr":95},"chronicConditions":{"list":[{"condition":"HYPERTENSION","freeText":"Hypertension diagnosed 5 years ago"}]},"riskFlags":{"isAge60Plus":false,"isPregnant":false,"hasChronic":true},"consent":{"consentGiven":true}}',
   '{}', '2024-09-26 14:30:00+00'),
  ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000006', 'CHANGES_REQUESTED',
   '{"visitMeta":{"visitDateTime":"2024-09-25T09:00:00Z","vhvId":"00000000-0000-0000-0000-000000000006","locationText":"Village Health Post"},"patientBasics":{"firstName":"Bob","lastName":"Johnson","dob":"1990-12-03","contactPhone":"+1234567892"},"symptoms":{"chiefComplaint":"Severe headache and dizziness","checklist":[true,true,false,false,true],"onsetDays":2},"vitals":{"temp":36.8,"systolic":120,"diastolic":80,"hr":70},"chronicConditions":{"list":[]},"riskFlags":{"isAge60Plus":false,"isPregnant":false,"hasChronic":false},"consent":{"consentGiven":true}}',
   '{}', '2024-09-25 09:30:00+00'),
  ('00000000-0000-0000-0000-000000000504', '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000003', 'DRAFT',
   '{"visitMeta":{"visitDateTime":"2024-09-27T16:00:00Z","vhvId":"00000000-0000-0000-0000-000000000003","locationText":"Patient Home"},"patientBasics":{"firstName":"Alice","lastName":"Brown","dob":"1965-03-18","contactPhone":"+1234567893"},"symptoms":{"chiefComplaint":"Joint pain and stiffness","checklist":[false,false,true,true,false],"onsetDays":14},"vitals":{"temp":37.0,"systolic":130,"diastolic":85,"hr":75},"chronicConditions":{"list":[{"condition":"ARTHRITIS","freeText":"Rheumatoid arthritis, on medication"}]},"riskFlags":{"isAge60Plus":true,"isPregnant":false,"hasChronic":true},"consent":{"consentGiven":true}}',
   '{}', '2024-09-27 16:30:00+00');

-- Create functions for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_health_workers_updated_at BEFORE UPDATE ON health_workers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_intake_submissions_updated_at BEFORE UPDATE ON intake_submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_emergency_alerts_updated_at BEFORE UPDATE ON emergency_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_emergency_contacts_updated_at BEFORE UPDATE ON emergency_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
