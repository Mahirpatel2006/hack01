'use client'
import React from 'react'

interface ErrorBoundaryState { hasError: boolean; error: Error | null }
interface ErrorBoundaryProps { children: React.ReactNode; fallback?: React.ReactNode; onError?: (error: Error, info: React.ErrorInfo) => void }

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
    this.props.onError?.(error, info)
  }

  handleReset = () => { this.setState({ hasError: false, error: null }) }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-[var(--destructive)]/10 flex items-center justify-center mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-lg font-black text-[var(--foreground)] mb-2">Something went wrong</h2>
          <p className="text-sm text-[var(--muted-foreground)] mb-6 max-w-xs">{this.state.error?.message ?? 'An unexpected error occurred.'}</p>
          <button onClick={this.handleReset} className="btn-primary">Try again</button>
        </div>
      )
    }
    return this.props.children
  }
}
