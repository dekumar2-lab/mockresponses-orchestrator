import React, { useState, useEffect } from 'react';

// Base URL for the mock API (simulated for display purposes)
const API_BASE = '/api';

// --- Core Logic for Response Processing and Scenario Evaluation ---

/**
 * Processes the response template string, substituting placeholders with actual request data.
 * Template syntax: {{path.param}}, {{query.param}}, {{body.field}}, or {{body}}
 * @param {string} template - The response template string (e.g., '{"id": "{{path.id}}", "status": "ok"}')
 * @param {object} requestParams - An object containing pathParams, queryParams, and bodyParams.
 * @returns {string} The processed response string.
 */
const processResponseTemplate = (template, requestParams) => {
  let processedTemplate = template;

  const replace = (type, params) => {
    if (!params) return;
    Object.entries(params).forEach(([key, value]) => {
      // Find and replace {{type.key}} with the stringified value
      const placeholder = new RegExp(`{{\\s*${type}\\.${key}\\s*}}`, 'g');

      // Use the actual value. If it's an object/array, stringify it.
      const replacementValue = (typeof value === 'object' && value !== null)
          ? JSON.stringify(value)
          : String(value);

      processedTemplate = processedTemplate.replace(placeholder, replacementValue);
    });
  };

  // 1. Path Params
  replace('path', requestParams.pathParams);

  // 2. Query Params
  replace('query', requestParams.queryParams);

  // 3. Specific Body Fields
  if (requestParams.bodyParams) {
      Object.entries(requestParams.bodyParams).forEach(([key, value]) => {
        const placeholder = new RegExp(`{{\\s*body\\.${key}\\s*}}`, 'g');
        const replacementValue = (typeof value === 'object' && value !== null)
            ? JSON.stringify(value)
            : String(value);
        processedTemplate = processedTemplate.replace(placeholder, replacementValue);
      });
  }

  // 4. Whole Body Object (special case)
  if (requestParams.bodyParams) {
      const bodyPlaceholder = new RegExp(`{{\\s*body\\s*}}`, 'g');
      const stringifiedBody = JSON.stringify(requestParams.bodyParams);
      processedTemplate = processedTemplate.replace(bodyPlaceholder, stringifiedBody);
  }

  return processedTemplate;
};

/**
 * Evaluates the condition string against request parameters.
 * @param {string} condition - A string containing a JavaScript expression (e.g., "path.id === 'error'").
 * @param {object} requestParams - An object containing pathParams, queryParams, and bodyParams.
 * @returns {boolean} True if the condition evaluates to true, false otherwise.
 */
const evaluateCondition = (condition, requestParams) => {
    if (!condition || typeof condition !== 'string' || condition.trim() === '') {
        return false;
    }

    // Deconstruct params for easy access inside the eval scope
    const path = requestParams.pathParams || {};
    const query = requestParams.queryParams || {};
    const body = requestParams.bodyParams || {};

    try {
        // Use a function constructor for safe evaluation, isolating scope
        const result = new Function('path', 'query', 'body', `return (${condition})`)(path, query, body);
        return !!result; // Coerce to boolean
    } catch (e) {
        console.error(`Error evaluating scenario condition: "${condition}"`, e);
        // If evaluation fails (e.g., bad syntax), the condition is treated as false.
        return false;
    }
};

/**
 * Finds the matching scenario for the request.
 * @param {object} endpoint - The full endpoint definition.
 * @param {object} requestParams - Path, Query, and Body parameters from the request.
 * @returns {object} The matched scenario object (statusCode, delay, responseTemplate).
 */
const getMatchingScenario = (endpoint, requestParams) => {
    // 1. Check Conditional Scenarios first
    if (endpoint.scenarios && Array.isArray(endpoint.scenarios)) {
        for (const scenario of endpoint.scenarios) {
            if (scenario.condition && evaluateCondition(scenario.condition, requestParams)) {
                return scenario; // Found a match
            }
        }
    }

    // 2. Fall back to the Default Scenario
    return {
        statusCode: endpoint.statusCode,
        delay: endpoint.delay,
        responseTemplate: endpoint.responseTemplate,
    };
};

// --- Mock Backend Simulation (Handles all client-side operations) ---
// This acts as the "database" for the defined endpoints
let MOCK_ENDPOINTS = [];

const mockBackend = {
  // Simulates fetching all endpoints
  getEndpoints: () => MOCK_ENDPOINTS,

  /**
   * Adds or updates an endpoint definition.
   */
  addOrUpdateEndpoint: (endpoint) => {
    // Ensure endpoint has a unique ID for React keys and deletion
    if (!endpoint.internalId) {
      endpoint.internalId = endpoint.endpointId + '-' + endpoint.method;
    }

    // Ensure scenarios array exists
    if (!endpoint.scenarios) {
        endpoint.scenarios = [];
    }

    const existingIndex = MOCK_ENDPOINTS.findIndex(e => e.internalId === endpoint.internalId);

    if (existingIndex > -1) {
      MOCK_ENDPOINTS[existingIndex] = endpoint;
    } else {
      MOCK_ENDPOINTS.push(endpoint);
    }
    return endpoint;
  },

  // Simulates deleting an endpoint
  deleteEndpoint: (id) => {
    MOCK_ENDPOINTS = MOCK_ENDPOINTS.filter(e => e.internalId === id);
    return true;
  },

  /**
   * Handles the simulated API call by finding a matching endpoint
   * and dynamically processing the response template.
   */
  handleApiCall: (method, url, pathParams, queryParams, bodyParams) => {
    return new Promise((resolve, reject) => {

      let matchedEndpoint = null;

      // Path parameters parsed from the requested URL
      let extractedPathParams = {};

      // 1. Find the best match
      let cleanedUrl = url.split('?')[0];
      if (cleanedUrl.startsWith(API_BASE)) {
          cleanedUrl = cleanedUrl.substring(API_BASE.length);
      }

      const uParts = cleanedUrl.split('/').filter(p => p.length > 0);

      for (const e of MOCK_ENDPOINTS) {
          if (e.method !== method) continue;

          const eParts = e.endpointId.split('/').filter(p => p.length > 0);

          if (eParts.length !== uParts.length) continue;

          let matches = true;
          let tempPathParams = {};

          for (let i = 0; i < eParts.length; i++) {
              const ePart = eParts[i];
              const uPart = uParts[i];

              if (ePart.startsWith(':')) {
                  tempPathParams[ePart.substring(1)] = uPart;
              } else if (ePart !== uPart) {
                  matches = false;
                  break;
              }
          }

          if (matches) {
              matchedEndpoint = e;
              extractedPathParams = tempPathParams;
              break;
          }
      }

      if (matchedEndpoint) {
        // Merge extracted path params from URL with explicitly provided ones
        const finalPathParams = { ...pathParams, ...extractedPathParams };
        const requestParams = { pathParams: finalPathParams, queryParams, bodyParams };

        // 2. Determine the correct scenario
        const scenario = getMatchingScenario(matchedEndpoint, requestParams);

        // Simulate network delay
        setTimeout(() => {
          try {
            // Apply the dynamic template substitution
            const finalResponseText = processResponseTemplate(scenario.responseTemplate, requestParams);

            // The template *must* result in valid JSON for the response
            const finalResponse = JSON.parse(finalResponseText);

            resolve({
              status: scenario.statusCode,
              data: finalResponse,
            });
          } catch (e) {
            // Handle JSON parsing error if the template output is invalid
            reject({
              status: 500,
              error: `Internal Mock Error: Failed to parse dynamic response template. Ensure the result is valid JSON. (Scenario Status: ${scenario.statusCode}). Error: ${e.message}`,
              responseText: scenario.responseTemplate, // Show template for debugging
            });
          }
        }, scenario.delay);
      } else {
        reject({
          status: 404,
          error: `Endpoint not found for ${method} ${url}`,
        });
      }
    });
  }
};

// --- Component: Scenario Editor for Endpoint ---

const ScenarioEditor = ({ endpoint, setNewEndpoint }) => {
    const handleScenarioChange = (index, field, value) => {
        setNewEndpoint(prev => {
            const newScenarios = [...prev.scenarios];
            newScenarios[index] = { ...newScenarios[index], [field]: value };
            return { ...prev, scenarios: newScenarios };
        });
    };

    const handleAddScenario = () => {
        setNewEndpoint(prev => ({
            ...prev,
            scenarios: [...prev.scenarios, {
                name: `Scenario ${prev.scenarios.length + 1}`,
                condition: `path.id === 'error'`,
                statusCode: 400,
                delay: 0,
                responseTemplate: '{"error": "Scenario failed: path.id is special"}'
            }]
        }));
    };

    const handleRemoveScenario = (index) => {
        setNewEndpoint(prev => ({
            ...prev,
            scenarios: prev.scenarios.filter((_, i) => i !== index)
        }));
    };

    // SVG for Trash icon (lucide-react compatibility)
    const TrashIcon = (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6" /><path d="M14 11v6" />
        </svg>
    );

    // SVG for Plus icon (lucide-react compatibility)
    const PlusIcon = (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    );


    return (
        <div className="scenario-editor">
            <h4 className="scenario-title">Conditional Scenarios</h4>
            <p className="help-text">
                Define custom responses that trigger when a **JavaScript condition** is met. The first matching scenario is used, otherwise the default response is used.
            </p>

            {endpoint.scenarios && endpoint.scenarios.map((scenario, index) => (
                <div key={index} className="scenario-card">
                    <div className="scenario-header">
                        <input
                            type="text"
                            value={scenario.name}
                            onChange={(e) => handleScenarioChange(index, 'name', e.target.value)}
                            className="scenario-name-input"
                            placeholder={`Scenario ${index + 1}`}
                        />
                        <button type="button" onClick={() => handleRemoveScenario(index)} className="button-icon button-danger-sm">
                             <TrashIcon />
                        </button>
                    </div>

                    <div className="form-group">
                        <label htmlFor={`condition-${index}`}>Condition (JS Expression)</label>
                        <input
                            type="text"
                            id={`condition-${index}`}
                            value={scenario.condition}
                            onChange={(e) => handleScenarioChange(index, 'condition', e.target.value)}
                            placeholder={`query.status === 'error' || path.id > 100`}
                            required
                        />
                         <p className="help-text-sm">Available variables: <code>path</code>, <code>query</code>, <code>body</code> (JS objects).</p>
                    </div>

                    <div className="form-group-row">
                        <div className="form-group">
                            <label htmlFor={`status-${index}`}>Status Code</label>
                            <input
                                type="number"
                                id={`status-${index}`}
                                value={scenario.statusCode}
                                onChange={(e) => handleScenarioChange(index, 'statusCode', Number(e.target.value))}
                                min="100"
                                max="599"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor={`delay-${index}`}>Delay (ms)</label>
                            <input
                                type="number"
                                id={`delay-${index}`}
                                value={scenario.delay}
                                onChange={(e) => handleScenarioChange(index, 'delay', Number(e.target.value))}
                                min="0"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group full-width">
                        <label htmlFor={`template-${index}`}>Response Template (JSON)</label>
                        <textarea
                            id={`template-${index}`}
                            value={scenario.responseTemplate}
                            onChange={(e) => handleScenarioChange(index, 'responseTemplate', e.target.value)}
                            rows="5"
                            required
                        ></textarea>
                    </div>
                </div>
            ))}
            <button type="button" onClick={handleAddScenario} className="button-secondary button-add-scenario">
                <PlusIcon />
                Add Scenario
            </button>
        </div>
    );
};


// --- React Component: App ---

const App = () => {
  const [endpoints, setEndpoints] = useState([]);
  const [newEndpoint, setNewEndpoint] = useState({
    endpointId: '/users/:id',
    responseTemplate: '{\n  "status": "success",\n  "message": "User {{path.id}} details retrieved.",\n  "query_filter": "{{query.filter}}",\n  "data_received": {{body}}\n}',
    method: 'GET',
    statusCode: 200,
    delay: 0,
    internalId: '',
    scenarios: [] // New field for conditional scenarios
  });
  const [editingEndpoint, setEditingEndpoint] = useState(null);
  const [activeTab, setActiveTab] = useState('endpoints');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');

  // Test dynamic URLs state
  const [testConfig, setTestConfig] = useState({
    endpointId: '/users/error?filter=active', // Initial example URL for testing
    urlParams: '{}',
    queryParams: '{}',
    bodyParams: '{\n  "name": "Jane Doe",\n  "email": "jane@example.com"\n}',
    method: 'GET',
    showAdvanced: false
  });
  const [testResults, setTestResults] = useState([]);

  // SVG Icons (lucide-react compatibility)
  const ShieldIcon = (props) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
  );
  const UploadIcon = (props) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
  );
  const ChevronDownIcon = (props) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="6 9 12 15 18 9"/></svg>
  );


  // Load initial endpoints & set default
  useEffect(() => {
    // Check if the default user endpoint exists and add it if not
    const defaultUserEndpointId = '/users/:id-GET';
    if (mockBackend.getEndpoints().every(e => e.internalId !== defaultUserEndpointId)) {
        mockBackend.addOrUpdateEndpoint({
            endpointId: '/users/:id',
            responseTemplate: '{\n  "status": "success",\n  "message": "User {{path.id}} details retrieved.",\n  "query_filter": "{{query.filter}}",\n  "data_received": {{body}}\n}',
            method: 'GET',
            statusCode: 200,
            delay: 0,
            internalId: defaultUserEndpointId,
            scenarios: [{
                name: "Error Scenario",
                condition: "path.id === 'error'",
                statusCode: 404,
                delay: 500,
                responseTemplate: '{\n  "error": "User {{path.id}} not found or is disabled."\n}'
            }]
        });
    }

    // Add the new /orders endpoint for query param testing
    const defaultOrderEndpointId = '/orders-GET';
    if (mockBackend.getEndpoints().every(e => e.internalId !== defaultOrderEndpointId)) {
        mockBackend.addOrUpdateEndpoint({
            endpointId: '/orders',
            responseTemplate: '{\n  "status": "success",\n  "count": 50,\n  "query_status": "{{query.status}}",\n  "message": "Successfully fetched 50 orders."\n}',
            method: 'GET',
            statusCode: 200,
            delay: 100,
            internalId: defaultOrderEndpointId,
            scenarios: [
                {
                    name: "Pending Orders Response",
                    condition: "query.status === 'pending'",
                    statusCode: 202,
                    delay: 2000, // Simulate a longer poll time for pending status
                    responseTemplate: '{\n  "status": "processing",\n  "count": 5,\n  "message": "Only 5 pending orders found. Please wait 2 seconds."\n}'
                }
            ]
        });
    }


    loadEndpoints();
  }, []);

  const loadEndpoints = () => {
    try {
      setLoading(true);
      setMessage('');
      const endpointsData = mockBackend.getEndpoints();
      setEndpoints(endpointsData);
    } catch (error) {
      setMessage(`Error loading endpoints: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewEndpoint(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveEndpoint = (e) => {
    e.preventDefault();
    if (!newEndpoint.endpointId) {
      setMessage('Error: Endpoint ID is required.');
      return;
    }
    try {
      setLoading(true);
      const endpointToSave = {
        ...newEndpoint,
        internalId: newEndpoint.endpointId + '-' + newEndpoint.method,
        statusCode: Number(newEndpoint.statusCode), // Ensure types are correct
        delay: Number(newEndpoint.delay),
      };

      const savedEndpoint = mockBackend.addOrUpdateEndpoint(endpointToSave);
      loadEndpoints();
      setMessage(`Endpoint ${savedEndpoint.endpointId} (${savedEndpoint.method}) saved successfully.`);

      // Reset form after saving a new endpoint
      if (!editingEndpoint) {
          setNewEndpoint({
            endpointId: '/new-resource',
            responseTemplate: '{\n  "status": "created",\n  "id": "abc-123",\n  "body_data": {{body}}\n}',
            method: 'POST',
            statusCode: 201,
            delay: 0,
            internalId: '',
            scenarios: []
          });
      }
      setEditingEndpoint(null);

    } catch (error) {
      setMessage(`Error saving endpoint: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEndpoint = (internalId, endpointId) => {
    const confirmation = prompt(`Type DELETE to confirm removal of endpoint ${endpointId}:`);
    if (confirmation === 'DELETE') {
      try {
        setLoading(true);
        mockBackend.deleteEndpoint(internalId);
        loadEndpoints();
        setMessage(`Endpoint ${endpointId} deleted.`);
      } catch (error) {
        setMessage(`Error deleting endpoint: ${error.message}`);
      } finally {
        setLoading(false);
      }
    } else if (confirmation !== null) {
        setMessage('Deletion cancelled or incorrect confirmation word entered.');
    }
  };

  const handleEdit = (endpoint) => {
    // Deep copy the endpoint to safely edit scenarios
    setNewEndpoint(JSON.parse(JSON.stringify(endpoint)));
    setEditingEndpoint(endpoint.endpointId);
    setActiveTab('create');
  };

  /**
   * Switches to the Test tab and populates the test configuration for the given endpoint.
   * Path parameters are substituted with generic test values.
   */
  const handleTestEndpoint = (endpoint) => {
    // Logic to substitute path parameters with test values
    const generateTestUrl = (endpointId) => {
        return endpointId.split('/').map(part => {
            if (part.startsWith(':')) {
                const paramName = part.substring(1);
                // Simple heuristic for common parameter names
                if (paramName.toLowerCase().includes('id')) return '123';
                if (paramName.toLowerCase().includes('user')) return 'john_doe';
                if (paramName.toLowerCase().includes('category')) return 'electronics';
                return 'testValue';
            }
            return part;
        }).join('/');
    };

    const testUrl = generateTestUrl(endpoint.endpointId);

    // 1. Switch tab
    setActiveTab('test');
    // 2. Populate test config
    setTestConfig(prev => ({
        ...prev,
        endpointId: testUrl,
        method: endpoint.method,
        // Reset advanced params when auto-populating
        urlParams: '{}',
        queryParams: '{}',
        bodyParams: (endpoint.method === 'POST' || endpoint.method === 'PUT' || endpoint.method === 'PATCH')
            ? '{\n  "field1": "value1",\n  "field2": "value2"\n}'
            : '{}',
    }));
    setTestResults([]);
};


  const handleTestConfigChange = (e) => {
    const { name, value } = e.target;
    setTestConfig(prev => ({ ...prev, [name]: value }));
  };

  /**
   * Parses query parameters from a full URL string.
   */
  const parseQueryParams = (url) => {
    const queryIndex = url.indexOf('?');
    if (queryIndex === -1) return {};

    const queryString = url.substring(queryIndex + 1);
    const params = {};

    queryString.split('&').forEach(pair => {
        const [key, value] = pair.split('=').map(decodeURIComponent);
        if (key && value) {
            // Attempt to infer basic types
            const num = Number(value);
            params[key] = isNaN(num) ? value : num;
        }
    });

    return params;
  };

  // --- Main Test API Handler (now uses mockBackend for dynamic processing) ---
  const handleTestApi = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const fullUrl = testConfig.endpointId.trim();
      const method = testConfig.method;

      // 1. Parse Query Params directly from the URL input
      const urlQueryParams = parseQueryParams(fullUrl);

      // 2. Parse JSON inputs safely from textareas
      const pathParamsFromInput = JSON.parse(testConfig.urlParams || '{}');
      const queryParamsFromInput = JSON.parse(testConfig.queryParams || '{}');
      const bodyParams = JSON.parse(testConfig.bodyParams || '{}');

      // Merge query params from URL and from the JSON input field (input field takes precedence)
      const finalQueryParams = { ...urlQueryParams, ...queryParamsFromInput };

      // Execute mock API call
      const startTime = Date.now();
      const result = await mockBackend.handleApiCall(method, fullUrl, pathParamsFromInput, finalQueryParams, bodyParams);
      const latency = Date.now() - startTime;

      setTestResults(prev => [
        {
          id: Date.now(),
          url: fullUrl,
          method: method,
          statusCode: result.status,
          response: result.data,
          latency: latency,
          success: true,
          request: {
            pathParams: pathParamsFromInput,
            queryParams: finalQueryParams,
            bodyParams: bodyParams,
          },
        },
        ...prev
      ].slice(0, 5)); // Keep only the last 5 results

    } catch (error) {
      const latency = 0;
      setTestResults(prev => [
        {
          id: Date.now(),
          url: testConfig.endpointId,
          method: testConfig.method,
          statusCode: error.status || 500,
          error: error.error || 'Unknown error occurred.',
          latency: latency,
          success: false,
          request: {
            pathParams: JSON.parse(testConfig.urlParams || '{}'),
            queryParams: parseQueryParams(testConfig.endpointId),
            bodyParams: JSON.parse(testConfig.bodyParams || '{}'),
          },
        },
        ...prev
      ].slice(0, 5));
    } finally {
      setLoading(false);
    }
  };

  // --- Schema Upload Handler ---
  const handleUploadSchema = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const uploadedEndpoints = JSON.parse(e.target.result);

        // Basic validation: must be an array of objects
        if (Array.isArray(uploadedEndpoints) && uploadedEndpoints.every(ep => ep.endpointId && ep.method && (ep.responseTemplate || ep.response))) {
            const newEndpoints = uploadedEndpoints.map(ep => ({
                ...newEndpoint, // Default structure
                ...ep,
                // Ensure the response field is always 'responseTemplate' for consistency
                responseTemplate: ep.responseTemplate || ep.response || newEndpoint.responseTemplate,
                // Create unique internal ID
                internalId: (ep.endpointId || '') + '-' + (ep.method || 'GET'),
                // Ensure scenarios is an array
                scenarios: ep.scenarios || []
            }));

            // Add or update endpoints using mock backend
            newEndpoints.forEach(ep => mockBackend.addOrUpdateEndpoint(ep));

            loadEndpoints();
            setUploadMessage(`Successfully loaded ${newEndpoints.length} endpoints from the schema.`);
        } else {
          setUploadMessage('Error: Uploaded file is not a valid endpoint schema. Must be an array of objects with "endpointId", "method", and "responseTemplate" (or "response").');
        }
      } catch (error) {
        setUploadMessage('Error parsing JSON file. Please ensure the file is valid JSON.');
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Clear file input
  };


  return (
    <div className="app-layout-wrapper">
      <style>{`
        /* --- STYLES INLINED FOR SINGLE-FILE REACT MANDATE --- */
        /* Modern CSS Reset */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: 'Inter', sans-serif;
        }

        :root {
          /* --- Dark Teal/Cyan Professional Theme Variables --- */
          --bg-page: #f0f4f8; /* Very light cool gray background (outside floating elements) */
          --bg-card: #ffffff;
          --bg-hover: #eef2f6; /* Lighter background for hover */
          --text-primary: #1e293b; /* Dark Slate Blue */
          --text-secondary: #475569;
          --text-muted: #94a3b8; /* Faint blue-gray */
          --border: #cbd5e1; /* Light blue-gray border */
          
          /* --- Gradient Colors (Accent: Cyan to Teal) --- */
          --gradient-start: #06b6d4; /* Cyan */
          --gradient-end: #14b8a6; /* Teal */
          --accent: var(--gradient-start); /* Base accent color for text/borders */

          --success: #10b981;
          --warning: #f59e0b;
          --error: #ef4444;
          --info: #3b82f6;
          --shadow: 0 8px 20px rgba(0, 0, 0, 0.1); /* Smoother, larger shadow */
          --radius-sm: 0.375rem;
          --radius: 0.75rem;
          --radius-large: 1rem; /* New large radius for floating elements */
          --transition: all 0.2s ease-in-out;
          
          /* --- Layout Dimensions --- */
          --header-height: 70px;
          --footer-height: 50px;
          --sidebar-width: 240px;
          --layout-margin: 1rem; /* Gap for floating header/footer */
        }
        
        /* --- LAYOUT AND SCROLLING (Fixed Sidebar Structure) --- */

        html, body, #root, .app-layout-wrapper {
            height: 100%;
            overflow: hidden;
        }

        body {
          background-color: var(--bg-page);
          color: var(--text-primary);
        }

        .app-layout-wrapper {
            /* This div now acts as the bounding box for all fixed elements */
            position: relative;
            height: 100%;
            padding: var(--layout-margin);
        }

        /* FLOATING HEADER */
        .header {
            position: fixed;
            top: var(--layout-margin);
            left: var(--layout-margin);
            right: var(--layout-margin);
            height: var(--header-height);
            border-radius: var(--radius-large); /* Rounded corners all around */
            z-index: 100;
            padding: 0 2rem;
            color: white;
            box-shadow: var(--shadow);
            background: linear-gradient(90deg, var(--gradient-start) 0%, var(--gradient-end) 100%);
            display: flex;
            align-items: center;
            justify-content: flex-start; /* Left aligned for new style */
            text-align: left;
        }

        .header h1 {
          font-size: 1.5rem; /* Slightly smaller for a cleaner look */
          font-weight: 700;
          margin: 0;
        }

        .header p {
          color: rgba(255, 255, 255, 0.9);
          font-size: 0.8rem;
          margin-top: 0.1rem;
          font-weight: 300;
        }

        /* FLOATING FOOTER */
        .footer {
            position: fixed;
            bottom: var(--layout-margin);
            left: var(--layout-margin);
            right: var(--layout-margin);
            height: var(--footer-height);
            border-radius: var(--radius-large); /* Rounded corners all around */
            z-index: 100;
            font-size: 0.85rem;
            background: linear-gradient(90deg, var(--gradient-end) 0%, var(--gradient-start) 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            box-shadow: var(--shadow);
        }

        /* MAIN CONTENT AREA CONTAINER (Sidebar + Content) */
        .main-area {
            display: flex;
            flex-grow: 1;
            /* Push area down past the fixed header */
            margin-top: calc(var(--header-height) + var(--layout-margin));
            /* Shrink area up past the fixed footer */
            margin-bottom: var(--layout-margin);
            position: relative;
            height: calc(100vh - (var(--header-height) + var(--footer-height) + (var(--layout-margin) * 4)));
        }
        
        /* FIXED SIDEBAR (Vertical Nav) */
        .sidebar {
            width: var(--sidebar-width);
            height: 100%; /* Fill the height of main-area */
            background: var(--bg-card);
            border-radius: var(--radius-large);
            box-shadow: var(--shadow);
            border: 1px solid var(--border);
            padding: 1rem 0;
            z-index: 50;
            overflow-y: auto;
            flex-shrink: 0; /* Prevent shrinking */
            margin-right: var(--layout-margin); /* Space between sidebar and content */
        }

        /* VERTICAL TABS STYLES */
        .tabs-nav {
          display: block; /* Vertical layout */
          padding: 0;
          background: none;
          border: none;
          box-shadow: none;
        }

        .tabs-nav button {
          width: 100%;
          padding: 0.75rem 1.5rem;
          text-align: left;
          border-radius: 0;
          border-left: 4px solid transparent; /* Indicator line */
          transition: var(--transition);
          font-size: 1rem;
          background: transparent;
          color: var(--text-primary);
          font-weight: 500;
        }

        .tabs-nav button:hover:not(.active) {
            background: var(--bg-hover);
            border-left-color: var(--text-muted);
        }

        .tabs-nav button.active {
            background: var(--bg-hover); /* Keep background subtle */
            color: var(--accent);
            font-weight: 700;
            border-left-color: var(--accent); /* Strong accent line */
            box-shadow: none;
        }

        /* SCROLLABLE MAIN CONTENT AREA */
        .main-content-scroll {
            flex-grow: 1;
            overflow-y: auto;
            padding: 2rem; /* Inner padding for content */
            background: var(--bg-card);
            border-radius: var(--radius-large);
            box-shadow: var(--shadow);
            border: 1px solid var(--border);
        }

        /* --- Other Component Styles (Minified) --- */
        .message { padding: 1rem; margin-bottom: 1.5rem; border-radius: var(--radius); font-weight: 500; }
        .message.success { background-color: var(--success); color: white; }
        .message.error { background-color: var(--error); color: white; }
        button { cursor: pointer; transition: var(--transition); font-weight: 600; padding: 0.75rem 1.5rem; border: 1px solid transparent; border-radius: var(--radius-sm); position: relative; overflow: hidden; }
        .button-primary { background: linear-gradient(90deg, var(--gradient-start) 0%, var(--gradient-end) 100%); color: white; border: none; box-shadow: 0 2px 6px rgba(6, 182, 212, 0.4); }
        .button-primary:hover:not(:disabled) { transform: translateY(-1px); opacity: 0.9; box-shadow: 0 4px 10px rgba(6, 182, 212, 0.6); }
        .button-secondary { background-color: var(--bg-card); color: var(--text-primary); border: 1px solid var(--text-muted); }
        .button-secondary:hover:not(:disabled) { background-color: var(--bg-hover); border-color: var(--accent); color: var(--accent); }
        .button-danger { background-color: var(--error); color: white; box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4); }
        .button-danger:hover:not(:disabled) { background-color: #c73737; transform: translateY(-1px); }
        .button-danger-sm { padding: 0.3rem 0.6rem; font-size: 0.8rem; }
        .button-icon { display: inline-flex; align-items: center; justify-content: center; line-height: 1; }
        button:disabled { opacity: 0.6; cursor: not-allowed; box-shadow: none !important; }
        .submit-btn { width: 100%; margin-top: 1rem; }
        .button-add-scenario { margin-top: 1rem; display: flex; align-items: center; gap: 0.5rem; }
        .template-summary, .result-details summary { cursor: pointer; font-weight: 600; color: var(--accent); margin: 0.5rem 0; transition: color 0.2s; }
        .template-summary:hover, .result-details summary:hover { color: var(--gradient-end); }
        .section-title { font-size: 1.5rem; margin-bottom: 1.5rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--border); color: var(--text-primary); }
        .endpoint-form, .test-form, .upload-section { background: var(--bg-card); padding: 2rem; border-radius: var(--radius); box-shadow: var(--shadow); border: 1px solid var(--border); }
        .form-group { margin-bottom: 1rem; flex: 1; }
        .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--text-primary); }
        .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background-color: var(--bg-card); color: var(--text-primary); transition: border-color 0.2s, box-shadow 0.2s; }
        .form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.1); outline: none; }
        .form-group textarea { resize: vertical; min-height: 100px; font-family: monospace; font-size: 0.9rem; }
        .form-group-row { display: flex; gap: 1.5rem; margin-bottom: 1rem; }
        .form-group-row .form-group { margin-bottom: 0; }
        .full-width { flex-basis: 100%; }
        .help-text { font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem; padding: 0.5rem; background: var(--bg-hover); border-radius: var(--radius-sm); border-left: 3px solid var(--accent); }
        .help-text-sm { font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem; }
        .endpoint-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
        .endpoint-card { background: var(--bg-card); padding: 1.5rem; border-radius: var(--radius); box-shadow: var(--shadow); border: 1px solid var(--border); position: relative; display: flex; flex-direction: column; }
        .scenario-count { font-size: 0.85rem; color: var(--accent); font-weight: 600; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.25rem; }
        .endpoint-id { font-size: 1.25rem; word-break: break-all; margin-bottom: 0.5rem; }
        .method-tag { position: absolute; top: 0; right: 0; padding: 0.3rem 0.6rem; border-radius: 0 var(--radius-sm) 0 var(--radius-sm); color: white; font-weight: 700; font-size: 0.8rem; }
        .method-tag[data-method="GET"] { background: var(--success); }
        .method-tag[data-method="POST"] { background: var(--info); }
        .method-tag[data-method="PUT"], .method-tag[data-method="PATCH"] { background: var(--warning); }
        .method-tag[data-method="DELETE"] { background: var(--error); }
        .details-row { display: flex; gap: 1rem; margin-bottom: 1rem; font-size: 0.9rem; color: var(--text-secondary); }
        .template-preview { background: var(--bg-page); padding: 1rem; border-radius: var(--radius-sm); white-space: pre-wrap; word-break: break-all; font-size: 0.85rem; max-height: 200px; overflow-y: auto; border: 1px dashed var(--border); margin-top: 0.5rem; }
        .actions { display: flex; gap: 0.5rem; margin-top: 1rem; }
        .scenario-editor { border-top: 2px solid var(--border); padding-top: 1.5rem; margin-top: 1.5rem; }
        .scenario-card { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 1rem; margin-bottom: 1rem; background: var(--bg-page); box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .scenario-name-input { color: var(--accent); }
        .result-status-code { font-weight: 700; padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); color: white; background: linear-gradient(90deg, var(--gradient-start) 0%, var(--gradient-end) 100%); }
        .result-card.status-error .result-status-code { background: var(--error); }
        .result-details summary { color: var(--accent); }
        
        /* Mobile adjustments for the new layout */
        @media (max-width: 768px) {
            .app-layout-wrapper {
                padding: 0.5rem; /* Reduce overall margin on mobile */
            }
            .header {
                height: 60px;
                --header-height: 60px;
                padding: 0 1rem;
            }
            .header p { display: none; }
            .header h1 { font-size: 1.25rem; }

            .main-area {
                flex-direction: column; /* Stack sidebar and content */
                margin-top: calc(var(--header-height) + 0.5rem);
                margin-bottom: 0;
                height: auto;
            }

            .sidebar {
                position: static; /* Unfix sidebar */
                width: 100%;
                height: auto;
                margin: 0 0 0.5rem 0; /* Margin only at the bottom */
                padding: 0.5rem 0;
            }
            
            /* Change vertical tabs back to horizontal wrap on mobile */
            .tabs-nav {
                display: flex;
                flex-wrap: wrap;
            }
            
            .tabs-nav button {
                flex-grow: 1;
                flex-basis: 48%; /* Two buttons per row */
                text-align: center;
                border-left: none;
                border-radius: var(--radius-sm);
                margin: 0.1rem 0.2rem;
            }

            .tabs-nav button.active {
                border-left: none;
                border: 2px solid var(--accent); /* Use border instead of left line */
            }

            .main-content-scroll {
                margin-left: 0;
                border-radius: var(--radius-large);
                padding: 1rem;
            }
            .footer {
                --footer-height: 40px;
                height: var(--footer-height);
                font-size: 0.75rem;
            }
        }
      `}</style>

      {/* FLOATING HEADER */}
      <header className="header">
        <div>
            <h1>Mock API Environment</h1>
            <p>Define and test dynamic REST API endpoints instantly.</p>
        </div>
      </header>
      
      {/* MAIN AREA: SIDEBAR + CONTENT CONTAINER */}
      <div className="main-area">

        {/* FIXED SIDEBAR (VERTICAL NAVIGATION) */}
        <aside className="sidebar">
            <nav className="tabs-nav">
              <button
                className={activeTab === 'endpoints' ? 'active' : ''}
                onClick={() => setActiveTab('endpoints')}
              >
                View Endpoints ({endpoints.length})
              </button>
              <button
                className={activeTab === 'create' ? 'active' : ''}
                onClick={() => {
                    setActiveTab('create');
                    setEditingEndpoint(null); // Clear editing state when switching to create
                    setNewEndpoint({
                      endpointId: '/users/:id',
                      responseTemplate: '{\n  "status": "success",\n  "message": "User {{path.id}} details retrieved.",\n  "query_filter": "{{query.filter}}",\n  "data_received": {{body}}\n}',
                      method: 'GET',
                      statusCode: 200,
                      delay: 0,
                      internalId: '',
                      scenarios: []
                    });
                }}
              >
                {editingEndpoint ? 'Edit Endpoint' : 'Create Endpoint'}
              </button>
              <button
                className={activeTab === 'test' ? 'active' : ''}
                onClick={() => setActiveTab('test')}
              >
                Test API
              </button>
              <button
                className={activeTab === 'schema' ? 'active' : ''}
                onClick={() => setActiveTab('schema')}
              >
                Upload Schema
              </button>
            </nav>
        </aside>

        {/* SCROLLABLE MAIN CONTENT AREA */}
        <div className="main-content-scroll">
            {message && <div className={`message ${message.startsWith('Error') ? 'error' : 'success'}`}>{message}</div>}

            <div className="tab-content">
              {/* VIEW ENDPOINTS TAB */}
              {activeTab === 'endpoints' && (
                <section className="endpoint-list-section">
                  <h2 className="section-title">Registered Mock Endpoints</h2>
                  {loading && <p className="loading">Loading...</p>}
                  {endpoints.length === 0 && !loading && (
                    <p className="empty-state">No endpoints defined. Create one in the "Create Endpoint" tab.</p>
                  )}
                  <div className="endpoint-grid">
                    {endpoints.map(endpoint => (
                      <div key={endpoint.internalId} className="endpoint-card">
                        <div className="method-tag" data-method={endpoint.method}>
                          {endpoint.method}
                        </div>
                        <h3 className="endpoint-id">{endpoint.endpointId}</h3>
                        <div className="details-row">
                          <span>Default Status: <strong>{endpoint.statusCode}</strong></span>
                          <span>Default Delay: <strong>{endpoint.delay}ms</strong></span>
                        </div>
                        {endpoint.scenarios && endpoint.scenarios.length > 0 && (
                            <div className="scenario-count">
                                <ShieldIcon />
                                {endpoint.scenarios.length} Conditional Scenario(s)
                            </div>
                        )}
                        <details>
                          <summary className="template-summary">Default Response Template</summary>
                          <pre className="template-preview">{endpoint.responseTemplate}</pre>
                        </details>
                        <div className="actions">
                          <button onClick={() => handleTestEndpoint(endpoint)} className="button-primary">
                              Test
                          </button>
                          <button onClick={() => handleEdit(endpoint)} className="button-secondary">Edit</button>
                          <button onClick={() => handleDeleteEndpoint(endpoint.internalId, endpoint.endpointId)} className="button-danger">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* CREATE/EDIT ENDPOINT TAB */}
              {activeTab === 'create' && (
                <section className="form-section">
                  <h2 className="section-title">{editingEndpoint ? `Editing: ${editingEndpoint} (${newEndpoint.method})` : 'Create New Endpoint'}</h2>
                  <form onSubmit={handleSaveEndpoint} className="endpoint-form">
                    <div className="form-group">
                      <label htmlFor="endpointId">Endpoint URL (e.g., /users/:id)</label>
                      <input
                        type="text"
                        id="endpointId"
                        name="endpointId"
                        value={newEndpoint.endpointId}
                        onChange={handleInputChange}
                        placeholder="/users/:id"
                        required
                      />
                    </div>

                    <h3 className="scenario-title" style={{marginTop: '1rem'}}>Default Response Settings</h3>

                    <div className="form-group-row">
                      <div className="form-group">
                        <label htmlFor="method">Method</label>
                        <select
                          id="method"
                          name="method"
                          value={newEndpoint.method}
                          onChange={handleInputChange}
                        >
                          <option>GET</option>
                          <option>POST</option>
                          <option>PUT</option>
                          <option>DELETE</option>
                          <option>PATCH</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label htmlFor="statusCode">Default Status Code</label>
                        <input
                          type="number"
                          id="statusCode"
                          name="statusCode"
                          value={newEndpoint.statusCode}
                          onChange={handleInputChange}
                          min="100"
                          max="599"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="delay">Default Delay (ms)</label>
                        <input
                          type="number"
                          id="delay"
                          name="delay"
                          value={newEndpoint.delay}
                          onChange={handleInputChange}
                          min="0"
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group full-width">
                      <label htmlFor="responseTemplate">
                          Default Response Template (JSON)
                      </label>
                      <textarea
                        id="responseTemplate"
                        name="responseTemplate"
                        value={newEndpoint.responseTemplate}
                        onChange={handleInputChange}
                        rows="10"
                        required
                      ></textarea>
                      <p className="help-text">
                          Use placeholders:
                          <code>&lbrace;&lbrace;path.param&rbrace;&rbrace;</code>,
                          <code>&lbrace;&lbrace;query.param&rbrace;&rbrace;</code>,
                          <code>&lbrace;&lbrace;body.field&rbrace;&rbrace;</code>,
                          and <code>&lbrace;&lbrace;body&rbrace;&rbrace;</code>.
                      </p>
                    </div>

                    {/* New Scenario Editor */}
                    <ScenarioEditor endpoint={newEndpoint} setNewEndpoint={setNewEndpoint} />

                    <button type="submit" disabled={loading} className="button-primary submit-btn">
                      {loading ? 'Saving...' : editingEndpoint ? 'Update Endpoint' : 'Create Endpoint'}
                    </button>
                  </form>
                </section>
              )}

              {/* SCHEMA UPLOAD TAB */}
              {activeTab === 'schema' && (
                <section className="upload-section">
                  <h2 className="section-title">Upload Endpoint Schema (JSON)</h2>
                  <div className="upload-area">
                    <label htmlFor="schemaUpload" className="upload-label">
                      <div className="upload-content">
                        <span className="upload-icon">
                          <UploadIcon />
                        </span>
                        <div className="upload-text">
                          <strong>Click to upload your endpoint JSON schema file.</strong>
                          <p>File must be an array of endpoint objects.</p>
                        </div>
                      </div>
                      <input
                        type="file"
                        id="schemaUpload"
                        accept=".json"
                        onChange={handleUploadSchema}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                  {uploadMessage && <div className="upload-message">{uploadMessage}</div>}

                  <div className="upload-help">
                    <h4>Example Schema Format (with Scenarios)</h4>
                    <pre>{JSON.stringify([{
                        "endpointId": "/products/:id",
                        "method": "GET",
                        "statusCode": 200,
                        "delay": 100,
                        "responseTemplate": "{\n  \"product_id\": \"{{path.id}}\",\n  \"status\": \"available\"\n}",
                        "scenarios": [
                          {
                            "name": "Out of Stock",
                            "condition": "path.id === 'oos'",
                            "statusCode": 404,
                            "responseTemplate": "{\n  \"error\": \"Product {{path.id}} is out of stock.\"\n}"
                          }
                        ]
                    },
                    {
                        "endpointId": "/orders",
                        "method": "POST",
                        "statusCode": 201,
                        "responseTemplate": "{\n  \"message\": \"Order received\",\n  \"data\": {{body}}\n}"
                    }], null, 2)}</pre>
                  </div>
                </section>
              )}

              {/* TEST API TAB */}
              {activeTab === 'test' && (
                <section className="test-api-section">
                  <h2 className="section-title">Test Dynamic API Call</h2>
                  <form onSubmit={handleTestApi} className="test-form">
                    <div className="form-group-row">
                      <div className="form-group method-selector">
                        <select
                          id="method"
                          name="method"
                          value={testConfig.method}
                          onChange={handleTestConfigChange}
                        >
                          <option>GET</option>
                          <option>POST</option>
                          <option>PUT</option>
                          <option>DELETE</option>
                          <option>PATCH</option>
                        </select>
                      </div>
                      <div className="form-group full-width url-input">
                        <input
                          type="text"
                          id="endpointId"
                          name="endpointId"
                          value={testConfig.endpointId}
                          onChange={handleTestConfigChange}
                          placeholder="/api/users/123?filter=active"
                          required
                        />
                      </div>
                      <button
                        type="button"
                        className="button-icon button-secondary"
                        onClick={() => setTestConfig(prev => ({ ...prev, showAdvanced: !prev.showAdvanced }))}
                        title="Toggle advanced request options"
                      >
                        <ChevronDownIcon className={`icon-chevron ${testConfig.showAdvanced ? 'up' : 'down'}`} />
                      </button>
                    </div>

                    {testConfig.showAdvanced && (
                      <div className="advanced-options">
                          <div className="form-group-row">
                              <div className="form-group">
                                  <label htmlFor="urlParams">Path Parameters (JSON)</label>
                                  <textarea
                                    id="urlParams"
                                    name="urlParams"
                                    value={testConfig.urlParams}
                                    onChange={handleTestConfigChange}
                                    rows="3"
                                    placeholder='{"id": "123"}'
                                  ></textarea>
                                  <p className="help-text">Manually set path parameters for **&lbrace;&lbrace;path.param&rbrace;&rbrace;**.</p>
                              </div>
                              <div className="form-group">
                                  <label htmlFor="queryParams">Query Parameters (JSON)</label>
                                  <textarea
                                    id="queryParams"
                                    name="queryParams"
                                    value={testConfig.queryParams}
                                    onChange={handleTestConfigChange}
                                    rows="3"
                                    placeholder='{"limit": 10, "page": 1}'
                                  ></textarea>
                                  <p className="help-text">Manually set query parameters for **&lbrace;&lbrace;query.param&rbrace;&rbrace;** (overrides URL query).</p>
                              </div>
                          </div>

                        {(testConfig.method === 'POST' || testConfig.method === 'PUT' || testConfig.method === 'PATCH') && (
                          <div className="form-group full-width">
                            <label htmlFor="bodyParams">Request Body (JSON)</label>
                            <textarea
                              id="bodyParams"
                              name="bodyParams"
                              value={testConfig.bodyParams}
                              onChange={handleTestConfigChange}
                              rows="5"
                              placeholder='{"name": "John", "status": "active"}'
                            ></textarea>
                            <p className="help-text">Used for **&lbrace;&lbrace;body.field&rbrace;&rbrace;** or **&lbrace;&lbrace;body&rbrace;&rbrace;** placeholders.</p>
                          </div>
                        )}
                      </div>
                    )}

                    <button type="submit" disabled={loading} className="button-primary submit-btn">
                      {loading ? 'Sending Request...' : `Send ${testConfig.method} Request`}
                    </button>
                  </form>

                  {testResults.length > 0 && (
                    <div className="results-container">
                      <h3 className="results-title">Test History (Last 5)</h3>
                      <div className="results-list">
                        {testResults.map(result => (
                          <div key={result.id} className={`result-card status-${result.statusCode >= 400 ? 'error' : 'success'}`}>
                            <div className="result-header">
                              <span className="result-status-code">{result.statusCode}</span>
                              <span className="result-latency">{result.latency}ms</span>
                              <span className="result-url">
                                <strong>{result.method}</strong> {API_BASE}{result.url.split('?')[0]}
                              </span>
                            </div>

                            <div className="result-details">
                              <details>
                                <summary>Request Details</summary>
                                <div className="request-info">
                                  <p><strong>Path Params:</strong>
                                    <code>{JSON.stringify(result.request.pathParams)}</code>
                                  </p>
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
                                <summary>Dynamic Response</summary>
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
      </div>
      
      {/* FLOATING FOOTER */}
      <footer className="footer">
        <p>Dynamic Mock API Generator &copy; {new Date().getFullYear()}.</p>
      </footer>
    </div>
  );
}

export default App;
