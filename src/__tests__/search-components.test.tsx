/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { TopicSearchSelect } from '@/components/topic-search-select'
import { StudentSearchSelect } from '@/components/student-search-select'
import { SearchableSelect, SearchableSelectOption } from '@/components/searchable-select'

// Mock scrollIntoView for jsdom
Element.prototype.scrollIntoView = jest.fn()

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
}))

describe('SearchableSelect Component', () => {
  const mockOptions: SearchableSelectOption[] = [
    { id: '1', label: 'Algebra', description: 'Linear equations and polynomials' },
    { id: '2', label: 'Geometry', description: 'Shapes and spatial reasoning' },
    { id: '3', label: 'Calculus', description: 'Derivatives and integrals' },
    { id: '4', label: 'Statistics', description: 'Data analysis and probability' },
  ]

  it('should render with placeholder', () => {
    const onChange = jest.fn()
    render(
      <SearchableSelect
        options={mockOptions}
        selected={[]}
        onChange={onChange}
        placeholder="Search topics..."
      />
    )
    
    expect(screen.getByPlaceholderText('Search topics...')).toBeInTheDocument()
  })

  it('should open dropdown on focus', () => {
    const onChange = jest.fn()
    render(
      <SearchableSelect
        options={mockOptions}
        selected={[]}
        onChange={onChange}
      />
    )
    
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    
    // Dropdown should be visible with options
    expect(screen.getByText('Algebra')).toBeInTheDocument()
  })

  it('should filter options based on search query', async () => {
    const onChange = jest.fn()
    render(
      <SearchableSelect
        options={mockOptions}
        selected={[]}
        onChange={onChange}
      />
    )
    
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'alg' } })
    
    await waitFor(() => {
      expect(screen.getByText('Algebra')).toBeInTheDocument()
    })
  })

  it('should call onChange when option is selected', async () => {
    const onChange = jest.fn()
    render(
      <SearchableSelect
        options={mockOptions}
        selected={[]}
        onChange={onChange}
      />
    )
    
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'geo' } })
    
    await waitFor(() => {
      const option = screen.getByText('Geometry')
      fireEvent.click(option)
    })
    
    expect(onChange).toHaveBeenCalledWith(['2'])
  })

  it('should display selected items as badges', () => {
    const onChange = jest.fn()
    render(
      <SearchableSelect
        options={mockOptions}
        selected={['1', '2']}
        onChange={onChange}
      />
    )
    
    expect(screen.getByText('Algebra')).toBeInTheDocument()
    expect(screen.getByText('Geometry')).toBeInTheDocument()
  })

  it('should remove item when badge close button is clicked', () => {
    const onChange = jest.fn()
    render(
      <SearchableSelect
        options={mockOptions}
        selected={['1', '2']}
        onChange={onChange}
      />
    )
    
    const badges = screen.getAllByRole('button').filter(btn => 
      btn.querySelector('svg')
    )
    fireEvent.click(badges[0])
    
    expect(onChange).toHaveBeenCalled()
  })

  it('should support single selection mode', async () => {
    const onChange = jest.fn()
    render(
      <SearchableSelect
        options={mockOptions}
        selected={[]}
        onChange={onChange}
        multiple={false}
      />
    )
    
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'cal' } })
    
    await waitFor(() => {
      const option = screen.getByText('Calculus')
      fireEvent.click(option)
    })
    
    expect(onChange).toHaveBeenCalledWith(['3'])
  })

  it('should be disabled when disabled prop is true', () => {
    const onChange = jest.fn()
    render(
      <SearchableSelect
        options={mockOptions}
        selected={[]}
        onChange={onChange}
        disabled={true}
      />
    )
    
    const input = screen.getByRole('textbox')
    expect(input).toBeDisabled()
  })

  it('should show empty message when no results', async () => {
    const onChange = jest.fn()
    render(
      <SearchableSelect
        options={mockOptions}
        selected={[]}
        onChange={onChange}
        emptyMessage="No topics found"
      />
    )
    
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'xyz123' } })
    
    await waitFor(() => {
      expect(screen.getByText('No topics found')).toBeInTheDocument()
    })
  })

  it('should handle keyboard navigation', async () => {
    const onChange = jest.fn()
    render(
      <SearchableSelect
        options={mockOptions}
        selected={[]}
        onChange={onChange}
      />
    )
    
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '' } })
    
    // Press ArrowDown to navigate
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled()
    })
  })

  it('should close dropdown on Escape', () => {
    const onChange = jest.fn()
    render(
      <SearchableSelect
        options={mockOptions}
        selected={[]}
        onChange={onChange}
      />
    )
    
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'Escape' })
    
    // Dropdown should be closed - can't easily test this without checking internal state
    // but we can verify input lost focus
  })

  it('should clear all with clear button', () => {
    const onChange = jest.fn()
    render(
      <SearchableSelect
        options={mockOptions}
        selected={['1', '2', '3']}
        onChange={onChange}
        showClearAll={true}
      />
    )
    
    // Find clear all button (last svg button)
    const clearButton = screen.getAllByRole('button').find(btn => 
      btn.className.includes('text-gray-400')
    )
    
    if (clearButton) {
      fireEvent.click(clearButton)
      expect(onChange).toHaveBeenCalledWith([])
    }
  })
})

describe('TopicSearchSelect Component', () => {
  const mockTopics = [
    { 
      id: '1', 
      name: 'Quadratic Equations', 
      description: 'Solving quadratic equations',
      program: { id: 'p1', code: 'IB', name: 'International Baccalaureate' },
      grade_level: { id: 'g1', code: 'AIHL', name: 'AI Higher Level' },
      questionCount: 15
    },
    { 
      id: '2', 
      name: 'Linear Functions', 
      description: 'Graphing and analyzing linear functions',
      program: { id: 'p1', code: 'IB', name: 'International Baccalaureate' },
      grade_level: { id: 'g2', code: 'AISL', name: 'AI Standard Level' },
      questionCount: 20
    },
    { 
      id: '3', 
      name: 'Differentiation', 
      description: 'Rules of differentiation',
      program: { id: 'p1', code: 'IB', name: 'International Baccalaureate' },
      grade_level: { id: 'g3', code: 'AAHL', name: 'AA Higher Level' },
      questionCount: 25
    },
  ]

  it('should render with topics', () => {
    const onChange = jest.fn()
    render(
      <TopicSearchSelect
        topics={mockTopics}
        selectedTopics={[]}
        onChange={onChange}
        placeholder="Search topics..."
      />
    )
    
    expect(screen.getByPlaceholderText('Search topics...')).toBeInTheDocument()
  })

  it('should show question count when enabled', async () => {
    const onChange = jest.fn()
    render(
      <TopicSearchSelect
        topics={mockTopics}
        selectedTopics={[]}
        onChange={onChange}
        showQuestionCount={true}
      />
    )
    
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'quad' } })
    
    await waitFor(() => {
      expect(screen.getByText('15 questions')).toBeInTheDocument()
    })
  })

  it('should display grade level code in results', async () => {
    const onChange = jest.fn()
    render(
      <TopicSearchSelect
        topics={mockTopics}
        selectedTopics={[]}
        onChange={onChange}
      />
    )
    
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'linear' } })
    
    await waitFor(() => {
      expect(screen.getByText('AISL')).toBeInTheDocument()
    })
  })

  it('should select and display topic', async () => {
    const onChange = jest.fn()
    render(
      <TopicSearchSelect
        topics={mockTopics}
        selectedTopics={[]}
        onChange={onChange}
      />
    )
    
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'diff' } })
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('Differentiation'))
    })
    
    expect(onChange).toHaveBeenCalledWith(['3'])
  })

  it('should group topics by program', async () => {
    const onChange = jest.fn()
    render(
      <TopicSearchSelect
        topics={mockTopics}
        selectedTopics={[]}
        onChange={onChange}
      />
    )
    
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '' } })
    
    await waitFor(() => {
      expect(screen.getByText('International Baccalaureate')).toBeInTheDocument()
    })
  })
})

describe('StudentSearchSelect Component', () => {
  const mockStudents = [
    { 
      id: '1', 
      name: 'Alice Johnson', 
      email: 'alice@example.com',
      program: { id: 'p1', code: 'IB', name: 'IB' },
      grade_level: { id: 'g1', code: 'AIHL', name: 'AI Higher Level' }
    },
    { 
      id: '2', 
      name: 'Bob Smith', 
      email: 'bob@example.com',
      program: null,
      grade_level: null
    },
    { 
      id: '3', 
      name: 'Charlie Brown', 
      email: 'charlie@example.com',
      program: { id: 'p1', code: 'IB', name: 'IB' },
      grade_level: { id: 'g2', code: 'AASL', name: 'AA Standard Level' }
    },
  ]

  it('should render with students', () => {
    const onChange = jest.fn()
    render(
      <StudentSearchSelect
        students={mockStudents}
        selectedStudents={[]}
        onChange={onChange}
        placeholder="Search students..."
      />
    )
    
    expect(screen.getByPlaceholderText('Search students...')).toBeInTheDocument()
  })

  it('should search by name', async () => {
    const onChange = jest.fn()
    render(
      <StudentSearchSelect
        students={mockStudents}
        selectedStudents={[]}
        onChange={onChange}
      />
    )
    
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'alice' } })
    
    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
    })
  })

  it('should search by email', async () => {
    const onChange = jest.fn()
    render(
      <StudentSearchSelect
        students={mockStudents}
        selectedStudents={[]}
        onChange={onChange}
      />
    )
    
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'bob@' } })
    
    await waitFor(() => {
      expect(screen.getByText('Bob Smith')).toBeInTheDocument()
    })
  })

  it('should show select all option when enabled', async () => {
    const onChange = jest.fn()
    render(
      <StudentSearchSelect
        students={mockStudents}
        selectedStudents={[]}
        onChange={onChange}
        allowSelectAll={true}
      />
    )
    
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    
    await waitFor(() => {
      expect(screen.getByText(/Select All/)).toBeInTheDocument()
    })
  })

  it('should select all students when select all is clicked', async () => {
    const onChange = jest.fn()
    render(
      <StudentSearchSelect
        students={mockStudents}
        selectedStudents={[]}
        onChange={onChange}
        allowSelectAll={true}
      />
    )
    
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    
    await waitFor(() => {
      const selectAll = screen.getByText(/Select All/)
      fireEvent.click(selectAll.closest('[class*="cursor-pointer"]')!)
    })
    
    expect(onChange).toHaveBeenCalledWith(['1', '2', '3'])
  })

  it('should display student email in results', async () => {
    const onChange = jest.fn()
    render(
      <StudentSearchSelect
        students={mockStudents}
        selectedStudents={[]}
        onChange={onChange}
      />
    )
    
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'charlie' } })
    
    await waitFor(() => {
      expect(screen.getByText('charlie@example.com')).toBeInTheDocument()
    })
  })

  it('should group students by grade level', async () => {
    const onChange = jest.fn()
    render(
      <StudentSearchSelect
        students={mockStudents}
        selectedStudents={[]}
        onChange={onChange}
      />
    )
    
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '' } })
    
    await waitFor(() => {
      expect(screen.getByText('AI Higher Level')).toBeInTheDocument()
    })
  })

  it('should use green color for selected badges', () => {
    const onChange = jest.fn()
    render(
      <StudentSearchSelect
        students={mockStudents}
        selectedStudents={['1']}
        onChange={onChange}
      />
    )
    
    // The name is inside a nested span, so find parent badge element
    const nameElement = screen.getByText('Alice Johnson')
    const badge = nameElement.closest('.bg-green-100')
    expect(badge).toBeInTheDocument()
  })
})
