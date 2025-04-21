require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(express.static('public'));

const MODELS = [
  { name: 'GPT‑3.5', model: 'gpt-3.5-turbo', system: 'You are GPT‑3.5...' },
  { name: 'GPT‑4',   model: 'gpt-4',          system: 'You are GPT‑4...'   },
  { name: 'GPT‑4‑Turbo', model: 'gpt-4-turbo', system: 'You are GPT‑4‑Turbo...'}
];

const DAILY_LIMIT = 20;
const RATE_LIMIT_FILE = path.join(__dirname, 'api_usage.json');

// Initialize or load the API usage tracker
function getApiUsage() {
  try {
    if (fs.existsSync(RATE_LIMIT_FILE)) {
      const data = JSON.parse(fs.readFileSync(RATE_LIMIT_FILE, 'utf8'));
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Reset counter if it's a new day
      if (data.date !== today) {
        return { count: 0, date: today };
      }
      return data;
    }
  } catch (error) {
    console.error('Error reading API usage file:', error);
  }
  
  // Default to new counter
  return { count: 0, date: new Date().toISOString().split('T')[0] };
}

// Update API usage count
function updateApiUsage(count) {
  try {
    const today = new Date().toISOString().split('T')[0];
    fs.writeFileSync(RATE_LIMIT_FILE, JSON.stringify({ count, date: today }));
  } catch (error) {
    console.error('Error updating API usage file:', error);
  }
}

io.on('connection', socket => {
  let turn = 0;
  const history = [];

  async function nextTurn() {
    // Check API usage limit
    const apiUsage = getApiUsage();
    
    if (apiUsage.count >= DAILY_LIMIT) {
      socket.emit('bot-message', { 
        speaker: 'System', 
        text: 'Daily API limit reached (20 calls). Please try again tomorrow to prevent excessive OpenAI API costs.' 
      });
      return;
    }

    const bot = MODELS[turn % MODELS.length];
    const messages = [
      { role: 'system', content: bot.system },
      ...history
    ];
    
    try {
      // Increment counter before API call
      updateApiUsage(apiUsage.count + 1);
      
      const res = await openai.chat.completions.create({
        model: bot.model,
        messages
      });
      
      const content = res.choices[0].message.content.trim();
      history.push({ role: 'assistant', content });
      socket.emit('bot-message', { speaker: bot.name, text: content });
      turn++;
    } catch (error) {
      console.error('OpenAI API error:', error);
      socket.emit('bot-message', { 
        speaker: 'Error', 
        text: 'An error occurred while communicating with the AI. Please try again.' 
      });
      
      // Rollback counter on error
      updateApiUsage(apiUsage.count);
    }
  }

  socket.on('start', () => nextTurn());
  socket.on('next', () => nextTurn());
  
  // Send API usage status on connection
  const apiUsage = getApiUsage();
  socket.emit('bot-message', { 
    speaker: 'System', 
    text: `API calls today: ${apiUsage.count}/${DAILY_LIMIT}` 
  });
});

server.listen(process.env.PORT, () => {
  console.log(`Listening on http://localhost:${process.env.PORT}`);
});