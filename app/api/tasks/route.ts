import { NextRequest, NextResponse } from 'next/server'
import { supabaseApi } from '@/lib/supabase-api'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const doctorId = searchParams.get('doctorId')
    const vhvId = searchParams.get('vhvId')
    const patientId = searchParams.get('patientId')

    let result

    if (doctorId) {
      result = await supabaseApi.getTasksByDoctor(doctorId)
    } else if (vhvId) {
      result = await supabaseApi.getTasksByVHV(vhvId)
    } else if (patientId) {
      result = await supabaseApi.getTasksByPatient(patientId)
    } else {
      return NextResponse.json(
        { error: 'doctorId, vhvId, or patientId is required' },
        { status: 400 }
      )
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Get tasks error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get tasks' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, patientId, vhvId, doctorId, priority, dueDate } = body

    if (!title || !patientId || !vhvId || !doctorId) {
      return NextResponse.json(
        { error: 'title, patientId, vhvId, and doctorId are required' },
        { status: 400 }
      )
    }

    const result = await supabaseApi.createTask({
      title,
      description,
      patientId,
      vhvId,
      doctorId,
      priority,
      dueDate
    })

    return NextResponse.json(result)

  } catch (error) {
    console.error('Create task error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create task' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      )
    }

    const result = await supabaseApi.updateTask(id, updateData)
    return NextResponse.json(result)

  } catch (error) {
    console.error('Update task error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update task' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      )
    }

    await supabaseApi.deleteTask(id)
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Delete task error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete task' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const action = searchParams.get('action')

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      )
    }

    if (action === 'complete') {
      const result = await supabaseApi.completeTask(id)
      return NextResponse.json(result)
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Complete task error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to complete task' },
      { status: 500 }
    )
  }
}
