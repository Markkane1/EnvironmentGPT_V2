// =====================================================
// EPA Punjab EnvironmentGPT - Export API
// Phase 4: Export Functionality (TXT, CSV, JSON)
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { formatDate } from '@/lib/utils'

// Export chat history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'
    const sessionId = searchParams.get('sessionId')
    const type = searchParams.get('type') || 'chat' // chat, documents, stats
    
    switch (type) {
      case 'chat':
        return exportChat(sessionId, format)
      case 'documents':
        return exportDocuments(format)
      case 'stats':
        return exportStats(format)
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid export type' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { success: false, error: 'Export failed' },
      { status: 500 }
    )
  }
}

async function exportChat(sessionId: string | null, format: string) {
  if (!sessionId) {
    return NextResponse.json(
      { success: false, error: 'Session ID required for chat export' },
      { status: 400 }
    )
  }

  const session = await db.chatSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' }
      }
    }
  })

  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Session not found' },
      { status: 404 }
    )
  }

  const data = {
    title: session.title || 'Untitled Chat',
    exportedAt: new Date().toISOString(),
    messages: session.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      sources: msg.sources ? JSON.parse(msg.sources) : null,
      timestamp: msg.createdAt.toISOString()
    }))
  }

  if (format === 'json') {
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="chat-${sessionId}.json"`
      }
    })
  }

  if (format === 'csv') {
    const csvLines = ['Role,Content,Timestamp']
    for (const msg of session.messages) {
      const escapedContent = msg.content.replace(/"/g, '""').replace(/\n/g, ' ')
      csvLines.push(`"${msg.role}","${escapedContent}","${msg.createdAt.toISOString()}"`)
    }
    
    return new NextResponse(csvLines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="chat-${sessionId}.csv"`
      }
    })
  }

  if (format === 'txt') {
    let text = `Chat Export: ${session.title || 'Untitled'}\n`
    text += `Exported: ${new Date().toLocaleString()}\n`
    text += '='.repeat(50) + '\n\n'
    
    for (const msg of session.messages) {
      text += `[${msg.role.toUpperCase()}] - ${formatDate(msg.createdAt)}\n`
      text += '-'.repeat(30) + '\n'
      text += msg.content + '\n\n'
    }
    
    return new NextResponse(text, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="chat-${sessionId}.txt"`
      }
    })
  }

  return NextResponse.json(
    { success: false, error: 'Unsupported format' },
    { status: 400 }
  )
}

async function exportDocuments(format: string) {
  const documents = await db.document.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { chunks: true }
      }
    }
  })

  const data = documents.map(doc => ({
    id: doc.id,
    title: doc.title,
    category: doc.category,
    reportSeries: doc.reportSeries,
    year: doc.year,
    audience: doc.audience,
    author: doc.author,
    chunkCount: doc._count.chunks,
    createdAt: doc.createdAt.toISOString()
  }))

  if (format === 'json') {
    return new NextResponse(JSON.stringify({
      exportedAt: new Date().toISOString(),
      total: data.length,
      documents: data
    }, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="documents-export.json"'
      }
    })
  }

  if (format === 'csv') {
    const csvLines = ['ID,Title,Category,Year,Audience,Chunks,Created']
    for (const doc of data) {
      csvLines.push(`"${doc.id}","${doc.title}","${doc.category || ''}","${doc.year || ''}","${doc.audience}","${doc.chunkCount}","${doc.createdAt}"`)
    }
    
    return new NextResponse(csvLines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="documents-export.csv"'
      }
    })
  }

  return NextResponse.json(
    { success: false, error: 'Unsupported format' },
    { status: 400 }
  )
}

async function exportStats(format: string) {
  const [documentCount, sessionCount, messageCount, feedbackCount] = await Promise.all([
    db.document.count({ where: { isActive: true } }),
    db.chatSession.count(),
    db.chatMessage.count(),
    db.feedback.count()
  ])

  const [categoryStats, yearStats] = await Promise.all([
    db.document.groupBy({
      by: ['category'],
      where: { isActive: true },
      _count: { id: true }
    }),
    db.document.groupBy({
      by: ['year'],
      where: { isActive: true, year: { not: null } },
      _count: { id: true }
    })
  ])

  const feedback = await db.feedback.findMany()
  const avgRating = feedback.length > 0
    ? feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length
    : 0

  const data = {
    exportedAt: new Date().toISOString(),
    overview: {
      documents: documentCount,
      sessions: sessionCount,
      messages: messageCount,
      feedback: feedbackCount
    },
    byCategory: categoryStats.reduce((acc, item) => {
      acc[item.category || 'Uncategorized'] = item._count.id
      return acc
    }, {} as Record<string, number>),
    byYear: yearStats.reduce((acc, item) => {
      if (item.year) acc[item.year] = item._count.id
      return acc
    }, {} as Record<number, number>),
    feedbackStats: {
      total: feedbackCount,
      avgRating: Math.round(avgRating * 10) / 10
    }
  }

  if (format === 'json') {
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="stats-export.json"'
      }
    })
  }

  if (format === 'csv') {
    let csv = 'Metric,Value\n'
    csv += `Documents,${documentCount}\n`
    csv += `Sessions,${sessionCount}\n`
    csv += `Messages,${messageCount}\n`
    csv += `Feedback Count,${feedbackCount}\n`
    csv += `Average Rating,${avgRating.toFixed(2)}\n`
    csv += '\nCategory,Count\n'
    for (const [cat, count] of Object.entries(data.byCategory)) {
      csv += `"${cat}",${count}\n`
    }
    
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="stats-export.csv"'
      }
    })
  }

  return NextResponse.json(
    { success: false, error: 'Unsupported format' },
    { status: 400 }
  )
}
