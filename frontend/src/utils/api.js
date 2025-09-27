/**
 * API utility functions for communicating with the backend
 * No mock data, no preview mode — always call FastAPI backend
 */

// Base URL (configured via Next.js env var, fallback localhost)
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"

/**
 * Generic API request function with error handling
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`

  const defaultOptions = {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  }

  const response = await fetch(url, defaultOptions)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      errorData.detail || `HTTP ${response.status}: ${response.statusText}`
    )
  }

  return await response.json()
}

/**
 * Get host summary from API
 */
export async function getSummary(ip) {
  const data = await apiRequest("/summarize", {
    method: "POST",
    body: JSON.stringify({ ip }), // FastAPI expects { ip }
  })

  return {
    ip: data.ip,
    summary: data.summary,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Get list of available hosts (optional future enhancement)
 */
export async function getAvailableHosts() {
  // If you add a /hosts endpoint later
  const data = await apiRequest("/hosts", { method: "GET" })
  return data.hosts || []
}
