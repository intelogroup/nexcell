import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FileText, Trash2, MoreVertical } from 'lucide-react'
import {
  useWorkbooks,
  useDeleteWorkbook,
  useTemplates,
  useCreateFromTemplate,
} from '../services/workbook.service'
import { showToast, getErrorMessage } from '../lib/toast'

interface WorkbookCardProps {
  workbook: {
    id: string
    name: string
    description: string | null
    updatedAt: string
  }
  onDelete: (id: string) => void
}

function WorkbookCard({ workbook, onDelete }: WorkbookCardProps) {
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div
      className="group relative bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6 cursor-pointer border border-gray-200"
      onClick={() => navigate(`/workbooks/${workbook.id}`)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900 text-lg">{workbook.name}</h3>
          </div>
          
          {workbook.description && (
            <p className="text-sm text-gray-600 mb-3">{workbook.description}</p>
          )}
          
          <p className="text-xs text-gray-500">
            Updated {new Date(workbook.updatedAt).toLocaleDateString()}
          </p>
        </div>

        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-gray-100 rounded"
          onClick={(e) => {
            e.stopPropagation()
            setShowMenu(!showMenu)
          }}
        >
          <MoreVertical className="h-5 w-5 text-gray-600" />
        </button>

        {showMenu && (
          <div className="absolute right-0 top-12 bg-white shadow-lg rounded-md py-1 z-10 border border-gray-200">
            <button
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(workbook.id)
                setShowMenu(false)
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function WorkbookList() {
  const navigate = useNavigate()
  const { data: workbooks, isLoading } = useWorkbooks()
  const { data: templates } = useTemplates()
  const deleteWorkbook = useDeleteWorkbook()
  const createFromTemplate = useCreateFromTemplate()

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)

  const handleDelete = async (id: string) => {
    try {
      await deleteWorkbook.mutateAsync(id)
      setShowDeleteConfirm(null)
      showToast.success('Workbook deleted successfully')
    } catch (error) {
      console.error('Failed to delete workbook:', error)
      showToast.error(`Failed to delete: ${getErrorMessage(error)}`)
    }
  }

  const handleCreateFromTemplate = async (templateId: string, templateName: string) => {
    try {
      const workbook = await createFromTemplate.mutateAsync({
        templateId,
        name: `${templateName} - ${new Date().toLocaleDateString()}`,
      })
      setShowTemplates(false)
      showToast.success('Workbook created successfully!')
      navigate(`/workbooks/${workbook.id}`)
    } catch (error) {
      console.error('Failed to create workbook from template:', error)
      showToast.error(`Failed to create workbook: ${getErrorMessage(error)}`)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Workbooks</h1>
              <p className="mt-1 text-sm text-gray-600">
                {workbooks?.length || 0} workbook{workbooks?.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => setShowTemplates(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Workbook
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {workbooks && workbooks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workbooks.map((workbook) => (
              <WorkbookCard
                key={workbook.id}
                workbook={workbook}
                onDelete={(id) => setShowDeleteConfirm(id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">No workbooks</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new workbook</p>
            <button
              onClick={() => setShowTemplates(true)}
              className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create Workbook
            </button>
          </div>
        )}
      </div>

      {/* Template Selection Modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-900">Choose a Template</h2>
              <p className="text-sm text-gray-600 mt-1">Start with a template or create a blank workbook</p>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates?.map((template: any) => (
                <button
                  key={template.id}
                  onClick={() => handleCreateFromTemplate(template.id, template.name)}
                  className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-left transition-colors"
                >
                  <h3 className="font-semibold text-gray-900">{template.name}</h3>
                  {template.description && (
                    <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                  )}
                  {template.isOfficial && (
                    <span className="inline-block mt-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      Official
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowTemplates(false)}
                className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Workbook?</h3>
            <p className="text-sm text-gray-600 mb-6">
              This action cannot be undone. This will permanently delete your workbook.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
