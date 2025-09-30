"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PatientReview } from "./patient-review"
import { StructuredDataForm } from "./structured-data-form"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Eye } from "lucide-react"
import {
  Users,
  CheckCircle,
  FileText,
  MapPin,
  ChevronDown,
  ChevronRight,
  Phone,
  Activity,
  Send,
  Calendar,
  AlertCircle,
  Target,
  Bell,
} from "lucide-react"
import { useState, useCallback, useEffect } from "react"
import { clearCurrentUser, getCurrentUserFromStorage } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { patientsApi, intakesApi, tasksApi, emergencyApi } from "@/lib/api"
import { useApiData } from "@/lib/useApiData"
import { initOfflineStorage, getOfflineFormData } from "@/lib/offline-storage"
import { EmergencyAlerts } from "@/components/emergency/emergency-alerts"
import { UserRole } from "@/lib/types"

export function VHVDashboard() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState(getCurrentUserFromStorage())
  const [expandedPatient, setExpandedPatient] = useState<string | null>(null)

  // Check and fix user ID if it's a hardcoded string
  useEffect(() => {
    if (currentUser?.id && (currentUser.id === 'doctor_id' || currentUser.id === 'admin_id' || currentUser.id === 'vhv_id' || currentUser.id === 'patient_id')) {
      console.log('Detected hardcoded user ID, clearing localStorage and redirecting to login')
      clearCurrentUser()
      router.push('/login')
    }
  }, [currentUser?.id, router])
  const [selectedPatientForReview, setSelectedPatientForReview] = useState<any>(null)
  const [reviewFormData, setReviewFormData] = useState<any>(null)
  const [reviewIntakeId, setReviewIntakeId] = useState<string | null>(null)
  const [showReviewPage, setShowReviewPage] = useState(false)
  const [showDataForm, setShowDataForm] = useState(false)
  const [selectedPatientForForm, setSelectedPatientForForm] = useState<any>(null)
  const [showAddPatientDialog, setShowAddPatientDialog] = useState(false)
  const [completedSections, setCompletedSections] = useState<string[]>([])
  const [currentIntakeId, setCurrentIntakeId] = useState<string | null>(null)
  const [activeEmergencyCount, setActiveEmergencyCount] = useState(0)

  // Initialize offline storage
  useEffect(() => {
    initOfflineStorage().catch(console.error)
  }, [])

  useEffect(() => {
    const fetchEmergencyCount = async () => {
      if (currentUser?.id) {
        try {
          const count = await emergencyApi.getActiveCount(currentUser.id, UserRole.VHV)
          setActiveEmergencyCount(count)
        } catch (error) {
          console.error("[v0] Failed to fetch emergency count:", error)
        }
      }
    }

    fetchEmergencyCount()
    const interval = setInterval(fetchEmergencyCount, 30000) // Poll every 30 seconds
    return () => clearInterval(interval)
  }, [currentUser?.id])

  const [newPatientForm, setNewPatientForm] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    address: "",
    phone: "",
    nationalId: "",
  })

  const getAssignedPatients = useCallback(async () => {
    if (!currentUser?.id) return []

    try {
      // Get patients assigned to this VHV from Supabase
      return await patientsApi.getAssignmentsByVHV(currentUser.id)
    } catch (error) {
      console.error("Error fetching assigned patients:", error)
      return []
    }
  }, [currentUser?.id])

  const {
    data: assignedPatients,
    loading: patientsLoading,
    error: patientsError,
    refetch: refetchPatients,
  } = useApiData(getAssignedPatients, [])
  
  // Debug logging
  console.log('VHVDashboard - currentUser:', currentUser)
  console.log('VHVDashboard - assignedPatients:', assignedPatients)
  console.log('VHVDashboard - patientsLoading:', patientsLoading)
  console.log('VHVDashboard - patientsError:', patientsError)

  const getTasks = useCallback(async () => {
    if (!currentUser?.id) return []
    return tasksApi.getByVHV(currentUser.id)
  }, [currentUser?.id])

  const { data: tasks, loading: tasksLoading, refetch: refetchTasks } = useApiData(getTasks, [])

  // Add new patient functionality
  const handleAddPatient = useCallback(async () => {
    if (newPatientForm.firstName && newPatientForm.lastName && newPatientForm.dob) {
      try {
        await patientsApi.create({
          firstName: newPatientForm.firstName,
          lastName: newPatientForm.lastName,
          dob: newPatientForm.dob,
          address: newPatientForm.address,
          phone: newPatientForm.phone,
          nationalId: newPatientForm.nationalId,
        })

        setNewPatientForm({
          firstName: "",
          lastName: "",
          dob: "",
          address: "",
          phone: "",
          nationalId: "",
        })
        setShowAddPatientDialog(false)
        refetchPatients()
      } catch (error) {
        console.error("Error adding patient:", error)
      }
    }
  }, [newPatientForm, refetchPatients])

  const handleSignOut = () => {
    clearCurrentUser()
    router.push("/")
  }

  const togglePatientExpansion = (patientId: string) => {
    setExpandedPatient(expandedPatient === patientId ? null : patientId)
  }

  const handleOpenDataForm = async (patient: any) => {
    try {
      // Create a new intake submission when starting data collection
      const newIntake = await intakesApi.create(patient.id, currentUser?.id)

      setCurrentIntakeId(newIntake.id)
      setSelectedPatientForForm(patient)
      setShowDataForm(true)
      
      // Refresh assigned patients data to show updated intake status
      refetchPatients()
    } catch (error) {
      console.error("Failed to create intake:", error)
      // Still allow form to open even if API fails
      setSelectedPatientForForm(patient)
      setShowDataForm(true)
    }
  }

  const handleContinueDataForm = async (patient: any, intakeId: string) => {
    try {
      // Load offline data to get completed sections
      const offlineData = await getOfflineFormData(patient.id.toString())
      if (offlineData && offlineData.completedSections) {
        setCompletedSections(offlineData.completedSections)
        console.log("Restored completed sections:", offlineData.completedSections)
      }

      setCurrentIntakeId(intakeId)
      setSelectedPatientForForm(patient)
      setShowDataForm(true)
      
      // Refresh assigned patients data
      refetchPatients()
    } catch (error) {
      console.error("Failed to load offline data:", error)
      // Still allow form to open even if offline data fails
      setCurrentIntakeId(intakeId)
      setSelectedPatientForForm(patient)
      setShowDataForm(true)
    }
  }

  const handleCloseDataForm = () => {
    setShowDataForm(false)
    setSelectedPatientForForm(null)
    setCompletedSections([])
    setCurrentIntakeId(null)
  }

  const handleOpenPatientReview = async (patient: any, intake: any) => {
    try {
      setSelectedPatientForReview(patient)
      setReviewIntakeId(intake.id)
      setShowReviewPage(true)
      
      // Refresh assigned patients data
      refetchPatients()
    } catch (error) {
      console.error("Failed to open patient review:", error)
    }
  }

  const handleFormComplete = async () => {
    if (currentIntakeId) {
      try {
        // Submit the intake for doctor review
        await intakesApi.submit(currentIntakeId)
        console.log("Intake submitted for doctor review")
      } catch (error) {
        console.error("Failed to submit intake:", error)
      }
    }

    handleCloseDataForm()
    refetchPatients()
  }

  const handleLogout = () => {
    clearCurrentUser()
    router.push("/")
  }

  const handleCompleteDataCollection = async (patient: any) => {
    try {
      // Load the saved form data for this patient
      const offlineData = await getOfflineFormData(patient.id.toString())
      console.log("Loading form data for review:", offlineData)

      setSelectedPatientForReview(patient)
      setReviewFormData(offlineData?.formData || null)
      setReviewIntakeId(offlineData?.intakeId || null)
      setShowReviewPage(true)
    } catch (error) {
      console.error("Failed to load form data for review:", error)
      // Show review page anyway, even if we can't load the data
      setSelectedPatientForReview(patient)
      setReviewFormData(null)
      setReviewIntakeId(null)
      setShowReviewPage(true)
    }
  }

  const handleBackFromReview = () => {
    setShowReviewPage(false)
    setSelectedPatientForReview(null)
    setReviewFormData(null)
    setReviewIntakeId(null)
  }

  const handleConfirmSubmission = async () => {
    if (!reviewIntakeId) {
      console.error("No intake ID available for submission")
      alert("Error: No intake data found. Please try again.")
      return
    }

    try {
      console.log("Submitting intake for review:", reviewIntakeId)

      // Submit the intake for doctor review
      await intakesApi.submit(reviewIntakeId)

      console.log("Intake successfully submitted for doctor review")
      alert("Success! Patient data has been submitted for doctor review.")

      // Clean up state
      setShowReviewPage(false)
      setSelectedPatientForReview(null)
      setReviewFormData(null)
      setReviewIntakeId(null)

      // Refresh the patient list to reflect updated status
      refetchPatients()
    } catch (error) {
      console.error("Failed to submit intake:", error)
      alert("Error: Failed to submit data. Please try again.")
    }
  }

  const handleCompleteTask = async (taskId: string) => {
    try {
      await tasksApi.complete(taskId)
      refetchTasks()
    } catch (error) {
      console.error("Failed to complete task:", error)
    }
  }

  // Calculate statistics from real data
  const activePatients = assignedPatients?.filter((assignment: any) => assignment.status === "active") || []
  const completedVisits = assignedPatients?.filter((assignment: any) => assignment.patient?.lastVisit).length || 0
  const pendingReviews = assignedPatients?.filter((assignment: any) => assignment.patient?.status === "pending_review").length || 0

  const pendingTasks = tasks?.filter((t: any) => t.status === "pending").length || 0
  const inProgressTasks = tasks?.filter((t: any) => t.status === "in_progress").length || 0
  const completedTasks = tasks?.filter((t: any) => t.status === "completed").length || 0

  // Debug logging for statistics
  console.log('VHVDashboard - Statistics:')
  console.log('  activePatients:', activePatients.length)
  console.log('  completedVisits:', completedVisits)
  console.log('  pendingReviews:', pendingReviews)
  console.log('  pendingTasks:', pendingTasks)
  console.log('  inProgressTasks:', inProgressTasks)
  console.log('  completedTasks:', completedTasks)

  if (showReviewPage && selectedPatientForReview) {
    return (
      <PatientReview
        patient={selectedPatientForReview}
        formData={reviewFormData}
        onBack={handleBackFromReview}
        onConfirm={handleConfirmSubmission}
      />
    )
  }

  if (showDataForm && selectedPatientForForm) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={handleCloseDataForm}>
                  ← Back to Dashboard
                </Button>
                <div>
                  <h1 className="text-xl font-bold">
                    Data Collection - {selectedPatientForForm.firstName} {selectedPatientForForm.lastName}
                  </h1>
                  <p className="text-muted-foreground">Complete the structured data collection form</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-6">
          <StructuredDataForm
            patient={{
              id: selectedPatientForForm.id,
              name: `${selectedPatientForForm.firstName} ${selectedPatientForForm.lastName}`,
              hospitalNumber: selectedPatientForForm.nationalId,
            }}
            intakeId={currentIntakeId}
            onSectionComplete={(section) => {
              if (!completedSections.includes(section)) {
                setCompletedSections([...completedSections, section])
              }
            }}
            onFormComplete={handleFormComplete}
            completedSections={completedSections}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">VHV Dashboard</h1>
                <p className="text-muted-foreground">Village Health Volunteer Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={showAddPatientDialog} onOpenChange={setShowAddPatientDialog}>
                <DialogTrigger asChild>
                  <Button variant="default">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Patient
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add New Patient</DialogTitle>
                    <DialogDescription>Enter the patient information to create a new record.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="firstName" className="text-right">
                        First Name
                      </Label>
                      <Input
                        id="firstName"
                        className="col-span-3"
                        value={newPatientForm.firstName}
                        onChange={(e) => setNewPatientForm((prev) => ({ ...prev, firstName: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="lastName" className="text-right">
                        Last Name
                      </Label>
                      <Input
                        id="lastName"
                        className="col-span-3"
                        value={newPatientForm.lastName}
                        onChange={(e) => setNewPatientForm((prev) => ({ ...prev, lastName: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="dob" className="text-right">
                        Date of Birth
                      </Label>
                      <Input
                        id="dob"
                        type="date"
                        className="col-span-3"
                        value={newPatientForm.dob}
                        onChange={(e) => setNewPatientForm((prev) => ({ ...prev, dob: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="nationalId" className="text-right">
                        National ID
                      </Label>
                      <Input
                        id="nationalId"
                        className="col-span-3"
                        value={newPatientForm.nationalId}
                        onChange={(e) => setNewPatientForm((prev) => ({ ...prev, nationalId: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="address" className="text-right">
                        Address
                      </Label>
                      <Textarea
                        id="address"
                        className="col-span-3"
                        value={newPatientForm.address}
                        onChange={(e) => setNewPatientForm((prev) => ({ ...prev, address: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="phone" className="text-right">
                        Phone
                      </Label>
                      <Input
                        id="phone"
                        className="col-span-3"
                        value={newPatientForm.phone}
                        onChange={(e) => setNewPatientForm((prev) => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowAddPatientDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddPatient}>Add Patient</Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="outline" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assigned Patients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activePatients.length}</div>
              <p className="text-xs text-muted-foreground">Active assignments</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingTasks}</div>
              <p className="text-xs text-muted-foreground">Tasks to complete</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inProgressTasks}</div>
              <p className="text-xs text-muted-foreground">Tasks in progress</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedTasks}</div>
              <p className="text-xs text-muted-foreground">Tasks completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {tasks && tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0}%
              </div>
              <p className="text-xs text-muted-foreground">Task completion rate</p>
            </CardContent>
          </Card>

          <Card className={activeEmergencyCount > 0 ? "border-red-500 bg-red-50 dark:bg-red-950/20" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Emergency Alerts</CardTitle>
              <Bell
                className={`h-4 w-4 ${activeEmergencyCount > 0 ? "text-red-500 animate-pulse" : "text-gray-500"}`}
              />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${activeEmergencyCount > 0 ? "text-red-600" : ""}`}>
                {activeEmergencyCount}
              </div>
              <p className="text-xs text-muted-foreground">Active emergencies</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="emergencies" className="space-y-4">
          <TabsList>
            <TabsTrigger value="emergencies" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Emergencies
              {activeEmergencyCount > 0 && (
                <Badge className="bg-red-500 text-white text-xs px-1 py-0 min-w-[16px] h-4">
                  {activeEmergencyCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="patients">Assigned Patients</TabsTrigger>
            <TabsTrigger value="tasks">My Tasks</TabsTrigger>
          </TabsList>

          <TabsContent value="emergencies" className="space-y-4">
            <EmergencyAlerts userId={currentUser?.id || "3"} userRole={UserRole.VHV} />
          </TabsContent>

          <TabsContent value="patients" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Assigned Patients</CardTitle>
                <CardDescription>Patients assigned to your care by doctors</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {patientsLoading ? (
                  <div className="text-center py-4">Loading patients...</div>
                ) : patientsError ? (
                  <div className="text-center py-4 text-red-500">Error loading patients</div>
                ) : !assignedPatients || assignedPatients.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">No patients assigned</div>
                ) : (
                  assignedPatients.map((assignment: any) => {
                    const patient = assignment.patient
                    if (!patient) return null
                    
                    return (
                    <Card key={assignment.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="pt-4">
                        <div
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => togglePatientExpansion(assignment.id)}
                        >
                          <div className="flex items-center gap-3">
                            {expandedPatient === assignment.id ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">
                                  {patient.firstName} {patient.lastName}
                                </h3>
                                <Badge variant={assignment.status === "active" ? "default" : "secondary"}>
                                  {assignment.status || "active"}
                                </Badge>
                                {assignment.tasks && assignment.tasks.length > 0 && (
                                  <Badge variant="outline">
                                    {assignment.tasks.length} task{assignment.tasks.length !== 1 ? "s" : ""}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Assigned:{" "}
                                {assignment.assignedAt
                                  ? new Date(assignment.assignedAt).toLocaleDateString()
                                  : "Unknown"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {(() => {
                              // Get the most recent intake for this patient
                              const latestIntake = patient.intakeSubmissions?.[0]
                              const hasActiveIntake =
                                latestIntake && (latestIntake.status === "DRAFT" || latestIntake.status === "SUBMITTED")
                              const hasCompletableIntake =
                                latestIntake &&
                                latestIntake.status === "DRAFT" &&
                                latestIntake.payload &&
                                Object.keys(latestIntake.payload).length > 0

                              if (!hasActiveIntake) {
                                // No active intake - show Start Visit only
                                return (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleOpenDataForm(patient)
                                    }}
                                  >
                                    <FileText className="h-4 w-4 mr-2" />
                                    Start Visit
                                  </Button>
                                )
                              } else if (latestIntake.status === "DRAFT") {
                                // Has draft intake - show both buttons
                                return (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleContinueDataForm(patient, latestIntake.id)
                                      }}
                                    >
                                      <FileText className="h-4 w-4 mr-2" />
                                      Continue Visit
                                    </Button>
                                    {hasCompletableIntake && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleCompleteDataCollection(patient)
                                        }}
                                      >
                                        <Send className="h-4 w-4 mr-2" />
                                        Review & Submit
                                      </Button>
                                    )}
                                  </>
                                )
                              } else {
                                // Intake already submitted - show View Visit button
                                return (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleOpenPatientReview(patient, latestIntake)
                                    }}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Visit
                                  </Button>
                                )
                              }
                            })()}
                          </div>
                        </div>

                        {expandedPatient === patient.id && (
                          <div className="mt-4 pt-4 border-t space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm">{patient.address}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Phone className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm">{patient.phone}</span>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div>
                                  <h5 className="font-medium text-sm">National ID</h5>
                                  <p className="text-sm text-muted-foreground">{patient.nationalId}</p>
                                </div>
                                <div>
                                  <h5 className="font-medium text-sm">Date of Birth</h5>
                                  <p className="text-sm text-muted-foreground">
                                    {patient.dob ? new Date(patient.dob).toLocaleDateString() : "Not specified"}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {assignment.tasks && assignment.tasks.length > 0 && (
                              <div className="mt-4 pt-4 border-t">
                                <h5 className="font-medium text-sm mb-2">Patient Tasks</h5>
                                <div className="space-y-2">
                                  {assignment.tasks.map((task: any) => (
                                    <div
                                      key={task.id}
                                      className="flex items-center justify-between p-2 bg-muted rounded"
                                    >
                                      <div>
                                        <p className="font-medium text-sm">{task.title}</p>
                                        <p className="text-xs text-muted-foreground">{task.description}</p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Badge
                                          variant={
                                            task.status === "completed"
                                              ? "default"
                                              : task.status === "in_progress"
                                                ? "secondary"
                                                : task.priority === "high" || task.priority === "urgent"
                                                  ? "destructive"
                                                  : "outline"
                                          }
                                        >
                                          {task.status}
                                        </Badge>
                                        {task.status !== "completed" && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleCompleteTask(task.id)}
                                          >
                                            Complete
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    )
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>My Tasks</CardTitle>
                <CardDescription>Tasks assigned to you by doctors</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {tasksLoading ? (
                  <div className="text-center py-4">Loading tasks...</div>
                ) : !tasks || tasks.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">No tasks assigned</div>
                ) : (
                  tasks.map((task: any) => {
                    const patient = assignedPatients?.find((p: any) => p.id === task.patientId)
                    return (
                      <Card
                        key={task.id}
                        className={`border-l-4 ${
                          task.status === "COMPLETED"
                            ? "border-l-green-500"
                            : task.status === "IN_PROGRESS"
                              ? "border-l-yellow-500"
                              : task.priority === "HIGH" || task.priority === "URGENT"
                                ? "border-l-red-500"
                                : "border-l-blue-500"
                        }`}
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{task.title}</h3>
                                <Badge
                                  variant={
                                    task.priority === "URGENT"
                                      ? "destructive"
                                      : task.priority === "HIGH"
                                        ? "destructive"
                                        : task.priority === "MEDIUM"
                                          ? "secondary"
                                          : "outline"
                                  }
                                >
                                  {task.priority}
                                </Badge>
                                <Badge
                                  variant={
                                    task.status === "COMPLETED"
                                      ? "default"
                                      : task.status === "IN_PROGRESS"
                                        ? "secondary"
                                        : "outline"
                                  }
                                >
                                  {task.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{task.description}</p>
                              {patient && (
                                <p className="text-sm text-muted-foreground">
                                  Patient: {patient.firstName} {patient.lastName}
                                </p>
                              )}
                              {task.dueDate && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  Due: {new Date(task.dueDate).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {task.status !== "COMPLETED" && (
                                <Button variant="outline" size="sm" onClick={() => handleCompleteTask(task.id)}>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Complete
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
