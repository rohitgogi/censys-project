"use client"

import { useState, useEffect } from "react"
import { getSummary, getAvailableHosts } from "./utils/api"

// HeroRings SVG component as specified in design document
function HeroRings(props) {
  return (
    <svg {...props} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="g1" cx="0" cy="0.6" r="1">
          <stop offset="0" stopColor="rgba(255,255,255,0.10)" />
          <stop offset="1" stopColor="rgba(255,255,255,0.00)" />
        </radialGradient>
      </defs>
      {/* left soft glow */}
      <circle cx="320" cy="420" r="380" fill="url(#g1)" />
      {/* ring strokes */}
      {[220, 300, 380, 460].map((r, i) => (
        <circle
          key={r}
          cx="360"
          cy="420"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={i === 3 ? 3 : 2}
        />
      ))}
    </svg>
  )
}

// Risk Tag component
function RiskTag({ riskLevel }) {
  const getRiskConfig = (level) => {
    switch (level?.toLowerCase()) {
      case 'critical':
        return { bg: '#DC2626', text: 'white', label: 'Critical' }
      case 'high':
        return { bg: '#EA580C', text: 'white', label: 'High' }
      case 'medium':
        return { bg: '#FACC15', text: 'black', label: 'Medium' }
      case 'low':
        return { bg: '#16A34A', text: 'white', label: 'Low' }
      default:
        return { bg: '#6B7280', text: 'white', label: 'Unknown' }
    }
  }

  const config = getRiskConfig(riskLevel)

  return (
    <span 
      className="risk-tag"
      style={{
        backgroundColor: config.bg,
        color: config.text,
        padding: '4px 12px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}
    >
      {config.label}
    </span>
  )
}

// SelectIP component with modern design
function SelectIP({ selectedHost, onHostSelect, disabled, hosts, hostsLoading }) {
  const handleSelectChange = (event) => {
    const selectedIp = event.target.value
    onHostSelect(selectedIp)
  }

  return (
    <div className="modern-select-container">
      <select 
        className="modern-select" 
        value={selectedHost} 
        onChange={handleSelectChange} 
        disabled={disabled || hostsLoading}
      >
        <option value="" disabled>
          {hostsLoading ? "Loading hosts..." : "Choose an IP address..."}
        </option>
        {hosts.map((host) => (
          <option key={host.ip} value={host.ip}>
            {host.ip} - {host.location} ({host.risk_level} risk)
          </option>
        ))}
      </select>
    </div>
  )
}

// Modern Card component with cleaner design
function ModernCard({ selectedHost, onHostSelect, onSummarize, disabled, hosts, hostsLoading }) {
  return (
    <div className="modern-card-container">
      {/* Dropdown */}
      <SelectIP 
        selectedHost={selectedHost} 
        onHostSelect={onHostSelect} 
        disabled={disabled} 
        hosts={hosts}
        hostsLoading={hostsLoading}
      />

      {/* CTA Button */}
      <button 
        className="modern-cta-button" 
        onClick={onSummarize} 
        disabled={disabled || !selectedHost || hostsLoading}
      >
        {disabled ? "Analyzing..." : "Summarize Host"}
      </button>
    </div>
  )
}

function App() {
  // State management for the application
  const [selectedHost, setSelectedHost] = useState("")
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hosts, setHosts] = useState([])
  const [hostsLoading, setHostsLoading] = useState(true)

  // Load available hosts on component mount
  useEffect(() => {
    const loadHosts = async () => {
      try {
        setHostsLoading(true)
        const availableHosts = await getAvailableHosts()
        setHosts(availableHosts)
      } catch (err) {
        console.error("Error loading hosts:", err)
        setError("Failed to load available hosts. Please refresh the page.")
      } finally {
        setHostsLoading(false)
      }
    }

    loadHosts()
  }, [])

  // Handle host selection from dropdown
  const handleHostSelect = (hostIp) => {
    setSelectedHost(hostIp)
    // Clear previous results when selecting new host
    setSummary(null)
    setError(null)
  }

  // Handle summary request
  const handleSummarize = async () => {
    if (!selectedHost) {
      setError("Please select a host IP address first.")
      return
    }

    setLoading(true)
    setError(null)
    setSummary(null)

    try {
      // Call API to get host summary
      const result = await getSummary(selectedHost)
      setSummary(result)
    } catch (err) {
      console.error("Error fetching summary:", err)
      setError(err.message || "Failed to fetch host summary. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Get risk level for selected host
  const getSelectedHostRiskLevel = () => {
    const selectedHostData = hosts.find(host => host.ip === selectedHost)
    return selectedHostData?.risk_level
  }

  return (
    <div className="App">
      {/* Hero section matching Censys layout */}
      <section className="hero-section hero-gradient min-h-screen flex flex-col items-center px-6 md:px-8" style={{ paddingTop: '60px' }}>
        {/* background rings */}
        <HeroRings className="hero-rings" />

        {/* Title section - using hero-headline class for proper styling */}
        <div className="card-container mb-20">
          <h1 className="hero-headline" style={{ marginBottom: '80px' }}>Censys Host Summarizer</h1>
        </div>

        {/* Modern card container */}
        <div className="card-container">
          <ModernCard
            selectedHost={selectedHost}
            onHostSelect={handleHostSelect}
            onSummarize={handleSummarize}
            disabled={loading}
            hosts={hosts}
            hostsLoading={hostsLoading}
          />
        </div>

        {/* Results section - using same centering as card-container */}
        {loading && (
          <div className="card-container" style={{ marginTop: "32px" }}>
            <div className="main-card">
              <div className="loading-container">
                <div className="spinner"></div>
                <div className="loading-text">Analyzing host...</div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="card-container" style={{ marginTop: "32px" }}>
            <div className="error-banner">
              {error}
            </div>
          </div>
        )}

        {summary && !loading && (
          <div className="card-container" style={{ marginTop: "32px" }}>
            <div className="main-card summary-card">
              <div className="summary-header">
                <div className="summary-ip">{summary.ip}</div>
                <RiskTag riskLevel={getSelectedHostRiskLevel()} />
              </div>
              <div className="summary-text">{summary.summary}</div>
            </div>
          </div>
        )}

        {!summary && !loading && !error && selectedHost && (
          <div className="card-container" style={{ marginTop: "32px" }}>
            <div className="main-card">
              <div className="summary-placeholder">Click "Summarize Host" to analyze the selected IP address</div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

export default App