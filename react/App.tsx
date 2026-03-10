export function App(): React.JSX.Element {
  return (
    <main className="react-shell" aria-label="React migration scaffold">
      <section className="react-card">
        <h1>React Migration Scaffold</h1>
        <p>This runs in parallel with the current vanilla TypeScript app for learning purposes.</p>
        <ul>
          <li>Keep using <code>npm run dev</code> for the production app.</li>
          <li>Use <code>npm run dev:react</code> to work on the React migration branch.</li>
          <li>Migrate features incrementally (views → state → handlers).</li>
        </ul>
      </section>
    </main>
  );
}
