'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Topic {
  id: string
  name: string
  description: string | null
  parent_id: string | null
  order_index: number
  questions?: { count: number }[]
}

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [parentId, setParentId] = useState('')
  
  useEffect(() => {
    fetchTopics()
  }, [])
  
  async function fetchTopics() {
    try {
      const response = await fetch('/api/topics')
      const data = await response.json()
      setTopics(data.topics || [])
    } catch {
      setError('Failed to load topics')
    } finally {
      setLoading(false)
    }
  }
  
  function openCreateModal() {
    setEditingTopic(null)
    setName('')
    setDescription('')
    setParentId('')
    setShowModal(true)
  }
  
  function openEditModal(topic: Topic) {
    setEditingTopic(topic)
    setName(topic.name)
    setDescription(topic.description || '')
    setParentId(topic.parent_id || '')
    setShowModal(true)
  }
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    
    try {
      const url = editingTopic ? `/api/topics?id=${editingTopic.id}` : '/api/topics'
      const method = editingTopic ? 'PATCH' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || null,
          parent_id: parentId || null,
        }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save topic')
      }
      
      await fetchTopics()
      setShowModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save topic')
    } finally {
      setSaving(false)
    }
  }
  
  async function handleDelete(topicId: string) {
    if (!confirm('Are you sure you want to delete this topic? Questions will be preserved but unassigned.')) {
      return
    }
    
    try {
      const response = await fetch(`/api/topics?id=${topicId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete topic')
      }
      
      await fetchTopics()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete topic')
    }
  }
  
  // Organize topics into a tree structure
  type TopicWithChildren = Topic & { children: TopicWithChildren[] }
  
  function buildTopicTree(topics: Topic[]): TopicWithChildren[] {
    const topicMap = new Map<string, TopicWithChildren>()
    const rootTopics: TopicWithChildren[] = []
    
    // Create map with empty children arrays
    topics.forEach(topic => {
      topicMap.set(topic.id, { ...topic, children: [] })
    })
    
    // Build tree
    topics.forEach(topic => {
      const topicWithChildren = topicMap.get(topic.id)!
      if (topic.parent_id && topicMap.has(topic.parent_id)) {
        topicMap.get(topic.parent_id)!.children.push(topicWithChildren)
      } else {
        rootTopics.push(topicWithChildren)
      }
    })
    
    return rootTopics
  }
  
  const topicTree = buildTopicTree(topics)
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Topics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Organize your questions into topics and subtopics
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
        >
          Create Topic
        </button>
      </div>
      
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}
      
      {topicTree.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm border divide-y">
          {topicTree.map((topic) => (
            <TopicRow
              key={topic.id}
              topic={topic}
              level={0}
              onEdit={openEditModal}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
            />
          </svg>
          <h3 className="mt-4 text-sm font-semibold text-gray-900">No topics yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Create topics to organize your questions by subject area.
          </p>
          <div className="mt-6">
            <button
              onClick={openCreateModal}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
            >
              Create Your First Topic
            </button>
          </div>
        </div>
      )}
      
      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowModal(false)} />
            <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {editingTopic ? 'Edit Topic' : 'Create Topic'}
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Topic Name *
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Algebra, Fractions, Linear Equations"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Describe what this topic covers..."
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Parent Topic
                      </label>
                      <select
                        value={parentId}
                        onChange={(e) => setParentId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">None (Top Level)</option>
                        {topics
                          .filter(t => t.id !== editingTopic?.id)
                          .map(topic => (
                            <option key={topic.id} value={topic.id}>
                              {topic.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:w-auto disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : editingTopic ? 'Save Changes' : 'Create Topic'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type TopicWithChildrenType = Topic & { children: TopicWithChildrenType[] }

interface TopicRowProps {
  topic: TopicWithChildrenType
  level: number
  onEdit: (topic: Topic) => void
  onDelete: (topicId: string) => void
}

function TopicRow({ topic, level, onEdit, onDelete }: TopicRowProps) {
  const [expanded, setExpanded] = useState(true)
  const questionCount = topic.questions?.[0]?.count || 0
  
  return (
    <>
      <div className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
        <div className="flex items-center gap-3" style={{ paddingLeft: `${level * 24}px` }}>
          {topic.children.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className={`h-4 w-4 transform transition-transform ${expanded ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          )}
          {topic.children.length === 0 && <div className="w-4" />}
          
          <div>
            <div className="font-medium text-gray-900">{topic.name}</div>
            {topic.description && (
              <div className="text-sm text-gray-500">{topic.description}</div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {questionCount} question{questionCount !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <Link
              href={`/tutor/generate?topicId=${topic.id}`}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Generate
            </Link>
            <button
              onClick={() => onEdit(topic)}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(topic.id)}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
      
      {expanded && topic.children.map(child => (
        <TopicRow
          key={child.id}
          topic={child}
          level={level + 1}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </>
  )
}
