// =====================================================
// EPA Punjab EnvironmentGPT - System Provider Detail API
// Path-parameter variants for update and soft-delete operations
// =====================================================

import { NextRequest } from 'next/server'
import { handleDelete, handlePut } from '@/app/api/admin/providers/route'

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const body = await request.json()

  const nextRequest = new NextRequest(request.url, {
    method: 'PUT',
    headers: request.headers,
    body: JSON.stringify({ ...body, id }),
  })

  return handlePut(nextRequest)
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const url = new URL(request.url)
  url.searchParams.set('id', id)

  return handleDelete(new NextRequest(url, {
    method: 'DELETE',
    headers: request.headers,
  }))
}
