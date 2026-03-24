import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { reducer, toast, useToast } from '@/hooks/use-toast'

function HookHarness() {
  const state = useToast()

  return (
    <div>
      <span data-testid="toast-count">{state.toasts.length}</span>
      <span data-testid="toast-open">{state.toasts[0]?.open ? 'open' : 'closed'}</span>
      <button type="button" onClick={() => state.dismiss(state.toasts[0]?.id)}>
        dismiss
      </button>
    </div>
  )
}

describe('toast state helpers', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('should add, update, dismiss, and remove toasts through the reducer', () => {
    const added = reducer(
      { toasts: [] },
      {
        type: 'ADD_TOAST',
        toast: { id: 'toast-1', title: 'Initial', open: true },
      }
    )

    expect(added.toasts).toHaveLength(1)

    const updated = reducer(added, {
      type: 'UPDATE_TOAST',
      toast: { id: 'toast-1', title: 'Updated' },
    })

    expect(updated.toasts[0]).toMatchObject({ title: 'Updated' })

    const dismissed = reducer(updated, {
      type: 'DISMISS_TOAST',
      toastId: 'toast-1',
    })

    expect(dismissed.toasts[0]).toMatchObject({ open: false })

    const removed = reducer(dismissed, {
      type: 'REMOVE_TOAST',
      toastId: 'toast-1',
    })

    expect(removed.toasts).toEqual([])
  })

  it('should keep only the newest toast and remove it after the dismiss timeout', () => {
    render(<HookHarness />)

    act(() => {
      toast({ title: 'First toast' })
      toast({ title: 'Second toast' })
    })

    expect(screen.getByTestId('toast-count')).toHaveTextContent('1')

    act(() => {
      screen.getByRole('button', { name: /dismiss/i }).click()
    })

    expect(screen.getByTestId('toast-open')).toHaveTextContent('closed')

    act(() => {
      jest.advanceTimersByTime(1000000)
    })

    expect(screen.getByTestId('toast-count')).toHaveTextContent('0')
  })
})
