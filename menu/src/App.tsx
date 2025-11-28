import { useEffect, useState } from 'react';
import './App.css';

interface AppEntry {
  name: string;
  path: string;
}

function App() {
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/apps.json')
      .then((res) => {
        if (!res.ok) {
          // Fallback for development if apps.json isn't there
          console.warn('Could not fetch apps.json');
          return [];
        }
        return res.json();
      })
      .then((data) => {
        setApps(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="container">
      <header>
        <h1>My Applications</h1>
        <p>Select an app to launch</p>
      </header>

      <main>
        {loading ? (
          <div className="loader">Loading...</div>
        ) : apps.length === 0 ? (
          <div className="empty-state">
            <p>No apps found.</p>
            <small>Add apps to the <code>apps/</code> folder and rebuild.</small>
          </div>
        ) : (
          <div className="grid">
            {apps.map((app) => (
              <a key={app.path} href={app.path} className="card">
                <div className="card-content">
                  <h2>{app.name.replace(/-/g, ' ')}</h2>
                  <span className="arrow">→</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
