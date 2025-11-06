const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = 5000;

// CORS configuration that works
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from React build
app.use(express.static(path.join(__dirname, '../client/build')));

// Storage for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// In-memory database
const db = {
  mockEndpoints: new Map(),
  apiContracts: new Map()
};

// Sample initial data for demo
db.mockEndpoints.set('demo-user', {
  id: 'demo-user',
  method: 'GET',
  response: { 
    id: "{{userId}}", 
    name: "John Doe", 
    email: "john@example.com",
    dynamicParam: "{{userId}}"
  },
  statusCode: 200,
  delay: 0,
  createdAt: new Date().toISOString()
});

db.mockEndpoints.set('demo-products', {
  id: 'demo-products',
  method: 'GET',
  response: [
    { id: 1, name: "Product 1", price: 99.99 },
    { id: 2, name: "Product 2", price: 149.99 }
  ],
  statusCode: 200,
  delay: 0,
  createdAt: new Date().toISOString()
});

// Utility function to evaluate dynamic responses
const evaluateDynamicResponse = (responseTemplate, req) => {
  try {
    if (typeof responseTemplate === 'string') {
      return responseTemplate.replace(/\{\{(\w+)\}\}/g, (match, param) => {
        return req.params[param] || req.query[param] || req.body[param] || match;
      });
    } else if (typeof responseTemplate === 'object') {
      const stringified = JSON.stringify(responseTemplate);
      const evaluated = stringified.replace(/\{\{(\w+)\}\}/g, (match, param) => {
        return req.params[param] || req.query[param] || req.body[param] || match;
      });
      return JSON.parse(evaluated);
    }
    return responseTemplate;
  } catch (error) {
    console.error('Error evaluating dynamic response:', error);
    return responseTemplate;
  }
};

// 1. Dynamic mock endpoint with parameter support
app.all('/api/mock/:endpointId', (req, res) => {
  const { endpointId } = req.params;
  const mockConfig = db.mockEndpoints.get(endpointId);
  
  if (!mockConfig) {
    return res.status(404).json({ 
      error: 'Mock endpoint not found',
      availableEndpoints: Array.from(db.mockEndpoints.keys())
    });
  }

  const sendResponse = () => {
    try {
      const response = evaluateDynamicResponse(mockConfig.response, req);
      
      // Set custom headers if configured
      if (mockConfig.headers) {
        Object.entries(mockConfig.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }
      
      res.status(mockConfig.statusCode || 200).json(response);
    } catch (error) {
      console.error('Error generating response:', error);
      res.status(500).json({ error: 'Error generating mock response' });
    }
  };

  // Simulate delay if configured
  if (mockConfig.delay && mockConfig.delay > 0) {
    setTimeout(sendResponse, mockConfig.delay);
  } else {
    sendResponse();
  }
});

// 2. Get all mock endpoints
app.get('/api/mock-endpoints', (req, res) => {
  try {
    const endpoints = Array.from(db.mockEndpoints.entries()).map(([id, config]) => ({
      id,
      ...config
    }));
    res.json(endpoints);
  } catch (error) {
    console.error('Error getting endpoints:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Get specific mock endpoint
app.get('/api/mock-endpoints/:endpointId', (req, res) => {
  const { endpointId } = req.params;
  const endpoint = db.mockEndpoints.get(endpointId);
  
  if (!endpoint) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  
  res.json(endpoint);
});

// 4. Create new mock endpoint
app.post('/api/mock-endpoints', (req, res) => {
  try {
    const { endpointId, response, method = 'GET', statusCode = 200, delay = 0, headers = {} } = req.body;
    
    if (!endpointId || response === undefined) {
      return res.status(400).json({ error: 'endpointId and response are required' });
    }

    if (db.mockEndpoints.has(endpointId)) {
      return res.status(409).json({ error: 'Endpoint ID already exists' });
    }

    const mockConfig = {
      id: endpointId,
      method: method.toUpperCase(),
      response,
      statusCode,
      delay: parseInt(delay) || 0,
      headers,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.mockEndpoints.set(endpointId, mockConfig);
    
    res.status(201).json({
      message: 'Mock endpoint created successfully',
      endpoint: mockConfig,
      testUrl: `/api/mock/${endpointId}`
    });
  } catch (error) {
    console.error('Error creating endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. Update existing mock endpoint
app.put('/api/mock-endpoints/:endpointId', (req, res) => {
  try {
    const { endpointId } = req.params;
    const { response, method, statusCode, delay, headers } = req.body;
    
    const mockConfig = db.mockEndpoints.get(endpointId);
    if (!mockConfig) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }

    // Update only provided fields
    if (response !== undefined) mockConfig.response = response;
    if (method) mockConfig.method = method.toUpperCase();
    if (statusCode) mockConfig.statusCode = statusCode;
    if (delay !== undefined) mockConfig.delay = parseInt(delay) || 0;
    if (headers) mockConfig.headers = headers;
    mockConfig.updatedAt = new Date().toISOString();

    res.json({
      message: 'Mock endpoint updated successfully',
      endpoint: mockConfig
    });
  } catch (error) {
    console.error('Error updating endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 6. Delete mock endpoint
app.delete('/api/mock-endpoints/:endpointId', (req, res) => {
  try {
    const { endpointId } = req.params;
    
    if (db.mockEndpoints.delete(endpointId)) {
      res.json({ message: 'Mock endpoint deleted successfully' });
    } else {
      res.status(404).json({ error: 'Endpoint not found' });
    }
  } catch (error) {
    console.error('Error deleting endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 7. Upload API contract and create mock responses
app.post('/api/upload-contract', upload.single('contract'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const contractData = JSON.parse(req.file.buffer.toString());
    const contractId = uuidv4();

    // Store the contract
    db.apiContracts.set(contractId, {
      id: contractId,
      name: req.body.name || 'Unnamed Contract',
      data: contractData,
      uploadedAt: new Date().toISOString()
    });

    // Create mock endpoints from contract
    const createdEndpoints = [];
    if (contractData.endpoints) {
      contractData.endpoints.forEach((endpoint, index) => {
        const endpointId = endpoint.id || `contract-${contractId}-${index}`;
        const mockConfig = {
          id: endpointId,
          method: endpoint.method || 'GET',
          response: endpoint.response || { message: 'Mock response from contract' },
          statusCode: endpoint.statusCode || 200,
          delay: endpoint.delay || 0,
          headers: endpoint.headers || {},
          fromContract: contractId,
          createdAt: new Date().toISOString()
        };

        db.mockEndpoints.set(endpointId, mockConfig);
        createdEndpoints.push({
          id: endpointId,
          url: `/api/mock/${endpointId}`,
          method: mockConfig.method,
          statusCode: mockConfig.statusCode
        });
      });
    }

    res.json({
      message: 'Contract uploaded successfully',
      contractId,
      createdEndpoints,
      totalEndpoints: createdEndpoints.length
    });
  } catch (error) {
    console.error('Error uploading contract:', error);
    res.status(500).json({ error: 'Failed to process contract file' });
  }
});

// 8. Upload JSON response for existing API
app.post('/api/upload-response/:endpointId', upload.single('response'), (req, res) => {
  try {
    const { endpointId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const responseData = JSON.parse(req.file.buffer.toString());
    const mockConfig = db.mockEndpoints.get(endpointId);

    if (!mockConfig) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }

    mockConfig.response = responseData;
    mockConfig.updatedAt = new Date().toISOString();

    res.json({ 
      message: 'Response updated successfully', 
      endpoint: mockConfig 
    });
  } catch (error) {
    console.error('Error uploading response:', error);
    res.status(500).json({ error: 'Failed to process response file' });
  }
});

// 9. Add mock response to any existing API (proxy-like functionality)
app.post('/api/proxy-mock', (req, res) => {
  try {
    const { originalUrl, mockResponse, method = 'ALL', statusCode = 200, delay = 0 } = req.body;
    
    if (!originalUrl || !mockResponse) {
      return res.status(400).json({ error: 'originalUrl and mockResponse are required' });
    }

    const endpointId = `proxy-${uuidv4().slice(0, 8)}`;
    const mockConfig = {
      id: endpointId,
      originalUrl,
      method: method.toUpperCase(),
      response: mockResponse,
      statusCode,
      delay: parseInt(delay) || 0,
      isProxy: true,
      createdAt: new Date().toISOString()
    };

    db.mockEndpoints.set(endpointId, mockConfig);

    res.status(201).json({
      message: 'Proxy mock created successfully',
      endpointId,
      config: mockConfig,
      testUrl: `/api/mock/${endpointId}`
    });
  } catch (error) {
    console.error('Error creating proxy mock:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 10. Get all API contracts
app.get('/api/contracts', (req, res) => {
  try {
    const contracts = Array.from(db.apiContracts.entries()).map(([id, contract]) => ({
      id,
      ...contract
    }));
    res.json(contracts);
  } catch (error) {
    console.error('Error getting contracts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 11. Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    totalEndpoints: db.mockEndpoints.size,
    totalContracts: db.apiContracts.size,
    version: '1.0.0'
  });
});

// 12. Get server statistics
app.get('/api/stats', (req, res) => {
  const endpointsByMethod = {};
  db.mockEndpoints.forEach(endpoint => {
    const method = endpoint.method;
    endpointsByMethod[method] = (endpointsByMethod[method] || 0) + 1;
  });

  res.json({
    totalEndpoints: db.mockEndpoints.size,
    totalContracts: db.apiContracts.size,
    endpointsByMethod,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// 13. Clear all data (for testing)
app.delete('/api/clear-all', (req, res) => {
  try {
    const endpointsCount = db.mockEndpoints.size;
    const contractsCount = db.apiContracts.size;
    
    db.mockEndpoints.clear();
    db.apiContracts.clear();
    
    // Add back demo endpoints
    db.mockEndpoints.set('demo-user', {
      id: 'demo-user',
      method: 'GET',
      response: { 
        id: "{{userId}}", 
        name: "John Doe", 
        email: "john@example.com",
        dynamicParam: "{{userId}}"
      },
      statusCode: 200,
      delay: 0,
      createdAt: new Date().toISOString()
    });

    db.mockEndpoints.set('demo-products', {
      id: 'demo-products',
      method: 'GET',
      response: [
        { id: 1, name: "Product 1", price: 99.99 },
        { id: 2, name: "Product 2", price: 149.99 }
      ],
      statusCode: 200,
      delay: 0,
      createdAt: new Date().toISOString()
    });

    res.json({
      message: 'All data cleared successfully',
      deletedEndpoints: endpointsCount,
      deletedContracts: contractsCount,
      demoEndpointsAdded: 2
    });
  } catch (error) {
    console.error('Error clearing data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 14. Serve React app for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: error.message 
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    error: 'API endpoint not found',
    availableEndpoints: [
      'GET    /api/health',
      'GET    /api/mock-endpoints',
      'POST   /api/mock-endpoints',
      'GET    /api/mock-endpoints/:id',
      'PUT    /api/mock-endpoints/:id', 
      'DELETE /api/mock-endpoints/:id',
      'POST   /api/upload-contract',
      'POST   /api/upload-response/:id',
      'POST   /api/proxy-mock',
      'GET    /api/contracts',
      'GET    /api/stats',
      'DELETE /api/clear-all'
    ]
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Mock Server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔌 API Base: http://localhost:${PORT}/api`);
  console.log(`🎯 Sample endpoints:`);
  console.log(`   GET http://localhost:${PORT}/api/mock/demo-user`);
  console.log(`   GET http://localhost:${PORT}/api/mock/demo-products`);
  console.log(`   GET http://localhost:${PORT}/api/mock-endpoints`);
  console.log(`   GET http://localhost:${PORT}/api/health`);
  console.log(`\n📁 Available API Routes:`);
  console.log(`   Health:        GET /api/health`);
  console.log(`   Endpoints:     GET,POST /api/mock-endpoints`);
  console.log(`   Single:        GET,PUT,DELETE /api/mock-endpoints/:id`);
  console.log(`   Upload:        POST /api/upload-contract`);
  console.log(`   Upload Resp:   POST /api/upload-response/:id`);
  console.log(`   Proxy Mock:    POST /api/proxy-mock`);
  console.log(`   Contracts:     GET /api/contracts`);
  console.log(`   Stats:         GET /api/stats`);
  console.log(`   Clear:         DELETE /api/clear-all`);
});