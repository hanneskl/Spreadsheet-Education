import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * A crash must never leave a pupil staring at a white screen.
 *
 * Class components are still the only way to catch a render error in React, so this stays a
 * class. The message is German because pupils read it; the technical detail is offered as
 * copyable text so a bug report carries the stack instead of "es war weiß".
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Absturz in der Oberfläche:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="crash">
        <h1>Da ist etwas schiefgelaufen.</h1>
        <p>
          Deine Eingaben sind nicht verloren – sie liegen im Browser. Klicke auf „Neu starten“,
          um weiterzuarbeiten.
        </p>
        <button onClick={() => this.setState({ error: null })}>
          Neu starten
        </button>
        <details>
          <summary>Technische Details (für Herrn Kleist)</summary>
          <pre>{`${error.name}: ${error.message}\n${error.stack ?? ''}`}</pre>
        </details>
      </div>
    )
  }
}
