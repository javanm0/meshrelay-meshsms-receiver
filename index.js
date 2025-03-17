require('dotenv').config();
console.log('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID); // Add this line for debugging
console.log('TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN); // Add this line for debugging
const express = require('express');
const { MessagingResponse } = require('twilio').twiml;
const axios = require('axios');
const mongoose = require('mongoose');
const twilio = require('twilio');

const app = express();
const port = 3050;
const processInterval = process.env.PROCESS_INTERVAL || 10000; // Default to 10 seconds if not set

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));

// Define a schema and model for messages
const messageSchema = new mongoose.Schema({
  _id: String,
  node_id: String, // Changed from Number to String
  message: String,
  timestamp: Date,
  phoneNumber: String,
  messageSent: Boolean
});

const SMS = mongoose.model('SMS', messageSchema);

app.use(express.json());

// Endpoint to handle incoming SMS
app.post('/api/sms-receiver', async (req, res) => {
  const messageBody = req.body.Body;
  const phoneNumber = req.body.From;

  // Extract node_id from the message
  const nodeIdMatch = messageBody.match(/\b\d{9,10}\b/); // Adjusted regex to match 9 or 10 digit numbers
  const node_id = nodeIdMatch ? nodeIdMatch[0] : null;
  const message = nodeIdMatch ? messageBody.replace(nodeIdMatch[0], '').trim() : messageBody;

  console.log('Received message:', messageBody);
  console.log('Extracted node_id:', node_id);

  if (!node_id) {
    console.log('No node_id found in the message:', messageBody);
    return res.sendStatus(200); // Send a 200 OK response without any content
  }

  const messageData = {
    _id: req.body.MessageSid,
    node_id: node_id,
    message: message,
    timestamp: new Date(),
    phoneNumber: phoneNumber,
    messageSent: false
  };

  if (phoneNumber === process.env.SENDER_PHONE_NUMBER) {
    console.log(`Message from ${process.env.SENDER_PHONE_NUMBER}, not saving to MongoDB`);
    return res.sendStatus(200); // Send a 200 OK response without any content
  }

  try {
    const newMessage = new SMS(messageData);
    await newMessage.save();
    console.log(`Message with ID ${messageData._id} saved to MongoDB`);
  } catch (error) {
    console.error('Error saving message to MongoDB:', error);
  }

  res.sendStatus(200); // Send a 200 OK response without any content
});

// Function to fetch messages from Twilio
async function fetchMessages() {
  try {
    const messages = await client.messages.list({ limit: 20 });
    return messages.map(message => {
      const nodeIdMatch = message.body.match(/\b\d{9,10}\b/); // Adjusted regex to match 9 or 10 digit numbers
      const node_id = nodeIdMatch ? nodeIdMatch[0] : null;
      const messageBody = nodeIdMatch ? message.body.replace(nodeIdMatch[0], '').trim() : message.body;

      return {
        _id: message.sid,
        node_id: node_id,
        message: messageBody,
        timestamp: new Date(message.dateCreated),
        phoneNumber: message.from,
        messageSent: false
      };
    });
  } catch (error) {
    console.error('Error fetching messages from Twilio:', error);
    return [];
  }
}

// Function to save messages to MongoDB
async function saveMessages(messages) {
  try {
    for (const message of messages) {
      if (message.phoneNumber === process.env.SENDER_PHONE_NUMBER) {
        console.log(`Message from ${process.env.SENDER_PHONE_NUMBER}, not saving to MongoDB`);
        continue;
      }

      if (!message.node_id) {
        console.log('No node_id found in the message:', message.message);
        continue;
      }

      const existingMessage = await SMS.findById(message._id);
      if (!existingMessage) {
        const newMessage = new SMS(message);
        await newMessage.save();
        console.log(`Message with ID ${message._id} saved to MongoDB`);
      } else {
        console.log(`Message with ID ${message._id} already exists in MongoDB`);
      }
    }
  } catch (error) {
    console.error('Error saving messages to MongoDB:', error);
  }
}

// Function to process messages
async function processMessages() {
  const messages = await fetchMessages();
  await saveMessages(messages);
}

// Start the Express server and set up the message processing interval
app.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
  processMessages(); // Initial call
  setInterval(processMessages, processInterval); // Call at the specified interval
});