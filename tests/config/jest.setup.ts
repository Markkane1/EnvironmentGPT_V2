import '@testing-library/jest-dom'
import { Request as FetchRequest, Response as FetchResponse, Headers as FetchHeaders } from 'cross-fetch'
import { serialize, deserialize } from 'v8'

// This is only applied for jsdom environment tests
// Check if window is defined (jsdom environment)
const isJsDom = typeof window !== 'undefined'

if (typeof globalThis.Request === 'undefined') {
  Object.defineProperty(globalThis, 'Request', { value: FetchRequest })
}

if (typeof globalThis.Response === 'undefined') {
  Object.defineProperty(globalThis, 'Response', { value: FetchResponse })
}

if (typeof globalThis.Headers === 'undefined') {
  Object.defineProperty(globalThis, 'Headers', { value: FetchHeaders })
}

if (typeof globalThis.structuredClone !== 'function') {
  Object.defineProperty(globalThis, 'structuredClone', {
    value: <T>(value: T): T => deserialize(serialize(value)),
  })
}

if (typeof globalThis.Response.json !== 'function') {
  Object.defineProperty(globalThis.Response, 'json', {
    value: (data: unknown, init: ResponseInit = {}) => {
      const headers = new FetchHeaders(init.headers ?? {})
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json')
      }

      return new globalThis.Response(JSON.stringify(data), {
        ...init,
        headers,
      })
    },
  })
}

if (isJsDom) {
  // Mock localStorage
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn(),
  }
  Object.defineProperty(window, 'localStorage', { value: localStorageMock })

  // Mock sessionStorage
  Object.defineProperty(window, 'sessionStorage', { value: localStorageMock })

  // Mock ResizeObserver
  class ResizeObserverMock {
    observe = jest.fn()
    unobserve = jest.fn()
    disconnect = jest.fn()
  }
  Object.defineProperty(window, 'ResizeObserver', { value: ResizeObserverMock })

  // Mock IntersectionObserver
  class IntersectionObserverMock {
    observe = jest.fn()
    unobserve = jest.fn()
    disconnect = jest.fn()
    root = null
    rootMargin = ''
    thresholds = []
  }
  Object.defineProperty(window, 'IntersectionObserver', { value: IntersectionObserverMock })

  // Mock matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })

  // Mock scrollIntoView
  Element.prototype.scrollIntoView = jest.fn()

  // Mock clipboard
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: jest.fn().mockResolvedValue(undefined),
      readText: jest.fn().mockResolvedValue(''),
    },
  })
}

// Mock fetch globally
global.fetch = jest.fn()

// Suppress console errors during tests
const originalError = console.error
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
       args[0].includes('Not implemented: HTMLFormElement.prototype.submit') ||
       args[0].includes('Consider adding an error boundary'))
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks()
})
