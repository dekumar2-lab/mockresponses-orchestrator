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
  const [editingEndpoint, setEditingEndpoint] = useState(null);
  const [activeTab, setActiveTab] = useState('endpoints');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  
  // Test dynamic URLs state
  const [testConfig, setTestConfig] = useState({
    endpointId: '',
    urlParams: {},
    queryParams: {},
    bodyParams: {},
    method: 'GET',
    showAdvanced: false
  });
  const [testResults, setTestResults] = useState([]);

  useEffect(() => {
    loadEndpoints();
  }, []);

  const loadEndpoints = async () => {
    try {
      setLoading(true);
      setMessage('');
      console.log('Loading endpoints from:', API_BASE + '/mock-endpoints');
      
      const response = await axios.get(API_BASE + '/mock-endpoints');
      console.log('Endpoints response:', response.data);
      
      // Handle both array and object response formats
      let endpointsData = response.data;
      if (typeof endpointsData === 'object' && !Array.isArray(endpointsData)) {
        // Convert object to array if needed
        endpointsData = Object.values(endpointsData);
      }
      
      setEndpoints(endpointsData || []);
      setMessage(`✅ Loaded ${endpointsData?.length || 0} endpoints`);
    } catch (error) {
      console.error('Error loading endpoints:', error);
      setMessage('❌ Error loading endpoints: ' + (error.response?.data?.error || error.message));
      setEndpoints([]);
    } finally {
      setLoading(false);
    }
  };

  const createMockEndpoint = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(API_BASE + '/mock-endpoints', {
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

  const startEditing = (endpoint) => {
    setEditingEndpoint({
      ...endpoint,
      response: typeof endpoint.response === 'string' 
        ? endpoint.response 
        : JSON.stringify(endpoint.response, null, 2)
    });
    setActiveTab('edit');
  };

  const cancelEditing = () => {
    setEditingEndpoint(null);
    setActiveTab('endpoints');
  };

  const updateEndpoint = async (e) => {
    e.preventDefault();
    try {
      await axios.put(API_BASE + '/mock-endpoints/' + editingEndpoint.id, {
        response: JSON.parse(editingEndpoint.response),
        method: editingEndpoint.method,
        statusCode: editingEndpoint.statusCode,
        delay: editingEndpoint.delay
      });
      
      setMessage('✅ Endpoint updated successfully!');
      setEditingEndpoint(null);
      loadEndpoints();
      setActiveTab('endpoints');
    } catch (error) {
      setMessage('❌ Error: ' + (error.response?.data?.error || error.message));
    }
  };

  const testEndpoint = async (endpointId) => {
    try {
      const response = await axios.get(API_BASE + '/mock/' + endpointId);
      alert('✅ Success!\nResponse: ' + JSON.stringify(response.data, null, 2));
    } catch (error) {
      alert('❌ Error: ' + (error.response?.data?.error || error.message));
    }
  };

  const deleteEndpoint = async (endpointId) => {
    if (window.confirm(`Are you sure you want to delete endpoint "${endpointId}"?`)) {
      try {
        await axios.delete(API_BASE + '/mock-endpoints/' + endpointId);
        setMessage('✅ Endpoint deleted successfully!');
        loadEndpoints();
      } catch (error) {
        setMessage('❌ Error: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  // JSON Upload Functions
  const uploadJsonSchema = async (file) => {
    if (!file) {
      setMessage('❌ Please select a JSON file');
      return;
    }

    try {
      setLoading(true);
      setUploadMessage('Processing JSON file...');

      const fileContent = await readFileContent(file);
      const schemaData = JSON.parse(fileContent);

      // Handle different JSON schema formats
      let endpointsToCreate = [];

      if (schemaData.endpoints && Array.isArray(schemaData.endpoints)) {
        // Format 1: Multiple endpoints in one file
        endpointsToCreate = schemaData.endpoints;
      } else if (schemaData.endpointId || schemaData.id) {
        // Format 2: Single endpoint
        endpointsToCreate = [schemaData];
      } else {
        throw new Error('Invalid JSON schema format. Expected "endpoints" array or single endpoint object.');
      }

      // Create endpoints
      const createdEndpoints = [];
      for (const endpointConfig of endpointsToCreate) {
        try {
          const response = await axios.post(API_BASE + '/mock-endpoints', {
            endpointId: endpointConfig.endpointId || endpointConfig.id,
            method: endpointConfig.method || 'GET',
            response: endpointConfig.response || endpointConfig.data || { message: 'Default response' },
            statusCode: endpointConfig.statusCode || 200,
            delay: endpointConfig.delay || 0,
            headers: endpointConfig.headers || {}
          });
          createdEndpoints.push(response.data.endpoint);
        } catch (error) {
          console.error(`Failed to create endpoint:`, error);
          // Continue with other endpoints even if one fails
        }
      }

      setMessage(`✅ Successfully created ${createdEndpoints.length} endpoints from JSON file`);
      setUploadMessage('');
      loadEndpoints(); // Refresh the endpoints list
      
    } catch (error) {
      console.error('Error uploading JSON schema:', error);
      setMessage('❌ Error uploading JSON: ' + error.message);
      setUploadMessage('');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to read file content
  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  };

  // Function to download sample JSON schema
  const downloadSampleSchema = (type = 'multiple') => {
    let sampleSchema;

    if (type === 'multiple') {
      sampleSchema = {
        "name": "Sample API Contract",
        "version": "1.0.0",
        "description": "Multiple endpoints in one JSON file",
        "endpoints": [
          {
            "endpointId": "user-profile",
            "method": "GET",
            "statusCode": 200,
            "delay": 100,
            "response": {
              "user": {
                "id": "{{userId}}",
                "username": "user{{userId}}",
                "email": "user{{userId}}@example.com",
                "profile": {
                  "firstName": "{{firstName}}",
                  "lastName": "{{lastName}}",
                  "age": "{{age}}"
                }
              }
            }
          },
          {
            "endpointId": "create-order",
            "method": "POST",
            "statusCode": 201,
            "delay": 500,
            "response": {
              "orderId": "ORD-{{$timestamp}}",
              "customerId": "{{customerId}}",
              "items": "{{items}}",
              "total": "{{totalAmount}}",
              "status": "created"
            }
          },
          {
            "endpointId": "product-detail",
            "method": "GET",
            "statusCode": 200,
            "response": {
              "product": {
                "id": "{{productId}}",
                "name": "Product {{productId}}",
                "price": 99.99,
                "inStock": true,
                "specifications": {
                  "weight": "{{weight}}g",
                  "colors": ["Black", "{{customColor}}"]
                }
              }
            }
          }
        ]
      };
    } else {
      // Single endpoint sample
      sampleSchema = {
        "endpointId": "weather-api",
        "method": "GET",
        "statusCode": 200,
        "delay": 200,
        "headers": {
          "Content-Type": "application/json",
          "X-Custom-Header": "mock-server"
        },
        "response": {
          "location": "{{city}}",
          "temperature": "{{temp}}",
          "condition": "{{condition}}",
          "forecast": {
            "today": {
              "high": "{{high}}",
              "low": "{{low}}"
            },
            "tomorrow": {
              "high": "{{tomorrowHigh}}",
              "low": "{{tomorrowLow}}"
            }
          },
          "metadata": {
            "timestamp": "{{timestamp}}",
            "source": "mock-api"
          }
        }
      };
    }

    const blob = new Blob([JSON.stringify(sampleSchema, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = type === 'multiple' ? 'sample-api-contract.json' : 'sample-endpoint.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Test dynamic URLs functions
  const startDynamicTest = (endpoint) => {
    setTestConfig({
      endpointId: endpoint.id,
      urlParams: extractParamsFromResponse(endpoint.response),
      queryParams: {},
      bodyParams: {},
      method: endpoint.method,
      showAdvanced: false
    });
    setActiveTab('test-dynamic');
  };

  const extractParamsFromResponse = (response) => {
    const params = {};
    const responseStr = typeof response === 'string' ? response : JSON.stringify(response);
    const paramMatches = responseStr.match(/\{\{(\w+)\}\}/g) || [];
    
    paramMatches.forEach(match => {
      const paramName = match.replace(/\{\{/g, '').replace(/\}\}/g, '');
      if (paramName && !paramName.startsWith('$')) {
        params[paramName] = '';
      }
    });
    
    return params;
  };

  const runDynamicTest = async () => {
    if (!testConfig.endpointId) {
      setMessage('❌ Please select an endpoint to test');
      return;
    }

    try {
      setLoading(true);
      
      const queryString = Object.entries(testConfig.queryParams)
        .filter(([_, value]) => value.trim() !== '')
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');
      
      const url = `${API_BASE}/mock/${testConfig.endpointId}${queryString ? '?' + queryString : ''}`;
      
      let response;
      const config = {
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const requestData = testConfig.method === 'GET' ? undefined : testConfig.bodyParams;

      if (testConfig.method === 'GET') {
        response = await axios.get(url, config);
      } else if (testConfig.method === 'POST') {
        response = await axios.post(url, requestData, config);
      } else if (testConfig.method === 'PUT') {
        response = await axios.put(url, requestData, config);
      } else if (testConfig.method === 'DELETE') {
        response = await axios.delete(url, config);
      }

      const newTestResult = {
        id: Date.now(),
        timestamp: new Date().toLocaleString(),
        endpointId: testConfig.endpointId,
        method: testConfig.method,
        url: url,
        request: {
          queryParams: { ...testConfig.queryParams },
          bodyParams: testConfig.method !== 'GET' ? { ...testConfig.bodyParams } : undefined
        },
        response: response.data,
        status: response.status,
        success: true
      };

      setTestResults(prev => [newTestResult, ...prev.slice(0, 9)]);
      setMessage('✅ Dynamic test completed successfully!');

    } catch (error) {
      const errorResult = {
        id: Date.now(),
        timestamp: new Date().toLocaleString(),
        endpointId: testConfig.endpointId,
        method: testConfig.method,
        url: `${API_BASE}/mock/${testConfig.endpointId}`,
        request: {
          queryParams: { ...testConfig.queryParams },
          bodyParams: testConfig.method !== 'GET' ? { ...testConfig.bodyParams } : undefined
        },
        error: error.response?.data || error.message,
        status: error.response?.status,
        success: false
      };

      setTestResults(prev => [errorResult, ...prev.slice(0, 9)]);
      setMessage('❌ Test failed: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const updateTestParam = (paramType, key, value) => {
    setTestConfig(prev => ({
      ...prev,
      [paramType]: {
        ...prev[paramType],
        [key]: value
      }
    }));
  };

  const addTestParam = (paramType) => {
    const newKey = `param${Object.keys(testConfig[paramType]).length + 1}`;
    setTestConfig(prev => ({
      ...prev,
      [paramType]: {
        ...prev[paramType],
        [newKey]: ''
      }
    }));
  };

  const removeTestParam = (paramType, key) => {
    setTestConfig(prev => ({
      ...prev,
      [paramType]: Object.fromEntries(
        Object.entries(prev[paramType]).filter(([k]) => k !== key)
      )
    }));
  };

  const clearTestResults = () => {
    setTestResults([]);
  };

  const copyTestUrl = () => {
    const queryString = Object.entries(testConfig.queryParams)
      .filter(([_, value]) => value.trim() !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    
    const fullUrl = `${window.location.origin}${API_BASE}/mock/${testConfig.endpointId}${queryString ? '?' + queryString : ''}`;
    navigator.clipboard.writeText(fullUrl);
    setMessage('📋 Test URL copied to clipboard!');
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🚀 Mock Server Demo</h1>
        <p>Complete with JSON Upload & Dynamic Testing</p>
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
          <button 
            className={activeTab === 'test-dynamic' ? 'active' : ''} 
            onClick={() => setActiveTab('test-dynamic')}
          >
            🧪 Test Dynamic URLs
          </button>
          {editingEndpoint && (
            <button className="active edit-tab">
              ✏️ Edit {editingEndpoint.id}
            </button>
          )}
        </nav>

        {message && (
          <div className={`message-banner ${message.includes('❌') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        {activeTab === 'create' && (
          <section className="form-section">
            <div className="section-header">
              <h2>Create Mock Endpoint</h2>
              <div className="upload-controls">
                <button 
                  type="button"
                  onClick={() => downloadSampleSchema('multiple')}
                  className="btn-secondary"
                >
                  📥 Multiple Endpoints Sample
                </button>
                <button 
                  type="button"
                  onClick={() => downloadSampleSchema('single')}
                  className="btn-secondary"
                >
                  📥 Single Endpoint Sample
                </button>
              </div>
            </div>

            {/* File Upload Section */}
            <div className="upload-section">
              <h3>📁 Upload JSON Schema</h3>
              <div className="upload-area">
                <input
                  type="file"
                  id="json-upload"
                  accept=".json"
                  onChange={(e) => uploadJsonSchema(e.target.files[0])}
                  style={{ display: 'none' }}
                />
                <label htmlFor="json-upload" className="upload-label">
                  <div className="upload-content">
                    <div className="upload-icon">📄</div>
                    <div className="upload-text">
                      <strong>Click to upload JSON schema</strong>
                      <p>Supports single endpoint or multiple endpoints in one file</p>
                    </div>
                  </div>
                </label>
                {uploadMessage && (
                  <div className="upload-message">{uploadMessage}</div>
                )}
              </div>
              <div className="upload-help">
                <h4>Supported JSON Formats:</h4>
                <ul>
                  <li><strong>Single Endpoint:</strong> {"{ endpointId, method, response, statusCode, delay }"}</li>
                  <li><strong>Multiple Endpoints:</strong> {"{ endpoints: [array of endpoint objects] }"}</li>
                </ul>
                <p><strong>Dynamic Parameters:</strong> Use <code>{'{{paramName}}'}</code> in responses for dynamic values</p>
              </div>
            </div>

            <div className="divider">
              <span>OR</span>
            </div>

            {/* Manual Creation Form */}
            <h3>✏️ Create Manually</h3>
            <form onSubmit={createMockEndpoint}>
              <div className="form-group">
                <label>Endpoint ID:</label>
                <input
                  type="text"
                  placeholder="e.g., 'user-api', 'get-products'"
                  value={newEndpoint.endpointId}
                  onChange={(e) => setNewEndpoint({...newEndpoint, endpointId: e.target.value})}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>HTTP Method:</label>
                  <select
                    value={newEndpoint.method}
                    onChange={(e) => setNewEndpoint({...newEndpoint, method: e.target.value})}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                    <option value="PATCH">PATCH</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Status Code:</label>
                  <input
                    type="number"
                    value={newEndpoint.statusCode}
                    onChange={(e) => setNewEndpoint({...newEndpoint, statusCode: parseInt(e.target.value)})}
                    min="100"
                    max="599"
                  />
                </div>

                <div className="form-group">
                  <label>Delay (ms):</label>
                  <input
                    type="number"
                    value={newEndpoint.delay}
                    onChange={(e) => setNewEndpoint({...newEndpoint, delay: parseInt(e.target.value)})}
                    min="0"
                    max="30000"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Response JSON:</label>
                <textarea
                  placeholder='Use {{param}} for dynamic values. Example: {"id": "{{userId}}", "name": "User {{userId}}"}'
                  value={newEndpoint.response}
                  onChange={(e) => setNewEndpoint({...newEndpoint, response: e.target.value})}
                  rows="10"
                  required
                />
                <div className="form-help">
                  <strong>💡 Dynamic Parameters:</strong> Use <code>{'{{param}}'}</code> to inject URL parameters, query strings, or request body values
                </div>
              </div>

              <button type="submit" className="btn-primary">
                Create Mock Endpoint
              </button>
            </form>
          </section>
        )}

        {activeTab === 'edit' && editingEndpoint && (
          <section className="form-section">
            <h2>Edit Endpoint: {editingEndpoint.id}</h2>
            <form onSubmit={updateEndpoint}>
              <div className="form-row">
                <div className="form-group">
                  <label>HTTP Method:</label>
                  <select
                    value={editingEndpoint.method}
                    onChange={(e) => setEditingEndpoint({...editingEndpoint, method: e.target.value})}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                    <option value="PATCH">PATCH</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Status Code:</label>
                  <input
                    type="number"
                    value={editingEndpoint.statusCode}
                    onChange={(e) => setEditingEndpoint({...editingEndpoint, statusCode: parseInt(e.target.value)})}
                    min="100"
                    max="599"
                  />
                </div>

                <div className="form-group">
                  <label>Delay (ms):</label>
                  <input
                    type="number"
                    value={editingEndpoint.delay}
                    onChange={(e) => setEditingEndpoint({...editingEndpoint, delay: parseInt(e.target.value)})}
                    min="0"
                    max="30000"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Response JSON:</label>
                <textarea
                  value={editingEndpoint.response}
                  onChange={(e) => setEditingEndpoint({...editingEndpoint, response: e.target.value})}
                  rows="12"
                  required
                />
                <div className="form-help">
                  <strong>💡 Dynamic Parameters:</strong> Use <code>{'{{param}}'}</code> to inject URL parameters, query strings, or request body values
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  Update Endpoint
                </button>
                <button type="button" onClick={cancelEditing} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        {activeTab === 'endpoints' && (
          <section className="endpoints-section">
            <div className="section-header">
              <h2>Mock Endpoints ({endpoints.length})</h2>
              <button onClick={loadEndpoints} className="btn-refresh" disabled={loading}>
                {loading ? '🔄 Loading...' : '🔄 Refresh'}
              </button>
            </div>

            {loading && (
              <div className="loading">
                <div className="spinner"></div>
                Loading endpoints...
              </div>
            )}

            {!loading && endpoints.length === 0 ? (
              <div className="empty-state">
                <p>No endpoints found. Create your first mock endpoint!</p>
                <button onClick={() => setActiveTab('create')} className="btn-primary">
                  Create First Endpoint
                </button>
              </div>
            ) : (
              <div className="endpoints-grid">
                {endpoints.map(endpoint => (
                  <div key={endpoint.id} className="endpoint-card">
                    <div className="endpoint-header">
                      <h3>{endpoint.id}</h3>
                      <span className={`method ${endpoint.method}`}>
                        {endpoint.method}
                      </span>
                    </div>
                    
                    <div className="endpoint-info">
                      <p><strong>URL:</strong> <code>{API_BASE}/mock/{endpoint.id}</code></p>
                      <p><strong>Status:</strong> <span className="status-code">{endpoint.statusCode}</span></p>
                      <p><strong>Delay:</strong> {endpoint.delay || 0}ms</p>
                      {endpoint.createdAt && (
                        <p><strong>Created:</strong> {new Date(endpoint.createdAt).toLocaleString()}</p>
                      )}
                    </div>

                    <div className="endpoint-actions">
                      <button 
                        onClick={() => testEndpoint(endpoint.id)}
                        className="btn-test"
                        title="Test this endpoint"
                      >
                        🧪 Test
                      </button>
                      <button 
                        onClick={() => startDynamicTest(endpoint)}
                        className="btn-edit"
                        title="Test with dynamic parameters"
                      >
                        🎯 Dynamic Test
                      </button>
                      <button 
                        onClick={() => startEditing(endpoint)}
                        className="btn-edit"
                        title="Edit this endpoint"
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        onClick={() => deleteEndpoint(endpoint.id)}
                        className="btn-delete"
                        title="Delete this endpoint"
                      >
                        🗑️ Delete
                      </button>
                    </div>

                    <details>
                      <summary>Response Preview</summary>
                      <pre>{JSON.stringify(endpoint.response, null, 2)}</pre>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'test-dynamic' && (
          <section className="form-section">
            <div className="section-header">
              <h2>🧪 Test Dynamic URLs</h2>
              <div className="test-controls">
                <button onClick={copyTestUrl} className="btn-secondary" disabled={!testConfig.endpointId}>
                  📋 Copy URL
                </button>
                <button onClick={clearTestResults} className="btn-secondary">
                  🗑️ Clear Results
                </button>
              </div>
            </div>

            <div className="test-config">
              <div className="form-group">
                <label>Select Endpoint:</label>
                <select
                  value={testConfig.endpointId}
                  onChange={(e) => setTestConfig(prev => ({ ...prev, endpointId: e.target.value }))}
                >
                  <option value="">Choose an endpoint...</option>
                  {endpoints.map(endpoint => (
                    <option key={endpoint.id} value={endpoint.id}>
                      {endpoint.id} ({endpoint.method})
                    </option>
                  ))}
                </select>
              </div>

              {testConfig.endpointId && (
                <>
                  <div className="form-group">
                    <label>HTTP Method:</label>
                    <select
                      value={testConfig.method}
                      onChange={(e) => setTestConfig(prev => ({ ...prev, method: e.target.value }))}
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                      <option value="PATCH">PATCH</option>
                    </select>
                  </div>

                  {/* Query Parameters */}
                  <div className="param-section">
                    <div className="param-header">
                      <h4>🔍 Query Parameters</h4>
                      <button 
                        onClick={() => addTestParam('queryParams')} 
                        className="btn-help"
                      >
                        + Add Param
                      </button>
                    </div>
                    {Object.entries(testConfig.queryParams).map(([key, value]) => (
                      <div key={key} className="param-row">
                        <input
                          type="text"
                          placeholder="Parameter name"
                          value={key}
                          onChange={(e) => {
                            const newParams = { ...testConfig.queryParams };
                            delete newParams[key];
                            newParams[e.target.value] = value;
                            setTestConfig(prev => ({ ...prev, queryParams: newParams }));
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Value"
                          value={value}
                          onChange={(e) => updateTestParam('queryParams', key, e.target.value)}
                        />
                        <button 
                          onClick={() => removeTestParam('queryParams', key)}
                          className="btn-delete"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                    {Object.keys(testConfig.queryParams).length === 0 && (
                      <p className="param-help">No query parameters added</p>
                    )}
                  </div>

                  {/* Body Parameters */}
                  {testConfig.method !== 'GET' && (
                    <div className="param-section">
                      <div className="param-header">
                        <h4>📦 Request Body</h4>
                        <button 
                          onClick={() => addTestParam('bodyParams')} 
                          className="btn-help"
                        >
                          + Add Field
                        </button>
                      </div>
                      {Object.entries(testConfig.bodyParams).map(([key, value]) => (
                        <div key={key} className="param-row">
                          <input
                            type="text"
                            placeholder="Field name"
                            value={key}
                            onChange={(e) => {
                              const newParams = { ...testConfig.bodyParams };
                              delete newParams[key];
                              newParams[e.target.value] = value;
                              setTestConfig(prev => ({ ...prev, bodyParams: newParams }));
                            }}
                          />
                          <input
                            type="text"
                            placeholder="Value"
                            value={value}
                            onChange={(e) => updateTestParam('bodyParams', key, e.target.value)}
                          />
                          <button 
                            onClick={() => removeTestParam('bodyParams', key)}
                            className="btn-delete"
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                      {Object.keys(testConfig.bodyParams).length === 0 && (
                        <p className="param-help">No body parameters added</p>
                      )}
                    </div>
                  )}

                  <button 
                    onClick={runDynamicTest} 
                    className="btn-primary"
                    disabled={loading}
                  >
                    {loading ? '🔄 Testing...' : '🚀 Run Test'}
                  </button>
                </>
              )}
            </div>

            {/* Test Results */}
            {testResults.length > 0 && (
              <div className="test-results">
                <h3>Test History ({testResults.length})</h3>
                <div className="results-grid">
                  {testResults.map(result => (
                    <div key={result.id} className={`result-card ${result.success ? 'success' : 'error'}`}>
                      <div className="result-header">
                        <div className="result-meta">
                          <span className={`method ${result.method}`}>{result.method}</span>
                          <span className="endpoint-id">{result.endpointId}</span>
                          <span className={`status ${result.success ? 'success' : 'error'}`}>
                            {result.status} {result.success ? '✅' : '❌'}
                          </span>
                        </div>
                        <span className="timestamp">{result.timestamp}</span>
                      </div>
                      
                      <div className="result-details">
                        <details>
                          <summary>Request Details</summary>
                          <div className="request-info">
                            <p><strong>URL:</strong> <code>{result.url}</code></p>
                            {Object.keys(result.request.queryParams).length > 0 && (
                              <p><strong>Query Params:</strong> 
                                <code>{JSON.stringify(result.request.queryParams)}</code>
                              </p>
                            )}
                            {result.request.bodyParams && Object.keys(result.request.bodyParams).length > 0 && (
                              <p><strong>Body Params:</strong> 
                                <code>{JSON.stringify(result.request.bodyParams)}</code>
                              </p>
                            )}
                          </div>
                        </details>
                        
                        <details open>
                          <summary>Response</summary>
                          <pre>{JSON.stringify(result.success ? result.response : result.error, null, 2)}</pre>
                        </details>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default App;