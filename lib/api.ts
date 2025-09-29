import type { LoginRequest, LoginResponse, CreateEmergencyAlertRequest, UpdateEmergencyAlertRequest } from "./types"
import { mockApi } from "./mock-api"
import * as supabaseApi from "./supabase-api"

// Use environment variable to determine if we should use mock API or Supabase
const USE_MOCK_API = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === ''
const USE_SUPABASE = !!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL !== ''

// Token management functions for compatibility
export const setTokens = (newAccessToken: string, newRefreshToken: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("accessToken", newAccessToken)
    localStorage.setItem("refreshToken", newRefreshToken)
  }
}

export const clearTokens = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("accessToken")
    localStorage.removeItem("refreshToken")
  }
}

export const getAccessToken = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("accessToken")
  }
  return null
}

// API methods using mock API or Supabase
export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    if (USE_SUPABASE) {
      return supabaseApi.login(credentials)
    }
    return mockApi.auth.login(credentials)
  },

  logout: async () => {
    if (USE_SUPABASE) {
      await supabaseApi.logout()
    } else {
      mockApi.auth.logout()
    }
    clearTokens()
    if (typeof window !== "undefined") {
      window.location.href = "/login"
    }
  },

  getCurrentUser: async () => {
    if (USE_SUPABASE) {
      return supabaseApi.getCurrentUser()
    }
    return mockApi.auth.getCurrentUser()
  },
}

export const patientsApi = {
  getAll: async () => {
    if (USE_SUPABASE) {
      return supabaseApi.getPatients()
    }
    return mockApi.patients.getAll()
  },

  getById: async (id: string) => {
    if (USE_SUPABASE) {
      return supabaseApi.getPatientById(id)
    }
    return mockApi.patients.getById(id)
  },

  create: async (patientData: any) => {
    if (USE_SUPABASE) {
      return supabaseApi.createPatient(patientData)
    }
    return mockApi.patients.create(patientData)
  },

  update: async (id: string, updateData: any) => {
    if (USE_SUPABASE) {
      // Supabase update implementation would go here
      throw new Error("Update not implemented for Supabase yet")
    }
    return mockApi.patients.update(id, updateData)
  },

  assignVHV: async (patientId: string, vhvId: string, tasks?: any[]) => {
    if (USE_SUPABASE) {
      return supabaseApi.assignPatient({ patientId, vhvId, tasks })
    }
    return mockApi.patients.assignVHV(patientId, vhvId, tasks)
  },

  getAssignments: async (doctorId: string) => {
    if (USE_SUPABASE) {
      return supabaseApi.getAssignments()
    }
    return mockApi.patients.getAssignments(doctorId)
  },

  getAvailableVHVs: async () => {
    if (USE_SUPABASE) {
      // Supabase implementation would go here
      return []
    }
    return mockApi.patients.getAvailableVHVs()
  },
}

export const intakesApi = {
  create: async (patientId: string) => {
    if (USE_SUPABASE) {
      // Create a draft intake submission
      return supabaseApi.createIntakeSubmission({
        patientId,
        vhvId: '00000000-0000-0000-0000-000000000003', // Current user ID
        status: 'DRAFT' as any,
        payload: {
          visitMeta: {
            visitDateTime: new Date().toISOString(),
            vhvId: '00000000-0000-0000-0000-000000000003',
            locationText: ''
          },
          patientBasics: {
            firstName: '',
            lastName: '',
            dob: '',
            contactPhone: ''
          },
          symptoms: {
            chiefComplaint: '',
            checklist: [],
            onsetDays: 0
          },
          vitals: {},
          chronicConditions: { list: [] },
          riskFlags: {
            isAge60Plus: false,
            isPregnant: false,
            hasChronic: false
          },
          consent: { consentGiven: false }
        },
        attachments: []
      })
    }
    return mockApi.intakes.create(patientId)
  },

  update: async (id: string, payload: any) => {
    if (USE_SUPABASE) {
      return supabaseApi.updateIntakeSubmission(id, { payload })
    }
    return mockApi.intakes.update(id, payload)
  },

  submit: async (id: string) => {
    if (USE_SUPABASE) {
      return supabaseApi.updateIntakeSubmission(id, { status: 'SUBMITTED' as any })
    }
    return mockApi.intakes.submit(id)
  },

  getById: async (id: string) => {
    if (USE_SUPABASE) {
      return supabaseApi.getIntakeSubmissionById(id)
    }
    return mockApi.intakes.getById(id)
  },

  updateAttachments: async (id: string, attachments: string[]) => {
    if (USE_SUPABASE) {
      return supabaseApi.updateIntakeSubmission(id, { attachments })
    }
    return mockApi.intakes.updateAttachments(id, attachments)
  },
}

export const reviewsApi = {
  getQueue: async (status?: string, from?: string) => {
    if (USE_SUPABASE) {
      return supabaseApi.getIntakeSubmissions()
    }
    return mockApi.reviews.getQueue(status, from)
  },

  approve: async (id: string) => {
    if (USE_SUPABASE) {
      return supabaseApi.approveIntake(id, '00000000-0000-0000-0000-000000000002') // Current user ID
    }
    return mockApi.reviews.approve(id)
  },

  requestChanges: async (id: string, comment: string) => {
    if (USE_SUPABASE) {
      return supabaseApi.requestChanges(id, '00000000-0000-0000-0000-000000000002', comment)
    }
    return mockApi.reviews.requestChanges(id, comment)
  },

  reject: async (id: string, comment: string) => {
    if (USE_SUPABASE) {
      return supabaseApi.rejectIntake(id, '00000000-0000-0000-0000-000000000002', comment)
    }
    return mockApi.reviews.reject(id, comment)
  },
}

export const uploadsApi = {
  upload: async (file: File) => {
    return mockApi.uploads.upload(file)
  },
}

export const adminApi = {
  createDoctor: async (doctorData: {
    email: string
    password: string
    firstName: string
    lastName: string
    licenseNumber: string
    specialization: string
    hospitalAffiliation: string
  }) => {
    if (USE_SUPABASE) {
      return supabaseApi.createDoctor(doctorData)
    }
    return mockApi.admin.createDoctor(doctorData)
  },

  createVHV: async (vhvData: {
    email: string
    password: string
    firstName: string
    lastName: string
    region: string
    phoneNumber: string
    trainingLevel: string
  }) => {
    if (USE_SUPABASE) {
      return supabaseApi.createVHV(vhvData)
    }
    return mockApi.admin.createVHV(vhvData)
  },

  getUsers: async () => {
    if (USE_SUPABASE) {
      // Supabase implementation would go here
      return []
    }
    return mockApi.admin.getUsers()
  },

  getDashboardStats: async () => {
    if (USE_SUPABASE) {
      return supabaseApi.getDashboardStats()
    }
    return mockApi.admin.getDashboardStats()
  },

  assignDoctor: async (patientId: string, doctorId: string) => {
    if (USE_SUPABASE) {
      // Supabase implementation would go here
      throw new Error("Assign doctor not implemented for Supabase yet")
    }
    return mockApi.admin.assignDoctor(patientId, doctorId)
  },

  getPatientDoctorAssignments: async () => {
    if (USE_SUPABASE) {
      return supabaseApi.getAssignments()
    }
    return mockApi.admin.getPatientDoctorAssignments()
  },
}

export const tasksApi = {
  getByVHV: async (vhvId: string) => {
    if (USE_SUPABASE) {
      return supabaseApi.getTasksByVHV(vhvId)
    }
    return mockApi.tasks.getByVHV(vhvId)
  },

  getByPatient: async (patientId: string) => {
    if (USE_SUPABASE) {
      // Supabase implementation would go here
      return []
    }
    return mockApi.tasks.getByPatient(patientId)
  },

  create: async (taskData: any) => {
    if (USE_SUPABASE) {
      return supabaseApi.createTask(taskData)
    }
    return mockApi.tasks.create(taskData)
  },

  update: async (id: string, updateData: any) => {
    if (USE_SUPABASE) {
      // Supabase implementation would go here
      throw new Error("Update task not implemented for Supabase yet")
    }
    return mockApi.tasks.update(id, updateData)
  },

  complete: async (id: string) => {
    if (USE_SUPABASE) {
      // Supabase implementation would go here
      throw new Error("Complete task not implemented for Supabase yet")
    }
    return mockApi.tasks.complete(id)
  },

  delete: async (id: string) => {
    if (USE_SUPABASE) {
      // Supabase implementation would go here
      throw new Error("Delete task not implemented for Supabase yet")
    }
    return mockApi.tasks.delete(id)
  },
}

export const emergencyApi = {
  // Create a new emergency alert
  create: async (alertData: CreateEmergencyAlertRequest) => {
    if (USE_SUPABASE) {
      return supabaseApi.createEmergencyAlert(alertData)
    }
    return mockApi.emergency.create(alertData)
  },

  // Get all emergency alerts (for admin/monitoring)
  getAll: async (status?: string, priority?: string) => {
    if (USE_SUPABASE) {
      return supabaseApi.getEmergencyAlerts()
    }
    return mockApi.emergency.getAll(status, priority)
  },

  // Get emergency alerts for a specific patient
  getByPatient: async (patientId: string) => {
    if (USE_SUPABASE) {
      // Supabase implementation would go here
      return []
    }
    return mockApi.emergency.getByPatient(patientId)
  },

  // Get emergency alerts assigned to a doctor
  getByDoctor: async (doctorId: string, status?: string) => {
    if (USE_SUPABASE) {
      // Supabase implementation would go here
      return []
    }
    return mockApi.emergency.getByDoctor(doctorId, status)
  },

  // Get emergency alerts assigned to a VHV
  getByVHV: async (vhvId: string, status?: string) => {
    if (USE_SUPABASE) {
      // Supabase implementation would go here
      return []
    }
    return mockApi.emergency.getByVHV(vhvId, status)
  },

  // Update an emergency alert (acknowledge, resolve, etc.)
  update: async (alertId: string, updateData: UpdateEmergencyAlertRequest) => {
    if (USE_SUPABASE) {
      // Supabase implementation would go here
      throw new Error("Update emergency alert not implemented for Supabase yet")
    }
    return mockApi.emergency.update(alertId, updateData)
  },

  // Acknowledge an emergency alert
  acknowledge: async (alertId: string, responderId: string) => {
    if (USE_SUPABASE) {
      // Supabase implementation would go here
      throw new Error("Acknowledge emergency alert not implemented for Supabase yet")
    }
    return mockApi.emergency.acknowledge(alertId, responderId)
  },

  // Resolve an emergency alert
  resolve: async (alertId: string, responderId: string, notes?: string) => {
    if (USE_SUPABASE) {
      // Supabase implementation would go here
      throw new Error("Resolve emergency alert not implemented for Supabase yet")
    }
    return mockApi.emergency.resolve(alertId, responderId, notes)
  },

  // Cancel an emergency alert
  cancel: async (alertId: string, reason?: string) => {
    if (USE_SUPABASE) {
      // Supabase implementation would go here
      throw new Error("Cancel emergency alert not implemented for Supabase yet")
    }
    return mockApi.emergency.cancel(alertId, reason)
  },

  // Get emergency statistics
  getStats: async (timeframe?: string) => {
    if (USE_SUPABASE) {
      // Supabase implementation would go here
      return { totalAlerts: 0, activeAlerts: 0, averageResponseTime: 0, alertsByPriority: { critical: 0, high: 0, medium: 0 } }
    }
    return mockApi.emergency.getStats(timeframe)
  },

  // Get active emergency alerts count for real-time notifications
  getActiveCount: async (userId: string, userRole: string) => {
    if (USE_SUPABASE) {
      // Supabase implementation would go here
      return 0
    }
    return mockApi.emergency.getActiveCount(userId, userRole)
  },
}

// Default export for compatibility
const apiClient = {
  // Mock axios-like interface for any remaining direct usage
  get: async (url: string) => {
    throw new Error("Use specific API methods instead")
  },
  post: async (url: string, data?: any) => {
    throw new Error("Use specific API methods instead")
  },
  put: async (url: string, data?: any) => {
    throw new Error("Use specific API methods instead")
  },
  patch: async (url: string, data?: any) => {
    throw new Error("Use specific API methods instead")
  },
  delete: async (url: string) => {
    throw new Error("Use specific API methods instead")
  },
}

export default apiClient
