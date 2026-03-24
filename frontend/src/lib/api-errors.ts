export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error.trim().length > 0) {
    return error
  }

  if (error && typeof error === 'object') {
    const value = error as {
      message?: unknown
      details?: unknown
    }

    if (typeof value.message === 'string' && value.message.trim().length > 0) {
      return value.message
    }

    if (Array.isArray(value.details) && value.details.length > 0) {
      const firstDetail = value.details[0] as {
        message?: unknown
      }

      if (typeof firstDetail?.message === 'string' && firstDetail.message.trim().length > 0) {
        return firstDetail.message
      }
    }
  }

  return fallback
}
