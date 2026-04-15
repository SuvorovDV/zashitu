import { describe, it, expect, beforeEach } from 'vitest'
import { useWizardStore } from '../store/index.js'

// Сбрасываем стор перед каждым тестом
beforeEach(() => {
  useWizardStore.getState().reset()
  localStorage.clear()
})

describe('wizardStore — начальное состояние', () => {
  it('currentStep = 1', () => {
    expect(useWizardStore.getState().currentStep).toBe(1)
  })

  it('topic — пустая строка', () => {
    expect(useWizardStore.getState().topic).toBe('')
  })

  it('tier = basic', () => {
    expect(useWizardStore.getState().tier).toBe('basic')
  })

  it('required_elements — пустой массив', () => {
    expect(useWizardStore.getState().required_elements).toEqual([])
  })

  it('orderId = null', () => {
    expect(useWizardStore.getState().orderId).toBeNull()
  })
})

describe('wizardStore — setField', () => {
  it('обновляет строковое поле', () => {
    useWizardStore.getState().setField('topic', 'Машинное обучение')
    expect(useWizardStore.getState().topic).toBe('Машинное обучение')
  })

  it('обновляет числовое поле', () => {
    useWizardStore.getState().setField('duration_minutes', 30)
    expect(useWizardStore.getState().duration_minutes).toBe(30)
  })

  it('обновляет массив', () => {
    useWizardStore.getState().setField('required_elements', ['Введение', 'Выводы'])
    expect(useWizardStore.getState().required_elements).toEqual(['Введение', 'Выводы'])
  })
})

describe('wizardStore — навигация', () => {
  it('nextStep увеличивает шаг', () => {
    useWizardStore.getState().nextStep()
    expect(useWizardStore.getState().currentStep).toBe(2)
  })

  it('nextStep не превышает 10', () => {
    useWizardStore.getState().goToStep(10)
    useWizardStore.getState().nextStep()
    expect(useWizardStore.getState().currentStep).toBe(10)
  })

  it('prevStep уменьшает шаг', () => {
    useWizardStore.getState().goToStep(5)
    useWizardStore.getState().prevStep()
    expect(useWizardStore.getState().currentStep).toBe(4)
  })

  it('prevStep не опускается ниже 1', () => {
    useWizardStore.getState().prevStep()
    expect(useWizardStore.getState().currentStep).toBe(1)
  })

  it('goToStep устанавливает произвольный шаг', () => {
    useWizardStore.getState().goToStep(7)
    expect(useWizardStore.getState().currentStep).toBe(7)
  })
})

describe('wizardStore — setOrderId', () => {
  it('сохраняет orderId', () => {
    useWizardStore.getState().setOrderId('order-uuid-123')
    expect(useWizardStore.getState().orderId).toBe('order-uuid-123')
  })
})

describe('wizardStore — reset', () => {
  it('сбрасывает все поля к дефолтам', () => {
    useWizardStore.getState().setField('topic', 'Тема')
    useWizardStore.getState().setField('tier', 'premium')
    useWizardStore.getState().goToStep(8)
    useWizardStore.getState().setOrderId('some-id')

    useWizardStore.getState().reset()

    const s = useWizardStore.getState()
    expect(s.topic).toBe('')
    expect(s.tier).toBe('basic')
    expect(s.currentStep).toBe(1)
    expect(s.orderId).toBeNull()
  })
})

describe('wizardStore — getFormData', () => {
  it('включает topic и tier', () => {
    useWizardStore.getState().setField('topic', 'Тема диплома')
    useWizardStore.getState().setField('tier', 'premium')
    const data = useWizardStore.getState().getFormData()
    expect(data.topic).toBe('Тема диплома')
    expect(data.tier).toBe('premium')
  })

  it('опускает пустые опциональные поля', () => {
    useWizardStore.getState().setField('topic', 'Тема')
    const data = useWizardStore.getState().getFormData()
    expect(data.direction).toBeUndefined()
    expect(data.thesis).toBeUndefined()
    expect(data.university).toBeUndefined()
  })

  it('включает required_elements при непустом массиве', () => {
    useWizardStore.getState().setField('required_elements', ['Введение'])
    const data = useWizardStore.getState().getFormData()
    expect(data.required_elements).toEqual(['Введение'])
  })

  it('опускает required_elements при пустом массиве', () => {
    const data = useWizardStore.getState().getFormData()
    expect(data.required_elements).toBeUndefined()
  })

  it('не включает служебные поля (currentStep, orderId)', () => {
    useWizardStore.getState().setField('topic', 'Тема')
    const data = useWizardStore.getState().getFormData()
    expect(data.currentStep).toBeUndefined()
    expect(data.orderId).toBeUndefined()
  })
})
