import { DifficultyTag } from './components.jsx';

export const STARTER = `import sys


def main():
    data = sys.stdin.read().split()
    # Write your solution here. Read from stdin, print to stdout.


if __name__ == "__main__":
    main()
`;

// The problem statement exactly as users see it. Shared by the problem page and the admin preview.
export function ProblemStatement({ problem, samples }) {
  return (
    <>
      <h1 id="problem-title">{problem.title || <span className="muted">Untitled problem</span>}</h1>
      <div className="meta">
        <DifficultyTag difficulty={problem.difficulty} />
        <span className="muted small">Time limit {problem.time_limit} s</span>
        <span className="muted small">Memory {problem.memory_limit} MB</span>
      </div>

      <div className="prose">
        {problem.description || <span className="muted">No description yet.</span>}
      </div>

      {problem.constraints && (
        <>
          <h2>Constraints</h2>
          <div className="prose mono-block">{problem.constraints}</div>
        </>
      )}

      {samples.length > 0 && (
        <>
          <h2>Examples</h2>
          {samples.map((s, i) => (
            <div key={i} className="sample">
              <h3>Example {i + 1}</h3>
              <div className="io-grid">
                <div>
                  <span className="io-label">Input</span>
                  <pre className="code">{s.input}</pre>
                </div>
                <div>
                  <span className="io-label">Output</span>
                  <pre className="code">{s.expected_output}</pre>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
