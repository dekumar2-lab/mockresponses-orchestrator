import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE = '/api';

function App() {
  const [endpoints, setEndpoints] = useState([]);
  const [newEndpoint, setNewEndpoint] = useState({
    endpointId: '',
    response: '{"message": "Hello World"}',
    method: 'GET',
    statusCode: 200,
    delay: 0
  });
  const [activeTab, setActiveTab] = useState('endpoints');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadEndpoints();
  }, []);

  const loadEndpoints = async () => {
    try {
      const response = await axios.get(API_BASE + '/mock-endpoints');
      setEndpoints(Object.values(response.data));
    } catch (error) {
      setMessage('Error loading endpoints: ' + error.message);
    }
  };

  const createMockEndpoint = async (e) => {
    e.preventDefault();
    try {
      await axios.post(API_BASE + '/mock-endpoints', {
        ...newEndpoint,
        response: JSON.parse(newEndpoint.response)
      });
      
      setNewEndpoint({
        endpointId: '',
        response: '{"message": "Hello World"}',
        method: 'GET',
        statusCode: 200,
        delay: 0
      });
      
      setMessage('✅ Mock endpoint created successfully!');
      loadEndpoints();
      setActiveTab('endpoints');
    } catch (error) {
      setMessage('❌ Error: ' + (error.response?.data?.error || error.message));
    }
  };

  const testEndpoint = async (endpointId) => {
    try {
      const response = await axios.get(API_BASE + '/mock/' + endpointId);
      alert('✅ Success!\n' + JSON.stringify(response.data, null, 2));
    } catch (error) {
      alert('❌ Error: ' + error.message);
    }
  };

  const deleteEndpoint = async (endpointId) => {
    if (window.confirm(`Delete endpoint "${endpointId}"?`)) {
      try {
        await axios.delete(API_BASE + '/mock-endpoints/' + endpointId);
        setMessage('✅ Endpoint deleted successfully!');
        loadEndpoints();
      } catch (error) {
        setMessage('❌ Error: ' + error.message);
      }
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🚀 Mock Server Demo</h1>
        <p>Working Version - Ready to Use</p>
      </header>

      <div className="container">
        <nav className="tabs">
          <button 
            className={activeTab === 'create' ? 'active' : ''} 
            onClick={() => setActiveTab('create')}
          >
            ➕ Create
          </button>
          <button 
            className={activeTab === 'endpoints' ? 'active' : ''} 
            onClick={() => setActiveTab('endpoints')}
          >
            📋 Endpoints ({endpoints.length})
          </button>
        </nav>

        {message && (
          <div className="message-banner">{message}</div>
        )}

        {activeTab === 'create' && (
          <section className="form-section">
            <h2>Create New Mock Endpoint</h2>
            <form onSubmit={createMockEndpoint}>
              <input
                type="text"
                placeholder="Endpoint ID (e.g., 'user-api')"
                value={newEndpoint.endpointId}
                onChange={(e) => setNewEndpoint({...newEndpoint, endpointId: e.target.value})}
                required
              />
              <select
                value={newEndpoint.method}
                onChange={(e) => setNewEndpoint({...newEndpoint, method: e.target.value})}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
              <input
                type="number"
                placeholder="Status Code"
                value={newEndpoint.statusCode}
                onChange={(e) => setNewEndpoint({...newEndpoint, statusCode: parseInt(e.target.value)})}
              />
              <textarea
                placeholder="Response JSON"
                value={newEndpoint.response}
                onChange={(e) => setNewEndpoint({...newEndpoint, response: e.target.value})}
                rows="6"
                required
              />
              <button type="submit">Create Mock Endpoint</button>
            </form>
          </section>
        )}

        {activeTab === 'endpoints' && (
          <section className="endpoints-section">
            <h2>Mock Endpoints ({endpoints.length})</h2>
            <div className="endpoints-grid">
              {endpoints.map(endpoint => (
                <div key={endpoint.id} className="endpoint-card">
                  <div className="endpoint-header">
                    <h3>{endpoint.id}</h3>
                    <span className={`method ${endpoint.method}`}>
                      {endpoint.method}
                    </span>
                  </div>
                  <p><strong>URL:</strong> {API_BASE}/mock/{endpoint.id}</p>
                  <p><strong>Status:</strong> {endpoint.statusCode}</p>
                  <div className="endpoint-actions">
                    <button 
                      onClick={() => testEndpoint(endpoint.id)}
                      className="btn-test"
                    >
                      Test
                    </button>
                    <button 
                      onClick={() => deleteEndpoint(endpoint.id)}
                      className="btn-delete"
                    >
                      Delete
                    </button>
                  </div>
                  <details>
                    <summary>Response</summary>
                    <pre>{JSON.stringify(endpoint.response, null, 2)}</pre>
                  </details>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default App;