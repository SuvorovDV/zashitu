import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Button from '../components/ui/Button.jsx'

describe('Button — рендер', () => {
  it('отображает текст-потомок', () => {
    render(<Button>Отправить</Button>)
    expect(screen.getByRole('button', { name: 'Отправить' })).toBeTruthy()
  })

  it('type=button по умолчанию', () => {
    render(<Button>OK</Button>)
    expect(screen.getByRole('button').type).toBe('button')
  })

  it('type=submit если передан', () => {
    render(<Button type="submit">Submit</Button>)
    expect(screen.getByRole('button').type).toBe('submit')
  })
})

describe('Button — состояния disabled/loading', () => {
  it('disabled=true блокирует кнопку', () => {
    render(<Button disabled>Заблокировано</Button>)
    expect(screen.getByRole('button').disabled).toBe(true)
  })

  it('loading=true блокирует кнопку', () => {
    render(<Button loading>Загрузка</Button>)
    expect(screen.getByRole('button').disabled).toBe(true)
  })

  it('активная кнопка не disabled', () => {
    render(<Button>Активная</Button>)
    expect(screen.getByRole('button').disabled).toBe(false)
  })
})

describe('Button — обработчик onClick', () => {
  it('вызывает onClick при клике', () => {
    const handler = vi.fn()
    render(<Button onClick={handler}>Кликни</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('не вызывает onClick когда disabled', () => {
    const handler = vi.fn()
    render(<Button disabled onClick={handler}>Нет</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(handler).not.toHaveBeenCalled()
  })

  it('не вызывает onClick когда loading', () => {
    const handler = vi.fn()
    render(<Button loading onClick={handler}>Загрузка</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('Button — варианты', () => {
  it('primary-вариант содержит brand-классы', () => {
    render(<Button variant="primary">Primary</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toMatch(/brand/)
  })

  it('danger-вариант содержит red-классы', () => {
    render(<Button variant="danger">Delete</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toMatch(/red/)
  })
})
