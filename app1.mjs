import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import bodyParser from 'body-parser';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config()

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(cors());
app.use(bodyParser.json());

// Define the CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Connect to MongoDB
mongoose.connect(process.env.CONFIGURATION_KEY);

// Create a Mongoose schema for comments
const commentSchema = new mongoose.Schema({
  name: String,
  message: String,
  replies: [
    {
      name: String,
      message: String,
    },
  ],
});

// Create a Mongoose schema for restaurants
const restaurantSchema = new mongoose.Schema({
  restaurantId: Number,
  comments: [commentSchema],
});

const Restaurant = mongoose.model('Restaurant', restaurantSchema);

// Create an HTTP server and integrate socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:1234/",
    methods: ["GET", "POST"]
  }
});

// Socket.IO connection event on the '/socket' namespace
const socketIoNamespace = io.of('/socket');

socketIoNamespace.on('connection', (socket) => {
  console.log('A user connected');

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });

  // Handle the socket event to add a new comment
  socket.on('addComment', async ({ restaurantId, newComment }) => {
    try {
      let restaurant = await Restaurant.findOne({ restaurantId });

      if (!restaurant) {
        // If the restaurant doesn't exist, create a new one
        restaurant = new Restaurant({
          restaurantId,
          comments: [newComment],
        });
      } else {
        // If the restaurant exists, add the comment
        restaurant.comments.push(newComment);
      }

      await restaurant.save();
      let allData = await Restaurant.find({});

      // Emit a socket event to notify connected clients about the new comment
      socketIoNamespace.emit('newComment', restaurant);
    } catch (error) {
      console.error(error);
      // Handle errors
    }
  });

  // Handle the socket event to add a reply
  socket.on('addReply', async ({ restaurantId, commentIndex, newReply }) => {
    try {
      const restaurant = await Restaurant.findOne({ restaurantId });
      if (!restaurant || !restaurant.comments[commentIndex]) {
        socket.emit('replyError', 'Restaurant or comment not found');
        return;
      }

      // If the restaurant and comment exist, add the reply
      restaurant.comments[commentIndex].replies.push(newReply);
      await restaurant.save();

      // Emit a socket event to notify clients about the new reply
      socketIoNamespace.emit('newReply', restaurant);
    } catch (error) {
      console.error(error);
      socket.emit('replyError', 'Internal Server Error');
    }
  });

  socket.on('requestInitialData', async ({ restaurantId }) => {
    try {
      const restaurant = await Restaurant.findOne({ restaurantId });

      if (restaurant) {
        // If the restaurant exists, emit the initial data
        socket.emit('initialData', restaurant);
      }
    } catch (error) {
      console.error(error);
    }
  });
});

// Define the Swiggy API proxy route
app.use('/api/proxy/swiggy/dapi', createProxyMiddleware({
  target: 'https://www.swiggy.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api/proxy/swiggy/dapi': '/dapi',
  },
}));

server.listen(PORT, () => {
  console.log('Server is running on port', PORT);
});
