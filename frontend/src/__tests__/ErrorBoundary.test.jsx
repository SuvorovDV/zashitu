import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import ErrorBoundary from '../components/layout/ErrorBoundary.jsx'

function Boom() {
  throw new Error('kaboom')
}

// React 18 по-прежнему шумит в консоль при ошибке в render — глушим.
beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterAll(() => {
  console.error.mockRestore?.()
})

describe('<ErrorBoundary>', () => {
  it('показывает fallback при ошибке ребёнка', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByText(/что-то пошло не так/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /перезагрузить/i })).toBeInTheDocument()
  })

  it('рендерит детей когда ошибок нет', () => {
    render(
      <ErrorBoundary>
        <div>hello</div>
      </ErrorBoundary>,
    )
    expect(screen.getByText('hello')).toBeInTheDocument()
  })
})
