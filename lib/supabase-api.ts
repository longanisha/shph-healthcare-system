import { createClient } from '@supabase/supabase-js'
import type { Database } from './supabase'

// Create Supabase client with service role key for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Debug logging
console.log('Supabase API initialization:', {
  supabaseUrl: supabaseUrl ? 'Set' : 'Not set',
  supabaseServiceKey: supabaseServiceKey ? 'Set' : 'Not set',
  isServer: typeof window === 'undefined'
})

const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null
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
  Appointment,
  Visit,
  Medication,
  VitalSigns,
  RescheduleRequest,
  IntakeStatus
} from './types'

// Type definitions for Supabase responses
type PatientRow = Database['public']['Tables']['patients']['Row']
type IntakeRow = Database['public']['Tables']['intake_submissions']['Row']
type HealthWorkerRow = Database['public']['Tables']['health_workers']['Row']
type AssignmentRow = Database['public']['Tables']['assignments']['Row']
type TaskRow = Database['public']['Tables']['tasks']['Row']
type EmergencyAlertRow = Database['public']['Tables']['emergency_alerts']['Row'] & {
  doctor_id?: string
  vhv_id?: string
  patient_name?: string
  triggered_by?: string
}

// Convert Supabase rows to our types

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
  status: row.status as any,
  payload: row.payload,
  attachments: row.attachments,
  createdAt: new Date(row.created_at),
  updatedAt: row.updated_at ? new Date(row.updated_at) : undefined
})

const convertHealthWorkerRow = (row: HealthWorkerRow): HealthWorker => ({
  id: row.id,
  userId: row.user_id,
  type: row.type as any,
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
  description: row.description || '',
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

const convertEmergencyAlertRow = (row: EmergencyAlertRow): EmergencyAlert => {
  // Map database status to frontend enum values
  const statusMap: { [key: string]: string } = {
    'active': 'ACTIVE',
    'acknowledged': 'ACKNOWLEDGED',
    'resolved': 'RESOLVED',
    'cancelled': 'CANCELLED'
  }
  
  // Map database priority to frontend enum values
  const priorityMap: { [key: string]: string } = {
    'high': 'HIGH',
    'medium': 'MEDIUM',
    'low': 'LOW'
  }

  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    triggeredBy: row.triggered_by,
    priority: priorityMap[row.priority] || row.priority as any,
    status: statusMap[row.status] || row.status as any,
    description: row.description || undefined,
    location: row.location || undefined,
    assignedDoctorId: row.doctor_id || undefined,
    assignedVHVId: row.vhv_id || undefined,
    acknowledgedBy: row.doctor_id || row.vhv_id || undefined, // Use doctor_id or vhv_id as acknowledged_by
    acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
    resolvedBy: row.doctor_id || row.vhv_id || undefined, // Use doctor_id or vhv_id as resolved_by
    resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
    responseTime: undefined, // Not available in current schema
    createdAt: new Date(row.created_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined
  }
}

// Authentication API using separate role tables
export const login = async (credentials: LoginRequest): Promise<LoginResponse> => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  try {
        // Use the authenticate_user function to check all role tables
        const { data: authResult, error: authError } = await supabase
          .rpc('authenticate_user', {
            input_email: credentials.email,
            input_password: credentials.password
          })

    if (authError) {
      throw new Error(authError.message)
    }

    if (!authResult || authResult.length === 0) {
      throw new Error('Invalid email or password')
    }

    const userData = authResult[0]
    
    // Create a real Supabase session by signing in with email/password
    // This will create a proper JWT token
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password
    })

    if (signInError) {
      // If Supabase Auth fails, fall back to our custom authentication
      // but still return the user data from our database
      console.warn('Supabase Auth sign-in failed, using custom auth:', signInError.message)
      
      const customToken = `custom_auth_${userData.user_id}_${Date.now()}`
      
      return {
        accessToken: customToken,
        refreshToken: customToken,
        role: userData.user_type as any,
        userId: userData.user_id
      }
    }

    // Return the real Supabase session data
    return {
      accessToken: authData.session?.access_token || '',
      refreshToken: authData.session?.refresh_token || '',
      role: userData.user_type as any,
      userId: userData.user_id
    }
  } catch (error) {
    console.error('Login error:', error)
    throw error
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
  // Since we're not using Supabase Auth anymore, we need to get user from localStorage
  // This is a temporary solution - in a real app, you'd store the user data after login
  if (typeof window === 'undefined') {
    return null
  }

  const storedUser = localStorage.getItem('currentUser')
  if (!storedUser) {
    return null
  }

  try {
    const userData = JSON.parse(storedUser)
    return {
      id: userData.id,
      email: userData.email,
      passwordHash: '', // Not needed for client
      role: userData.role,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  } catch (error) {
    console.error('Error parsing stored user:', error)
    return null
  }
}

// Patients API
export const getPatients = async (): Promise<any[]> => {
  if (!supabase) {
    return []
  }

  try {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Patients query error:', error)
      throw new Error(`Patients query failed: ${error.message}`)
    }

    return data?.map(row => ({
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      name: `${row.first_name} ${row.last_name}`,
      status: row.is_active ? 'active' : 'inactive',
      phone: row.phone,
      nationalId: row.national_id,
      dob: row.dob,
      address: row.address,
      emergencyContactName: row.emergency_contact_name,
      emergencyContactPhone: row.emergency_contact_phone,
      medicalHistory: row.medical_history,
      allergies: row.allergies,
      createdAt: new Date(row.created_at),
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined
    })) || []
  } catch (error) {
    console.error('Error fetching patients:', error)
    throw new Error('Failed to fetch patients')
  }
}

export const getPatientById = async (id: string): Promise<Patient | null> => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

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
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

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
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  const { data, error } = await supabase
    .from('intake_submissions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data?.map(convertIntakeRow)
}

export const getIntakeSubmissionById = async (id: string): Promise<IntakeSubmission | null> => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

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
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

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
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

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
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

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
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

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
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

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
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data?.map(convertTaskRow)
}

export const getTasksByVHV = async (vhvId: string): Promise<Task[]> => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('vhv_id', vhvId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data?.map(convertTaskRow)
}

export const getTasksByPatient = async (patientId: string): Promise<Task[]> => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data?.map(convertTaskRow)
}

export const createTask = async (taskData: CreateTaskRequest): Promise<Task> => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: taskData.title,
      description: taskData.description,
      patient_id: taskData.patientId,
      vhv_id: taskData.vhvId,
      doctor_id: taskData.doctorId,
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

export const getTasksByDoctor = async (doctorId: string): Promise<Task[]> => {
  if (!supabase) {
    return []
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('doctor_id', doctorId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data?.map(convertTaskRow) || []
}

// Patient data API functions
export const getPatientAppointments = async (patientId: string): Promise<Appointment[]> => {
  if (!supabase) {
    return []
  }

  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('patient_id', patientId)
    .order('scheduled_date', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data?.map(convertAppointmentRow) || []
}

export const getPatientVisits = async (patientId: string): Promise<Visit[]> => {
  if (!supabase) {
    return []
  }

  const { data, error } = await supabase
    .from('visits')
    .select('*')
    .eq('patient_id', patientId)
    .order('visit_date', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data?.map(convertVisitRow) || []
}

export const getPatientMedications = async (patientId: string): Promise<Medication[]> => {
  if (!supabase) {
    return []
  }

  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('patient_id', patientId)
    .eq('is_active', true)
    .order('prescribed_date', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data?.map(convertMedicationRow) || []
}

export const getPatientVitalSigns = async (patientId: string): Promise<VitalSigns[]> => {
  if (!supabase) {
    return []
  }

  const { data, error } = await supabase
    .from('vital_signs')
    .select('*')
    .eq('patient_id', patientId)
    .order('recorded_date', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data?.map(convertVitalSignsRow) || []
}

export const createRescheduleRequest = async (requestData: {
  appointmentId: string
  patientId: string
  requestedDate: string
  requestedTime: string
  reason?: string
  preferredAlternatives?: string
}): Promise<RescheduleRequest> => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  // First check if a reschedule request already exists for this appointment
  const { data: existingRequest, error: checkError } = await supabase
    .from('reschedule_requests')
    .select('*')
    .eq('appointment_id', requestData.appointmentId)
    .eq('patient_id', requestData.patientId)
    .single()

  if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
    throw new Error(checkError.message)
  }

  let result
  if (existingRequest) {
    // Update existing request
    const { data, error } = await supabase
      .from('reschedule_requests')
      .update({
        new_date: requestData.requestedDate,
        new_time: requestData.requestedTime,
        reason: requestData.reason,
        status: 'approved', // Auto-approve for testing
        updated_at: new Date().toISOString()
      })
      .eq('id', existingRequest.id)
      .select()
      .single()

    if (error) {
      throw new Error(error.message)
    }
    result = data
  } else {
    // Insert new request
    const { data, error } = await supabase
      .from('reschedule_requests')
      .insert({
        appointment_id: requestData.appointmentId,
        patient_id: requestData.patientId,
        new_date: requestData.requestedDate,
        new_time: requestData.requestedTime,
        reason: requestData.reason,
        status: 'approved' // Auto-approve for testing
      })
      .select()
      .single()

    if (error) {
      throw new Error(error.message)
    }
    result = data
  }

  // Immediately update the appointment with the new date and time
  const { error: updateError } = await supabase
    .from('appointments')
    .update({
      scheduled_date: requestData.requestedDate,
      scheduled_time: requestData.requestedTime,
      updated_at: new Date().toISOString()
    })
    .eq('id', requestData.appointmentId)

  if (updateError) {
    console.error('Failed to update appointment:', updateError.message)
    // Don't throw error here, just log it
  }

  return convertRescheduleRequestRow(result)
}

// Conversion functions
const convertAppointmentRow = (row: any): Appointment => ({
  id: row.id,
  patientId: row.patient_id,
  providerId: row.doctor_id || row.provider_id, // Use doctor_id if available
  providerName: row.provider_name || 'Dr. Provider', // Default provider name
  type: row.appointment_type || row.type || 'Consultation', // Use appointment_type if available
  scheduledDate: row.scheduled_date,
  scheduledTime: row.scheduled_time,
  location: row.location || 'Medical Center', // Default location
  status: row.status as any,
  notes: row.notes,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at)
})

const convertVisitRow = (row: any): Visit => ({
  id: row.id,
  patientId: row.patient_id,
  providerId: row.provider_id,
  providerName: row.provider_name,
  visitDate: row.visit_date,
  diagnosis: row.diagnosis,
  treatment: row.treatment,
  notes: row.notes,
  status: row.status as any,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at)
})

const convertMedicationRow = (row: any): Medication => ({
  id: row.id,
  patientId: row.patient_id,
  name: row.name,
  dosage: row.dosage,
  frequency: row.frequency,
  duration: row.duration,
  prescribedBy: row.prescribed_by,
  prescribedDate: row.prescribed_date,
  remainingDays: row.remaining_days,
  isActive: row.is_active,
  notes: row.notes,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at)
})

const convertVitalSignsRow = (row: any): VitalSigns => ({
  id: row.id,
  patientId: row.patient_id,
  recordedDate: row.recorded_date,
  temperature: row.temperature,
  bloodPressureSystolic: row.blood_pressure_systolic,
  bloodPressureDiastolic: row.blood_pressure_diastolic,
  heartRate: row.heart_rate,
  weight: row.weight,
  height: row.height,
  notes: row.notes,
  recordedBy: row.recorded_by,
  createdAt: new Date(row.created_at)
})

const convertRescheduleRequestRow = (row: any): RescheduleRequest => ({
  id: row.id,
  appointmentId: row.appointment_id,
  patientId: row.patient_id,
  requestedDate: row.new_date,
  requestedTime: row.new_time,
  reason: row.reason,
  preferredAlternatives: row.preferred_alternatives || '', // Handle missing column
  status: row.status as any,
  reviewedBy: row.reviewed_by,
  reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
  createdAt: new Date(row.created_at)
})

export const updateTask = async (id: string, updateData: Partial<Task>): Promise<Task> => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  const { data, error } = await supabase
    .from('tasks')
    .update({
      title: updateData.title,
      description: updateData.description,
      priority: updateData.priority,
      status: updateData.status,
      due_date: updateData.dueDate,
      completed_at: updateData.completedAt
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return convertTaskRow(data)
}

export const completeTask = async (id: string): Promise<Task> => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  const { data, error } = await supabase
    .from('tasks')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return convertTaskRow(data)
}

export const deleteTask = async (id: string): Promise<void> => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
}

// Assignments API
export const getAssignments = async (): Promise<Assignment[]> => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data?.map(convertAssignmentRow)
}

export const getAssignmentsWithDetails = async (doctorId: string) => {
  if (!supabase) {
    return []
  }

  // Get assignments for the specific doctor
  const { data: assignments, error: assignmentsError } = await supabase
    .from('assignments')
    .select('*')
    .eq('doctor_id', doctorId)
    .order('created_at', { ascending: false })

  if (assignmentsError) {
    throw new Error(assignmentsError.message)
  }

  if (!assignments || assignments.length === 0) {
    return []
  }

  // Get patient and VHV details for each assignment
  const enhancedAssignments = await Promise.all(
    assignments.map(async (assignment) => {
      // Get patient details
      const { data: patientData } = await supabase!
        .from('patients')
        .select('*')
        .eq('id', assignment.patient_id)
        .single()

      // Get VHV details
      const { data: vhvData } = await supabase!
        .from('vhvs')
        .select('*')
        .eq('id', assignment.vhv_id)
        .single()

      // Get tasks for this assignment
      const { data: tasksData } = await supabase!
        .from('tasks')
        .select('*')
        .eq('patient_id', assignment.patient_id)
        .eq('vhv_id', assignment.vhv_id)

      return {
        ...convertAssignmentRow(assignment),
        patient: patientData ? convertPatientRow(patientData) : null,
        vhv: vhvData ? {
          id: vhvData.id,
          email: vhvData.email,
          passwordHash: '',
          role: 'VHV' as any,
          createdAt: new Date(vhvData.created_at),
          updatedAt: vhvData.updated_at ? new Date(vhvData.updated_at) : undefined
        } : null,
        tasks: tasksData?.map(convertTaskRow) || []
      }
    })
  )

  return enhancedAssignments
}

export const getAssignmentsByVHV = async (vhvId: string) => {
  if (!supabase) {
    return []
  }

  // Get assignments for the specific VHV with patient details
  const { data: assignments, error: assignmentsError } = await supabase
    .from('assignments')
    .select(`
      *,
      patients:patient_id (
        id,
        first_name,
        last_name,
        email,
        phone,
        address,
        national_id,
        dob,
        is_active
      )
    `)
    .eq('vhv_id', vhvId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (assignmentsError) {
    throw new Error(assignmentsError.message)
  }

  if (!assignments || assignments.length === 0) {
    return []
  }

  // Get tasks and intakes for each assignment
  const enhancedAssignments = await Promise.all(
    assignments.map(async (assignment) => {
      // Get tasks for this assignment
      const { data: tasksData } = await supabase!
        .from('tasks')
        .select('*')
        .eq('patient_id', assignment.patient_id)
        .eq('vhv_id', assignment.vhv_id)

      // Get intake submissions for this patient
      const { data: intakesData } = await supabase!
        .from('intake_submissions')
        .select('*')
        .eq('patient_id', assignment.patient_id)
        .eq('vhv_id', assignment.vhv_id)
        .order('created_at', { ascending: false })

      return {
        ...convertAssignmentRow(assignment),
        patient: assignment.patients ? {
          id: assignment.patients.id,
          firstName: assignment.patients.first_name,
          lastName: assignment.patients.last_name,
          email: assignment.patients.email,
          phone: assignment.patients.phone,
          address: assignment.patients.address,
          nationalId: assignment.patients.national_id,
          dob: assignment.patients.dob,
          isActive: assignment.patients.is_active,
          createdAt: new Date(),
          updatedAt: new Date(),
          intakeSubmissions: intakesData?.map(intake => ({
            id: intake.id,
            patientId: intake.patient_id,
            vhvId: intake.vhv_id,
            status: intake.status,
            payload: intake.payload,
            attachments: intake.attachments,
            createdAt: new Date(intake.created_at),
            updatedAt: new Date(intake.updated_at)
          })) || []
        } : null,
        tasks: tasksData?.map(convertTaskRow) || []
      }
    })
  )

  return enhancedAssignments
}

export const createIntake = async (patientId: string, vhvId?: string) => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  const { data, error } = await supabase
    .from('intake_submissions')
    .insert({
      patient_id: patientId,
      vhv_id: vhvId,
      status: 'DRAFT',
      payload: {
        visitMeta: {
          visitDateTime: new Date().toISOString(),
          vhvId: vhvId || '',
          locationText: ''
        },
        patientBasics: {
          firstName: '',
          lastName: '',
          dob: '',
          contactPhone: ''
        }
      },
      attachments: []
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return {
    id: data.id,
    patientId: data.patient_id,
    vhvId: data.vhv_id,
    status: data.status,
    payload: data.payload,
    attachments: data.attachments,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at)
  }
}

export const getIntakes = async (patientId?: string, vhvId?: string) => {
  if (!supabase) {
    return []
  }

  let query = supabase
    .from('intake_submissions')
    .select('*')
    .order('created_at', { ascending: false })

  if (patientId) {
    query = query.eq('patient_id', patientId)
  }
  if (vhvId) {
    query = query.eq('vhv_id', vhvId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return data?.map(intake => ({
    id: intake.id,
    patientId: intake.patient_id,
    vhvId: intake.vhv_id,
    status: intake.status,
    payload: intake.payload,
    attachments: intake.attachments,
    createdAt: new Date(intake.created_at),
    updatedAt: new Date(intake.updated_at)
  })) || []
}

export const updateIntake = async (id: string, updateData: any) => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  const { data, error } = await supabase
    .from('intake_submissions')
    .update({
      status: updateData.status,
      payload: updateData.payload,
      attachments: updateData.attachments,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return {
    id: data.id,
    patientId: data.patient_id,
    vhvId: data.vhv_id,
    status: data.status,
    payload: data.payload,
    attachments: data.attachments,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at)
  }
}

export const getReviewQueue = async (status?: string, from?: string) => {
  if (!supabase) {
    return []
  }

  // First get the intake submissions
  let query = supabase
    .from('intake_submissions')
    .select('*')
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  } else {
    // Default to SUBMITTED status for pending reviews
    query = query.eq('status', 'SUBMITTED')
  }

  const { data: intakes, error: intakesError } = await query

  if (intakesError) {
    throw new Error(intakesError.message)
  }

  if (!intakes || intakes.length === 0) {
    return []
  }

  // Get unique patient and VHV IDs
  const patientIds = [...new Set(intakes.map(i => i.patient_id))]
  const vhvIds = [...new Set(intakes.map(i => i.vhv_id))]

  // Fetch patients and VHVs separately
  const { data: patients, error: patientsError } = await supabase
    .from('patients')
    .select('id, first_name, last_name, email, phone, address, national_id, dob')
    .in('id', patientIds)

  const { data: vhvs, error: vhvsError } = await supabase
    .from('vhvs')
    .select('id, first_name, last_name, email')
    .in('id', vhvIds)

  if (patientsError) {
    console.error('Error fetching patients:', patientsError)
  }
  if (vhvsError) {
    console.error('Error fetching VHVs:', vhvsError)
  }

  // Create lookup maps
  const patientMap = new Map()
  const vhvMap = new Map()
  
  patients?.forEach(patient => {
    patientMap.set(patient.id, patient)
  })
  
  vhvs?.forEach(vhv => {
    vhvMap.set(vhv.id, vhv)
  })

  // Combine the data
  return intakes.map(intake => ({
    id: intake.id,
    patientId: intake.patient_id,
    vhvId: intake.vhv_id,
    status: intake.status,
    payload: intake.payload,
    attachments: intake.attachments,
    createdAt: new Date(intake.created_at),
    updatedAt: new Date(intake.updated_at),
    patient: patientMap.get(intake.patient_id) ? {
      id: patientMap.get(intake.patient_id).id,
      firstName: patientMap.get(intake.patient_id).first_name,
      lastName: patientMap.get(intake.patient_id).last_name,
      email: patientMap.get(intake.patient_id).email,
      phone: patientMap.get(intake.patient_id).phone,
      address: patientMap.get(intake.patient_id).address,
      nationalId: patientMap.get(intake.patient_id).national_id,
      dob: patientMap.get(intake.patient_id).dob
    } : null,
    vhv: vhvMap.get(intake.vhv_id) ? {
      id: vhvMap.get(intake.vhv_id).id,
      firstName: vhvMap.get(intake.vhv_id).first_name,
      lastName: vhvMap.get(intake.vhv_id).last_name,
      email: vhvMap.get(intake.vhv_id).email
    } : null
  }))
}

export const approveReview = async (id: string) => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  const { data, error } = await supabase
    .from('intake_submissions')
    .update({
      status: 'APPROVED',
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return {
    id: data.id,
    status: data.status,
    updatedAt: new Date(data.updated_at)
  }
}

export const requestChangesReview = async (id: string, comment: string) => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  const { data, error } = await supabase
    .from('intake_submissions')
    .update({
      status: 'CHANGES_REQUESTED',
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return {
    id: data.id,
    status: data.status,
    comment,
    updatedAt: new Date(data.updated_at)
  }
}


export const assignPatient = async (assignmentData: AssignPatientRequest): Promise<Assignment> => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  if (!assignmentData.doctorId) {
    throw new Error('Doctor ID is required for assignment')
  }

  // Use upsert to handle duplicate assignments gracefully
  const { data, error } = await supabase
    .from('assignments')
    .upsert({
      patient_id: assignmentData.patientId,
      vhv_id: assignmentData.vhvId,
      doctor_id: assignmentData.doctorId,
      status: 'active',
      assigned_at: new Date().toISOString()
    }, {
      onConflict: 'patient_id,vhv_id',
      ignoreDuplicates: false
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return convertAssignmentRow(data)
}

// Emergency Alerts API
export const getEmergencyAlerts = async (status?: string, priority?: string): Promise<EmergencyAlert[]> => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  let query = supabase
    .from('emergency_alerts')
    .select('*')
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }
  if (priority) {
    query = query.eq('priority', priority)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return data?.map(convertEmergencyAlertRow) || []
}

export const getEmergencyAlertsByPatient = async (patientId: string): Promise<EmergencyAlert[]> => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  const { data, error } = await supabase
    .from('emergency_alerts')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data?.map(convertEmergencyAlertRow) || []
}

export const getEmergencyAlertsByDoctor = async (doctorId: string, status?: string): Promise<EmergencyAlert[]> => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  // First get all patients assigned to this doctor
  const { data: assignments, error: assignmentsError } = await supabase
    .from('assignments')
    .select('patient_id')
    .eq('doctor_id', doctorId)

  if (assignmentsError) {
    throw new Error(`Failed to get doctor assignments: ${assignmentsError.message}`)
  }

  const patientIds = assignments?.map(a => a.patient_id) || []
  
  if (patientIds.length === 0) {
    return []
  }

  // Then get all emergency alerts for these patients
  let query = supabase
    .from('emergency_alerts')
    .select('*')
    .in('patient_id', patientIds)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return data?.map(convertEmergencyAlertRow) || []
}

export const getEmergencyAlertsByVHV = async (vhvId: string, status?: string): Promise<EmergencyAlert[]> => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  // First get all patients assigned to this VHV
  const { data: assignments, error: assignmentsError } = await supabase
    .from('assignments')
    .select('patient_id')
    .eq('vhv_id', vhvId)

  if (assignmentsError) {
    throw new Error(`Failed to get VHV assignments: ${assignmentsError.message}`)
  }

  const patientIds = assignments?.map(a => a.patient_id) || []
  
  if (patientIds.length === 0) {
    return []
  }

  // Then get all emergency alerts for these patients
  let query = supabase
    .from('emergency_alerts')
    .select('*')
    .in('patient_id', patientIds)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return data?.map(convertEmergencyAlertRow) || []
}

export const createEmergencyAlert = async (alertData: CreateEmergencyAlertRequest): Promise<EmergencyAlert> => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  // Convert priority to lowercase to match database constraints
  const priorityMap: { [key: string]: string } = {
    'CRITICAL': 'high', // Map CRITICAL to high since database doesn't have critical
    'HIGH': 'high',
    'MEDIUM': 'medium',
    'LOW': 'low'
  }
  
  const dbPriority = priorityMap[alertData.priority] || alertData.priority.toLowerCase()

  // Find the doctor and VHV assigned to this patient
  let assignedDoctorId: string | null = null
  let assignedVHVId: string | null = null

  try {
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('doctor_id, vhv_id')
      .eq('patient_id', alertData.patientId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!assignmentError && assignment) {
      assignedDoctorId = assignment.doctor_id
      assignedVHVId = assignment.vhv_id
      console.log(`[v0] Found assignment for patient ${alertData.patientId}: doctor=${assignedDoctorId}, vhv=${assignedVHVId}`)
    } else {
      console.log(`[v0] No active assignment found for patient ${alertData.patientId}`)
    }
  } catch (error) {
    console.log(`[v0] Error finding assignment for patient ${alertData.patientId}:`, error)
  }

  const { data, error } = await supabase
    .from('emergency_alerts')
    .insert({
      patient_id: alertData.patientId,
      doctor_id: assignedDoctorId,
      vhv_id: assignedVHVId,
      priority: dbPriority,
      status: 'active', // Default status
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

export const updateEmergencyAlert = async (id: string, updateData: UpdateEmergencyAlertRequest): Promise<EmergencyAlert> => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  const { data, error } = await supabase
    .from('emergency_alerts')
    .update({
      priority: updateData.priority,
      status: updateData.status,
      description: updateData.description,
      location: updateData.location,
      doctor_id: updateData.assignedDoctorId,
      vhv_id: updateData.assignedVHVId
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return convertEmergencyAlertRow(data)
}

export const acknowledgeEmergencyAlert = async (id: string, responderId: string): Promise<EmergencyAlert> => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  // Check if responderId is a doctor or VHV
  const { data: doctor, error: doctorError } = await supabase
    .from('doctors')
    .select('id')
    .eq('id', responderId)
    .single()

  const { data: vhv, error: vhvError } = await supabase
    .from('vhvs')
    .select('id')
    .eq('id', responderId)
    .single()

  let updateData: any = {
    status: 'acknowledged', // Use lowercase for database
    acknowledged_at: new Date().toISOString()
  }

  if (doctor && !doctorError) {
    // Responder is a doctor
    updateData.doctor_id = responderId
  } else if (vhv && !vhvError) {
    // Responder is a VHV
    updateData.vhv_id = responderId
  } else {
    throw new Error('Invalid responder ID - not found in doctors or VHVs table')
  }

  const { data, error } = await supabase
    .from('emergency_alerts')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return convertEmergencyAlertRow(data)
}

export const resolveEmergencyAlert = async (id: string, responderId: string, notes?: string): Promise<EmergencyAlert> => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  // Check if responderId is a doctor or VHV
  const { data: doctor, error: doctorError } = await supabase
    .from('doctors')
    .select('id')
    .eq('id', responderId)
    .single()

  const { data: vhv, error: vhvError } = await supabase
    .from('vhvs')
    .select('id')
    .eq('id', responderId)
    .single()

  // First get the current alert to preserve description
  const { data: currentAlert } = await supabase
    .from('emergency_alerts')
    .select('description')
    .eq('id', id)
    .single()

  let updateData: any = {
    status: 'resolved', // Use lowercase for database
    resolved_at: new Date().toISOString(),
    description: notes ? `${currentAlert?.description || ''}\n\nResolution Notes: ${notes}` : currentAlert?.description
  }

  if (doctor && !doctorError) {
    // Responder is a doctor
    updateData.doctor_id = responderId
  } else if (vhv && !vhvError) {
    // Responder is a VHV
    updateData.vhv_id = responderId
  } else {
    throw new Error('Invalid responder ID - not found in doctors or VHVs table')
  }

  const { data, error } = await supabase
    .from('emergency_alerts')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return convertEmergencyAlertRow(data)
}

export const cancelEmergencyAlert = async (id: string, reason?: string): Promise<EmergencyAlert> => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  // First get the current alert to preserve description
  const { data: currentAlert } = await supabase
    .from('emergency_alerts')
    .select('description')
    .eq('id', id)
    .single()

  const { data, error } = await supabase
    .from('emergency_alerts')
    .update({
      status: 'cancelled', // Use lowercase for database
      description: reason ? `${currentAlert?.description || ''}\n\nCancellation Reason: ${reason}` : currentAlert?.description
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return convertEmergencyAlertRow(data)
}

export const getEmergencyStats = async (timeframe?: string) => {
  if (!supabase) {
    return { totalAlerts: 0, activeAlerts: 0, averageResponseTime: 0, alertsByPriority: { critical: 0, high: 0, medium: 0 } }
  }

  const { data, error } = await supabase
    .from('emergency_alerts')
    .select('*')

  if (error) {
    throw new Error(error.message)
  }

  const alerts = data || []
  const activeAlerts = alerts.filter(alert => alert.status === 'ACTIVE').length
  const criticalAlerts = alerts.filter(alert => alert.priority === 'CRITICAL').length
  const highAlerts = alerts.filter(alert => alert.priority === 'HIGH').length
  const mediumAlerts = alerts.filter(alert => alert.priority === 'MEDIUM').length

  return {
    totalAlerts: alerts.length,
    activeAlerts,
    averageResponseTime: 0, // Would need to calculate from response times
    alertsByPriority: {
      critical: criticalAlerts,
      high: highAlerts,
      medium: mediumAlerts
    }
  }
}

// Admin API - Note: These functions require server-side implementation
// For now, we'll provide placeholder implementations that throw errors
export const createDoctor = async (doctorData: CreateDoctorRequest): Promise<User> => {
  throw new Error('createDoctor requires server-side implementation with service role key. Please create users manually in Supabase Dashboard.')
}

export const createVHV = async (vhvData: CreateVHVRequest): Promise<User> => {
  throw new Error('createVHV requires server-side implementation with service role key. Please create users manually in Supabase Dashboard.')
}

// Get admins
export const getAdmins = async (): Promise<any[]> => {
  if (!supabase) {
    return []
  }

  try {
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Admins query error:', error)
      throw new Error(`Admins query failed: ${error.message}`)
    }

    return data?.map(row => ({
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      name: `${row.first_name} ${row.last_name}`,
      status: row.is_active ? 'active' : 'inactive',
      phone: row.phone,
      createdAt: new Date(row.created_at),
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined
    })) || []
  } catch (error) {
    console.error('Error fetching admins:', error)
    throw new Error('Failed to fetch admins')
  }
}

// Get doctors
export const getDoctors = async (): Promise<any[]> => {
  if (!supabase) {
    return []
  }

  try {
    const { data, error } = await supabase
      .from('doctors')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Doctors query error:', error)
      throw new Error(`Doctors query failed: ${error.message}`)
    }

    return data?.map(row => ({
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      name: `${row.first_name} ${row.last_name}`,
      status: row.is_active ? 'active' : 'inactive',
      phone: row.phone,
      licenseNumber: row.license_number,
      specialization: row.specialization,
      experienceYears: row.experience_years,
      createdAt: new Date(row.created_at),
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined
    })) || []
  } catch (error) {
    console.error('Error fetching doctors:', error)
    throw new Error('Failed to fetch doctors')
  }
}

// Get VHVs
export const getVHVs = async (): Promise<any[]> => {
  if (!supabase) {
    return []
  }

  try {
    const { data, error } = await supabase
      .from('vhvs')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('VHVs query error:', error)
      throw new Error(`VHVs query failed: ${error.message}`)
    }

    return data?.map(row => ({
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      name: `${row.first_name} ${row.last_name}`,
      status: row.is_active ? 'active' : 'inactive',
      phone: row.phone,
      licenseNumber: row.license_number,
      specialization: row.specialization,
      experienceYears: row.experience_years,
      createdAt: new Date(row.created_at),
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined
    })) || []
  } catch (error) {
    console.error('Error fetching VHVs:', error)
    throw new Error('Failed to fetch VHVs')
  }
}

// Get all users from all role tables (deprecated - use individual functions instead)
export const getUsers = async (): Promise<User[]> => {
  if (!supabase) {
    return []
  }

  try {
    console.log('Getting users from all role tables...')
    
    // Get users from all role tables
    const [adminsResult, doctorsResult, vhvsResult, patientsResult] = await Promise.all([
      supabase.from('admins').select('*').order('created_at', { ascending: false }),
      supabase.from('doctors').select('*').order('created_at', { ascending: false }),
      supabase.from('vhvs').select('*').order('created_at', { ascending: false }),
      supabase.from('patients').select('*').order('created_at', { ascending: false })
    ])

    console.log('Query results:', {
      admins: { data: adminsResult.data?.length, error: adminsResult.error },
      doctors: { data: doctorsResult.data?.length, error: doctorsResult.error },
      vhvs: { data: vhvsResult.data?.length, error: vhvsResult.error },
      patients: { data: patientsResult.data?.length, error: patientsResult.error }
    })

    // Check for errors in any of the queries
    if (adminsResult.error) {
      console.error('Admins query error:', adminsResult.error)
      throw new Error(`Admins query failed: ${adminsResult.error.message}`)
    }
    if (doctorsResult.error) {
      console.error('Doctors query error:', doctorsResult.error)
      throw new Error(`Doctors query failed: ${doctorsResult.error.message}`)
    }
    if (vhvsResult.error) {
      console.error('VHVs query error:', vhvsResult.error)
      throw new Error(`VHVs query failed: ${vhvsResult.error.message}`)
    }
    if (patientsResult.error) {
      console.error('Patients query error:', patientsResult.error)
      throw new Error(`Patients query failed: ${patientsResult.error.message}`)
    }

    const allUsers: User[] = []

    // Convert each role type to User format with additional fields for display
    if (adminsResult.data) {
      allUsers.push(...adminsResult.data.map(row => ({
        id: row.id,
        email: row.email,
        passwordHash: '',
        role: 'ADMIN' as any,
        firstName: row.first_name,
        lastName: row.last_name,
        name: `${row.first_name} ${row.last_name}`,
        status: row.is_active ? 'active' : 'inactive',
        createdAt: new Date(row.created_at),
        updatedAt: row.updated_at ? new Date(row.updated_at) : undefined
      })))
    }

    if (doctorsResult.data) {
      allUsers.push(...doctorsResult.data.map(row => ({
        id: row.id,
        email: row.email,
        passwordHash: '',
        role: 'DOCTOR' as any,
        firstName: row.first_name,
        lastName: row.last_name,
        name: `${row.first_name} ${row.last_name}`,
        status: row.is_active ? 'active' : 'inactive',
        licenseNumber: row.license_number,
        specialization: row.specialization,
        createdAt: new Date(row.created_at),
        updatedAt: row.updated_at ? new Date(row.updated_at) : undefined
      })))
    }

    if (vhvsResult.data) {
      allUsers.push(...vhvsResult.data.map(row => ({
        id: row.id,
        email: row.email,
        passwordHash: '',
        role: 'VHV' as any,
        firstName: row.first_name,
        lastName: row.last_name,
        name: `${row.first_name} ${row.last_name}`,
        status: row.is_active ? 'active' : 'inactive',
        licenseNumber: row.license_number,
        specialization: row.specialization,
        createdAt: new Date(row.created_at),
        updatedAt: row.updated_at ? new Date(row.updated_at) : undefined
      })))
    }

    if (patientsResult.data) {
      allUsers.push(...patientsResult.data.map(row => ({
        id: row.id,
        email: row.email,
        passwordHash: '',
        role: 'PATIENT' as any,
        firstName: row.first_name,
        lastName: row.last_name,
        name: `${row.first_name} ${row.last_name}`,
        status: row.is_active ? 'active' : 'inactive',
        nationalId: row.national_id,
        dob: row.dob,
        createdAt: new Date(row.created_at),
        updatedAt: row.updated_at ? new Date(row.updated_at) : undefined
      })))
    }

    return allUsers
  } catch (error) {
    console.error('Error fetching users:', error)
    throw new Error('Failed to fetch users')
  }
}

// Get available VHVs for task assignment
export const getAvailableVHVs = async (): Promise<User[]> => {
  if (!supabase) {
    return []
  }

  const { data, error } = await supabase
    .from('vhvs')
    .select('*')
    .eq('is_active', true)
    .order('email', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data?.map(row => ({
    id: row.id,
    email: row.email,
    passwordHash: '',
    role: 'VHV' as any,
    createdAt: new Date(row.created_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined
  })) || []
}

// Dashboard statistics
export const getDashboardStats = async () => {
  if (!supabase) {
    return {
      totalUsers: 0,
      totalDoctors: 0,
      totalVHVs: 0,
      totalPatients: 0,
      pendingReviews: 0,
    }
  }

  try {
    console.log('Getting dashboard stats from all tables...')
    
    // Get counts from all role tables
    const [adminsResult, doctorsResult, vhvsResult, patientsResult, tasksResult, alertsResult] = await Promise.all([
      supabase.from('admins').select('id', { count: 'exact' }),
      supabase.from('doctors').select('id', { count: 'exact' }),
      supabase.from('vhvs').select('id', { count: 'exact' }),
      supabase.from('patients').select('id', { count: 'exact' }),
      supabase.from('tasks').select('id', { count: 'exact' }),
      supabase.from('emergency_alerts').select('id', { count: 'exact' })
    ])

    console.log('Stats query results:', {
      admins: { count: adminsResult.count, error: adminsResult.error },
      doctors: { count: doctorsResult.count, error: doctorsResult.error },
      vhvs: { count: vhvsResult.count, error: vhvsResult.error },
      patients: { count: patientsResult.count, error: patientsResult.error },
      tasks: { count: tasksResult.count, error: tasksResult.error },
      alerts: { count: alertsResult.count, error: alertsResult.error }
    })

    // Check for errors in any of the queries
    const errors = []
    if (adminsResult.error) errors.push(`Admins: ${adminsResult.error.message}`)
    if (doctorsResult.error) errors.push(`Doctors: ${doctorsResult.error.message}`)
    if (vhvsResult.error) errors.push(`VHVs: ${vhvsResult.error.message}`)
    if (patientsResult.error) errors.push(`Patients: ${patientsResult.error.message}`)
    if (tasksResult.error) errors.push(`Tasks: ${tasksResult.error.message}`)
    if (alertsResult.error) errors.push(`Alerts: ${alertsResult.error.message}`)

    if (errors.length > 0) {
      console.error('Stats query errors:', errors)
      throw new Error(`Stats queries failed: ${errors.join(', ')}`)
    }

    const totalAdmins = adminsResult.count || 0
    const totalDoctors = doctorsResult.count || 0
    const totalVHVs = vhvsResult.count || 0
    const totalPatients = patientsResult.count || 0
    const totalUsers = totalAdmins + totalDoctors + totalVHVs + totalPatients

    const stats = {
      totalUsers,
      totalDoctors,
      totalVHVs,
      totalPatients,
      totalTasks: tasksResult.count || 0,
      totalAlerts: alertsResult.count || 0,
      pendingReviews: 0, // Could be calculated from tasks with pending status
    }

    console.log('Dashboard stats calculated:', stats)
    return stats
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return {
      totalUsers: 0,
      totalDoctors: 0,
      totalVHVs: 0,
      totalPatients: 0,
      pendingReviews: 0,
    }
  }
}

// Export all functions as supabaseApi object
export const supabaseApi = {
  // Authentication
  login,
  getCurrentUser,
  
  // Patient management
  getPatients,
  getPatientById,
  createPatient,
  assignPatient,
  getAssignments,
  getAssignmentsWithDetails,
  getAssignmentsByVHV,
  
  // Intake management
  createIntake,
  getIntakes,
  updateIntake,
  
  // Review management
  getReviewQueue,
  approveReview,
  requestChangesReview,
  
  // Task management
  getTasks,
  getTasksByVHV,
  getTasksByPatient,
  getTasksByDoctor,
  createTask,
  updateTask,
  completeTask,
  deleteTask,
  
  // Emergency alerts
  createEmergencyAlert,
  getEmergencyAlerts,
  getEmergencyAlertsByPatient,
  getEmergencyAlertsByDoctor,
  getEmergencyAlertsByVHV,
  updateEmergencyAlert,
  acknowledgeEmergencyAlert,
  resolveEmergencyAlert,
  cancelEmergencyAlert,
  getEmergencyStats,
  
  // User management
  getUsers,
  getAdmins,
  getDoctors,
  getVHVs,
  getAvailableVHVs,
  
  // Dashboard stats
  getDashboardStats,
  
  // Patient data
  getPatientAppointments,
  getPatientVisits,
  getPatientMedications,
  getPatientVitalSigns,
  createRescheduleRequest,
  
  // User creation (placeholder functions)
  createDoctor,
  createVHV
}
