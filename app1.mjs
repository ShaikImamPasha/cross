// app.mjs
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Define the CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Define the Swiggy API proxy route
app.use('/api/proxy/swiggy/dapi', createProxyMiddleware({
  target: 'https://www.swiggy.com',
  changeOrigin: true,
}));

app.listen(PORT, () => {
  console.log('Server is running on port', PORT);
});
