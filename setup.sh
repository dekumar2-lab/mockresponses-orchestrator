#!/bin/bash
echo "🚀 Setting up Mock Server Demo..."
mkdir -p server client scripts
mkdir -p server/routes server/middleware
mkdir -p client/public client/src client/src/components

# Create root package.json
cat > package.json << 'ROOT'
{
  "name": "mock-server-demo",
  "version": "1.0.0",
  "description": "Combined React & Node.js Mock Server",
  "main": "server/server.js",
  "scripts": {
    "dev": "concurrently \"npm run server\" \"npm run client\"",
    "server": "cd server && npm run dev",
    "client": "cd client && npm start",
    "build": "cd client && npm run build",
    "start": "cd server && npm start",
    "install-all": "npm install && cd server && npm install && cd ../client && npm install"
  },
  "devDependencies": {
    "concurrently": "^8.2.0"
  },
  "engines": {
    "node": ">=14.0.0"
  }
}
ROOT

# Create server package.json
cat > server/package.json << 'SERVER'
{
  "name": "mock-server",
  "version": "1.0.0",
  "description": "Mock Server Backend",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "multer": "^1.4.5",
    "body-parser": "^1.20.2",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
SERVER

# Create client package.json
cat > client/package.json << 'CLIENT'
{
  "name": "mock-server-client",
  "version": "1.0.0",
  "description": "Mock Server Dashboard",
  "proxy": "http://localhost:5000",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "axios": "^1.5.0",
    "react-scripts": "5.0.1"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  }
}
CLIENT

echo "✅ Basic structure created!"
echo "📦 Installing dependencies..."

# Install dependencies
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

echo "🎉 Setup complete!"
echo "🚀 Run: npm run dev"
