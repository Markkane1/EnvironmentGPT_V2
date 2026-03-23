'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Upload, FileText } from 'lucide-react'
import { DOCUMENT_CATEGORIES, AUDIENCE_TYPES, SUPPORTED_FILE_TYPES } from '@/lib/constants'
import { toast } from '@/hooks/use-toast'

interface DocumentUploadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploadComplete?: () => void
}

const SUPPORTED_DOCUMENT_ACCEPT = SUPPORTED_FILE_TYPES.documents.join(',')

export function DocumentUploadModal({ 
  open, 
  onOpenChange, 
  onUploadComplete 
}: DocumentUploadModalProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('')
  const [audience, setAudience] = useState('General Public')
  const [isLoading, setIsLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      if (!title) {
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''))
      }
    }
  }

  const handleSubmit = async () => {
    if (!title.trim() || (!file && !content.trim()) || !category) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a title, category, and either content or a supported file',
        variant: 'destructive'
      })
      return
    }

    setIsLoading(true)
    try {
      const response = file
        ? await fetch('/api/upload', {
            method: 'POST',
            body: (() => {
              const formData = new FormData()
              formData.append('file', file)
              formData.append('title', title)
              formData.append('category', category)
              formData.append('audience', audience)
              formData.append('tags', JSON.stringify([]))
              if (content.trim()) {
                formData.append('content', content)
              }
              return formData
            })(),
          })
        : await fetch('/api/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title,
              content,
              category,
              audience,
              tags: []
            })
          })

      const data = await response.json()
      
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Document uploaded successfully'
        })
        onOpenChange(false)
        onUploadComplete?.()
        // Reset form
        setTitle('')
        setContent('')
        setCategory('')
        setAudience('General Public')
        setFile(null)
      } else {
        throw new Error(data.error || 'Failed to upload document')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to upload document',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-green-600" />
            Upload Document
          </DialogTitle>
          <DialogDescription>
            Add a new document to the environmental knowledge base from text, Markdown, PDF, or Word files
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="file">Upload File (optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="file"
                type="file"
                accept={SUPPORTED_DOCUMENT_ACCEPT}
                onChange={handleFileChange}
                className="flex-1"
              />
            </div>
            {file && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FileText className="w-4 h-4" />
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </div>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Audience */}
          <div className="space-y-2">
            <Label htmlFor="audience">Target Audience</Label>
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger>
                <SelectValue placeholder="Select audience" />
              </SelectTrigger>
              <SelectContent>
                {AUDIENCE_TYPES.map((aud) => (
                  <SelectItem key={aud.value} value={aud.value}>
                    {aud.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content">Content {file ? '(optional when a file is selected)' : '*'}</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={file ? 'Optional notes or fallback text for the uploaded file...' : 'Paste or type the document content here...'}
              className="min-h-[200px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isLoading || !title.trim() || (!file && !content.trim()) || !category}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
