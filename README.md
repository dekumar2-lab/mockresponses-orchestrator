# Mock Server Demo 🚀

A complete React & Node.js mock server application for testing and demo purposes.

## Features
- ✅ Create dynamic mock endpoints
- ✅ Upload API contracts (JSON)
- ✅ Dynamic responses based on request parameters
- ✅ In-memory database
- ✅ File upload for responses
- ✅ Ready for deployment

## Quick Start

### Installation
\`\`\`bash
# Install all dependencies
npm run install-all

# Development mode (runs both frontend and backend)
npm run dev

# Production build
npm run build
npm start
\`\`\`

### Development URLs
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api
- Health Check: http://localhost:5000/api/health

## Demo Endpoints
After loading demo data, test these endpoints:

### E-Commerce API
\`\`\`bash
GET /api/mock/get-products
GET /api/mock/get-product-detail?productId=123
\`\`\`

### Banking API
\`\`\`bash
GET /api/mock/account-balance?accountId=ACC123
\`\`\`

### Weather API
\`\`\`bash
GET /api/mock/current-weather?city=NewYork
\`\`\`

## API Usage

### Create Mock Endpoint
\`\`\`bash
POST /api/mock-endpoints
{
  "endpointId": "user-api",
  "method": "GET",
  "response": {"message": "Hello {{name}}"},
  "statusCode": 200,
  "delay": 1000
}
\`\`\`

### Test Endpoint
\`\`\`bash
GET /api/mock/user-api?name=John
\`\`\`

## Deployment

### Heroku
\`\`\`bash
# Add Procfile
web: npm start

# Deploy
git push heroku main
\`\`\`

### Other Platforms
The app is ready for:
- Netlify
- Vercel
- Railway
- Any Node.js hosting
