import { DocumentService } from '@/lib/services/document-service'
import { db } from '@/lib/db'

jest.mock('@/lib/db', () => ({
  db: {
    document: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    documentChunk: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}))

describe('DocumentService', () => {
  let service: DocumentService

  const mockDocumentRecord = {
    id: 'doc-1',
    title: 'Air Quality Report',
    content: 'Air quality in Punjab is monitored across districts.',
    source: 'EPA Punjab',
    category: 'Air Quality',
    reportSeries: 'Annual Report',
    year: 2024,
    audience: 'General Public',
    author: 'EPA Punjab',
    tags: JSON.stringify(['air', 'punjab']),
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-02T00:00:00.000Z'),
  }

  beforeEach(() => {
    service = new DocumentService()
    jest.clearAllMocks()
  })

  it('creates a document and stores chunk rows for RAG ingestion', async () => {
    ;(db.document.create as jest.Mock).mockResolvedValue(mockDocumentRecord)
    ;(db.documentChunk.createMany as jest.Mock).mockResolvedValue({ count: 1 })

    const result = await service.createDocument({
      title: 'Air Quality Report',
      content: 'Air quality in Punjab is monitored across districts.',
      source: 'EPA Punjab',
      category: 'Air Quality',
      reportSeries: 'Annual Report',
      year: 2024,
      audience: 'General Public',
      author: 'EPA Punjab',
      tags: ['air', 'punjab'],
    })

    expect(db.document.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: 'Air Quality Report',
        tags: JSON.stringify(['air', 'punjab']),
      }),
    })
    expect(db.documentChunk.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          documentId: 'doc-1',
          chunkIndex: 0,
        }),
      ]),
    })
    expect(result.tags).toEqual(['air', 'punjab'])
  })

  it('returns a mapped document with parsed chunks', async () => {
    ;(db.document.findUnique as jest.Mock).mockResolvedValue({
      ...mockDocumentRecord,
      chunks: [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Air quality in Punjab is monitored.',
          chunkIndex: 0,
          metadata: JSON.stringify({
            startPosition: 0,
            endPosition: 34,
            wordCount: 6,
          }),
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
        },
      ],
    })

    const result = await service.getDocument('doc-1')

    expect(db.document.findUnique).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      include: {
        chunks: {
          orderBy: { chunkIndex: 'asc' },
        },
      },
    })
    expect(result?.chunks?.[0].metadata.wordCount).toBe(6)
    expect(result?.tags).toEqual(['air', 'punjab'])
  })

  it('returns null when updating a missing document', async () => {
    ;(db.document.findUnique as jest.Mock).mockResolvedValue(null)

    const result = await service.updateDocument('missing-doc', {
      title: 'Updated title',
    })

    expect(result).toBeNull()
    expect(db.document.update).not.toHaveBeenCalled()
  })

  it('rebuilds chunks when content changes during an update', async () => {
    ;(db.document.findUnique as jest.Mock).mockResolvedValue(mockDocumentRecord)
    ;(db.document.update as jest.Mock).mockResolvedValue({
      ...mockDocumentRecord,
      content: 'Updated document body.',
    })
    ;(db.documentChunk.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(db.documentChunk.createMany as jest.Mock).mockResolvedValue({ count: 1 })

    const result = await service.updateDocument('doc-1', {
      content: 'Updated document body.',
      tags: ['updated'],
    })

    expect(db.documentChunk.deleteMany).toHaveBeenCalledWith({
      where: { documentId: 'doc-1' },
    })
    expect(db.documentChunk.createMany).toHaveBeenCalled()
    expect(db.document.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: expect.objectContaining({
        content: 'Updated document body.',
        tags: JSON.stringify(['updated']),
      }),
    })
    expect(result?.content).toBe('Updated document body.')
  })

  it('soft-fails deletes when Prisma delete throws', async () => {
    ;(db.document.delete as jest.Mock).mockRejectedValue(new Error('Not found'))

    await expect(service.deleteDocument('doc-1')).resolves.toBe(false)
  })

  it('lists documents with filters, pagination, and mapped tags', async () => {
    ;(db.document.findMany as jest.Mock).mockResolvedValue([mockDocumentRecord])
    ;(db.document.count as jest.Mock).mockResolvedValue(1)

    const result = await service.listDocuments(
      {
        category: 'Air Quality',
        audience: 'General Public',
      },
      2,
      5
    )

    expect(db.document.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        category: 'Air Quality',
        audience: 'General Public',
      },
      skip: 5,
      take: 5,
      orderBy: { createdAt: 'desc' },
    })
    expect(result.total).toBe(1)
    expect(result.page).toBe(2)
    expect(result.documents[0].tags).toEqual(['air', 'punjab'])
  })

  it('filters list results by searchQuery after loading the page slice', async () => {
    ;(db.document.findMany as jest.Mock).mockResolvedValue([
      mockDocumentRecord,
      {
        ...mockDocumentRecord,
        id: 'doc-2',
        title: 'Water Report',
        content: 'Water quality data',
        category: 'Water Resources',
        tags: JSON.stringify(['water']),
      },
    ])
    ;(db.document.count as jest.Mock).mockResolvedValue(2)

    const result = await service.listDocuments({
      searchQuery: 'punjab',
    })

    expect(result.documents).toHaveLength(1)
    expect(result.documents[0].id).toBe('doc-1')
  })

  it('returns relevance-ranked search results', async () => {
    ;(db.document.findMany as jest.Mock).mockResolvedValue([
      mockDocumentRecord,
      {
        ...mockDocumentRecord,
        id: 'doc-2',
        title: 'Noise Pollution Bulletin',
        content: 'Industrial noise data',
        category: 'Industrial Pollution',
        tags: JSON.stringify(['noise']),
      },
    ])
    ;(db.document.count as jest.Mock).mockResolvedValue(2)

    const result = await service.searchDocuments('air quality punjab')

    expect(result.documents).toHaveLength(1)
    expect(result.documents[0].id).toBe('doc-1')
    expect(result.hasMore).toBe(false)
  })

  it('collects category, report series, and tag aggregates from active documents', async () => {
    ;(db.document.findMany as jest.Mock)
      .mockResolvedValueOnce([
        { category: 'Air Quality' },
        { category: 'Water Resources' },
        { category: 'Air Quality' },
      ])
      .mockResolvedValueOnce([
        { reportSeries: 'Annual Report' },
        { reportSeries: 'Policy Brief' },
      ])
      .mockResolvedValueOnce([
        { tags: JSON.stringify(['air', 'punjab']) },
        { tags: JSON.stringify(['water']) },
      ])

    await expect(service.getCategories()).resolves.toEqual(['Air Quality', 'Water Resources'])
    await expect(service.getReportSeries()).resolves.toEqual(['Annual Report', 'Policy Brief'])
    await expect(service.getTags()).resolves.toEqual(['air', 'punjab', 'water'])
  })

  it('builds statistics grouped by category and year', async () => {
    ;(db.document.count as jest.Mock).mockResolvedValue(4)
    ;(db.document.groupBy as jest.Mock)
      .mockResolvedValueOnce([
        { category: 'Air Quality', _count: { category: 2 } },
        { category: 'Water Resources', _count: { category: 1 } },
      ])
      .mockResolvedValueOnce([
        { year: 2024, _count: { year: 2 } },
        { year: 2023, _count: { year: 1 } },
      ])

    const result = await service.getStatistics()

    expect(result).toEqual({
      total: 4,
      byCategory: {
        'Air Quality': 2,
        'Water Resources': 1,
      },
      byYear: {
        2023: 1,
        2024: 2,
      },
    })
  })
})
