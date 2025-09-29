import { supabase, Database } from './supabase'
import type { 
  User, 
  Patient, 
  IntakeSubmission, 
  HealthWorker, 
  Assignment, 
  Task,
  LoginRequest,
  LoginResponse,
  CreatePatient,
  ReviewComment,
  CreateDoctorRequest,
  CreateVHVRequest,
  CreateTaskRequest,
  AssignPatientRequest,
  CreateEmergencyAlertRequest,
  UpdateEmergencyAlertRequest,
  EmergencyAlert,
  UserRole,
  IntakeStatus
} from './types'

// Type definitions for Supabase responses
type UserRow = Database['public']['Tables']['users']['Row']
type PatientRow = Database['public']['Tables']['patients']['Row']
type IntakeRow = Database['public']['Tables']['intake_submissions']['Row']
type HealthWorkerRow = Database['public']['Tables']['health_workers']['Row']
type AssignmentRow = Database['public']['Tables']['assignments']['Row']
type TaskRow = Database['public']['Tables']['tasks']['Row']
type EmergencyAlertRow = Database['public']['Tables']['emergency_alerts']['Row']

// Convert Supabase rows to our types
const convertUserRow = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  passwordHash: row.password_hash,
  role: row.role,
  createdAt: new Date(row.created_at),
  updatedAt: row.updated_at ? new Date(row.updated_at) : undefined
})

const convertPatientRow = (row: PatientRow): Patient => ({
  id: row.id,
  userId: row.user_id || undefined,
  nationalId: row.national_id || undefined,
  firstName: row.first_name,
  lastName: row.last_name,
  dob: new Date(row.dob),
  phone: row.phone || undefined,
  address: row.address || undefined,
  createdAt: new Date(row.created_at),
  updatedAt: row.updated_at ? new Date(row.updated_at) : undefined
})

const convertIntakeRow = (row: IntakeRow): IntakeSubmission => ({
  id: row.id,
  patientId: row.patient_id,
  vhvId: row.vhv_id,
  status: row.status,
  payload: row.payload,
  attachments: row.attachments,
  createdAt: new Date(row.created_at),
  updatedAt: row.updated_at ? new Date(row.updated_at) : undefined
})

const convertHealthWorkerRow = (row: HealthWorkerRow): HealthWorker => ({
  id: row.id,
  userId: row.user_id,
  type: row.type,
  licenseNumber: row.license_number || undefined,
  createdAt: new Date(row.created_at),
  updatedAt: row.updated_at ? new Date(row.updated_at) : undefined
})

const convertAssignmentRow = (row: AssignmentRow): Assignment => ({
  id: row.id,
  patientId: row.patient_id,
  vhvId: row.vhv_id,
  doctorId: row.doctor_id,
  status: row.status,
  assignedAt: new Date(row.assigned_at),
  createdAt: new Date(row.created_at),
  updatedAt: row.updated_at ? new Date(row.updated_at) : undefined
})

const convertTaskRow = (row: TaskRow): Task => ({
  id: row.id,
  title: row.title,
  description: row.description || undefined,
  patientId: row.patient_id,
  vhvId: row.vhv_id,
  doctorId: row.doctor_id,
  priority: row.priority,
  status: row.status,
  dueDate: row.due_date ? new Date(row.due_date) : undefined,
  completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
  createdAt: new Date(row.created_at),
  updatedAt: row.updated_at ? new Date(row.updated_at) : undefined
})

const convertEmergencyAlertRow = (row: EmergencyAlertRow): EmergencyAlert => ({
  id: row.id,
  patientId: row.patient_id,
  patientName: row.patient_name,
  triggeredBy: row.triggered_by,
  priority: row.priority,
  status: row.status,
  description: row.description || undefined,
  location: row.location || undefined,
  assignedDoctorId: row.assigned_doctor_id || undefined,
  assignedVHVId: row.assigned_vhv_id || undefined,
  acknowledgedBy: row.acknowledged_by || undefined,
  acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
  resolvedBy: row.resolved_by || undefined,
  resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
  responseTime: row.response_time || undefined,
  createdAt: new Date(row.created_at),
  updatedAt: row.updated_at ? new Date(row.updated_at) : undefined
})

// Authentication API
export const login = async (credentials: LoginRequest): Promise<LoginResponse> => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  })

  if (error) {
    throw new Error(error.message)
  }

  if (!data.user) {
    throw new Error('Login failed')
  }

  // Get user role from database
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', data.user.id)
    .single()

  if (userError) {
    throw new Error('Failed to get user role')
  }

  return {
    accessToken: data.session?.access_token || '',
    refreshToken: data.session?.refresh_token || '',
    role: userData.role
  }
}

export const logout = async (): Promise<void> => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }
  
  const { error } = await supabase.auth.signOut()
  if (error) {
    throw new Error(error.message)
  }
}

export const getCurrentUser = async (): Promise<User | null> => {
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (userError || !userData) {
    return null
  }

  return convertUserRow(userData)
}

// Patients API
export const getPatients = async (): Promise<Patient[]> => {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data.map(convertPatientRow)
}

export const getPatientById = async (id: string): Promise<Patient | null> => {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return null
  }

  return convertPatientRow(data)
}

export const createPatient = async (patientData: CreatePatient): Promise<Patient> => {
  const { data, error } = await supabase
    .from('patients')
    .insert({
      national_id: patientData.nationalId,
      first_name: patientData.firstName,
      last_name: patientData.lastName,
      dob: patientData.dob,
      phone: patientData.phone,
      address: patientData.address
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return convertPatientRow(data)
}

// Intake Submissions API
export const getIntakeSubmissions = async (): Promise<IntakeSubmission[]> => {
  const { data, error } = await supabase
    .from('intake_submissions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data.map(convertIntakeRow)
}

export const getIntakeSubmissionById = async (id: string): Promise<IntakeSubmission | null> => {
  const { data, error } = await supabase
    .from('intake_submissions')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return null
  }

  return convertIntakeRow(data)
}

export const createIntakeSubmission = async (submission: Omit<IntakeSubmission, 'id' | 'createdAt' | 'updatedAt'>): Promise<IntakeSubmission> => {
  const { data, error } = await supabase
    .from('intake_submissions')
    .insert({
      patient_id: submission.patientId,
      vhv_id: submission.vhvId,
      status: submission.status,
      payload: submission.payload,
      attachments: submission.attachments
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return convertIntakeRow(data)
}

export const updateIntakeSubmission = async (id: string, updates: Partial<IntakeSubmission>): Promise<IntakeSubmission> => {
  const { data, error } = await supabase
    .from('intake_submissions')
    .update({
      status: updates.status,
      payload: updates.payload,
      attachments: updates.attachments
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return convertIntakeRow(data)
}

// Review Actions API
export const approveIntake = async (submissionId: string, reviewerId: string, comment?: string): Promise<void> => {
  const { error: reviewError } = await supabase
    .from('review_actions')
    .insert({
      submission_id: submissionId,
      reviewer_id: reviewerId,
      action: 'APPROVE',
      comment: comment
    })

  if (reviewError) {
    throw new Error(reviewError.message)
  }

  const { error: updateError } = await supabase
    .from('intake_submissions')
    .update({ status: 'APPROVED' })
    .eq('id', submissionId)

  if (updateError) {
    throw new Error(updateError.message)
  }
}

export const requestChanges = async (submissionId: string, reviewerId: string, comment: string): Promise<void> => {
  const { error: reviewError } = await supabase
    .from('review_actions')
    .insert({
      submission_id: submissionId,
      reviewer_id: reviewerId,
      action: 'REQUEST_CHANGES',
      comment: comment
    })

  if (reviewError) {
    throw new Error(reviewError.message)
  }

  const { error: updateError } = await supabase
    .from('intake_submissions')
    .update({ status: 'CHANGES_REQUESTED' })
    .eq('id', submissionId)

  if (updateError) {
    throw new Error(updateError.message)
  }
}

export const rejectIntake = async (submissionId: string, reviewerId: string, comment?: string): Promise<void> => {
  const { error: reviewError } = await supabase
    .from('review_actions')
    .insert({
      submission_id: submissionId,
      reviewer_id: reviewerId,
      action: 'REJECT',
      comment: comment
    })

  if (reviewError) {
    throw new Error(reviewError.message)
  }

  const { error: updateError } = await supabase
    .from('intake_submissions')
    .update({ status: 'REJECTED' })
    .eq('id', submissionId)

  if (updateError) {
    throw new Error(updateError.message)
  }
}

// Tasks API
export const getTasks = async (): Promise<Task[]> => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data.map(convertTaskRow)
}

export const getTasksByVHV = async (vhvId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('vhv_id', vhvId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data.map(convertTaskRow)
}

export const createTask = async (taskData: CreateTaskRequest): Promise<Task> => {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: taskData.title,
      description: taskData.description,
      patient_id: taskData.patientId,
      vhv_id: taskData.vhvId,
      priority: taskData.priority,
      due_date: taskData.dueDate
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return convertTaskRow(data)
}

// Assignments API
export const getAssignments = async (): Promise<Assignment[]> => {
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data.map(convertAssignmentRow)
}

export const assignPatient = async (assignmentData: AssignPatientRequest): Promise<Assignment> => {
  const { data, error } = await supabase
    .from('assignments')
    .insert({
      patient_id: assignmentData.patientId,
      vhv_id: assignmentData.vhvId,
      doctor_id: '00000000-0000-0000-0000-000000000002' // Default doctor for now
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return convertAssignmentRow(data)
}

// Emergency Alerts API
export const getEmergencyAlerts = async (): Promise<EmergencyAlert[]> => {
  const { data, error } = await supabase
    .from('emergency_alerts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data.map(convertEmergencyAlertRow)
}

export const createEmergencyAlert = async (alertData: CreateEmergencyAlertRequest): Promise<EmergencyAlert> => {
  const { data, error } = await supabase
    .from('emergency_alerts')
    .insert({
      patient_id: alertData.patientId,
      patient_name: 'Unknown', // Should be fetched from patient data
      triggered_by: '00000000-0000-0000-0000-000000000004', // Current user ID
      priority: alertData.priority,
      description: alertData.description,
      location: alertData.location
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return convertEmergencyAlertRow(data)
}

// Admin API
export const createDoctor = async (doctorData: CreateDoctorRequest): Promise<User> => {
  // First create the user
  const { data: userData, error: userError } = await supabase
    .from('users')
    .insert({
      email: doctorData.email,
      password_hash: doctorData.password, // In production, hash this
      role: 'DOCTOR'
    })
    .select()
    .single()

  if (userError) {
    throw new Error(userError.message)
  }

  // Then create the health worker record
  const { error: hwError } = await supabase
    .from('health_workers')
    .insert({
      user_id: userData.id,
      type: 'DOCTOR',
      license_number: doctorData.licenseNumber
    })

  if (hwError) {
    throw new Error(hwError.message)
  }

  return convertUserRow(userData)
}

export const createVHV = async (vhvData: CreateVHVRequest): Promise<User> => {
  // First create the user
  const { data: userData, error: userError } = await supabase
    .from('users')
    .insert({
      email: vhvData.email,
      password_hash: vhvData.password, // In production, hash this
      role: 'VHV'
    })
    .select()
    .single()

  if (userError) {
    throw new Error(userError.message)
  }

  // Then create the health worker record
  const { error: hwError } = await supabase
    .from('health_workers')
    .insert({
      user_id: userData.id,
      type: 'VHV',
      license_number: `VHV-${Date.now()}` // Generate license number
    })

  if (hwError) {
    throw new Error(hwError.message)
  }

  return convertUserRow(userData)
}

// Dashboard statistics
export const getDashboardStats = async () => {
  const [patientsResult, intakesResult, tasksResult, alertsResult] = await Promise.all([
    supabase.from('patients').select('id', { count: 'exact' }),
    supabase.from('intake_submissions').select('id', { count: 'exact' }),
    supabase.from('tasks').select('id', { count: 'exact' }),
    supabase.from('emergency_alerts').select('id', { count: 'exact' })
  ])

  return {
    totalPatients: patientsResult.count || 0,
    totalSubmissions: intakesResult.count || 0,
    totalTasks: tasksResult.count || 0,
    totalAlerts: alertsResult.count || 0,
    pendingReviews: 0, // Calculate based on status
    totalDoctors: 0, // Calculate from health_workers
    totalVHVs: 0 // Calculate from health_workers
  }
}
