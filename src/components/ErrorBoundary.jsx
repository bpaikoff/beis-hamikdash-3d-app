import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error(error, info?.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="start-screen">
        <div className="start-panel">
          <h2>Something went wrong</h2>
          <p style={{ direction: 'ltr' }}>{String(this.state.error?.message || this.state.error)}</p>
          <button className="start-btn" onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    );
  }
}
