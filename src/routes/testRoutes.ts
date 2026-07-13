import express from 'express';
const router = express.Router();

router.get('/test', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Chat API Test Client</title>
  <script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>
  <style>
    body { font-family: monospace; background: #170307; color: #fff5f5; padding: 20px; max-width: 800px; margin: 0 auto; }
    h1 { color: #ff1a4d; }
    input, button, textarea { background: #250610; color: #fff5f5; border: 1px solid #6e1a2b; padding: 8px 12px; border-radius: 6px; margin: 5px; }
    button { background: #ff1a4d; border: none; cursor: pointer; color: white; font-weight: bold; }
    button:hover { background: #d6003e; }
    #messages { background: #250610; border: 1px solid #6e1a2b; border-radius: 8px; padding: 15px; height: 300px; overflow-y: auto; margin: 10px 0; }
    #log { background: #1f0509; border: 1px solid #6e1a2b; border-radius: 8px; padding: 15px; height: 150px; overflow-y: auto; font-size: 0.8rem; color: #d99aa6; }
    .msg { padding: 5px 0; border-bottom: 1px solid #2b070d; }
    .msg strong { color: #ff1a4d; }
    .section { background: #1f0509; border: 1px solid #6e1a2b; border-radius: 8px; padding: 15px; margin: 10px 0; }
    label { color: #d99aa6; font-size: 0.85rem; display: block; margin-bottom: 3px; }
    input { width: 250px; }
    .status { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #ff1a4d; margin-right: 5px; }
    .status.connected { background: #00ff88; }
  </style>
</head>
<body>
  <h1>Chat API — Live Test Client</h1>

  <div class="section">
    <h3>1. Login to get token</h3>
    <label>Email</label>
    <input id="email" placeholder="your@email.com" />
    <label>Password</label>
    <input id="password" type="password" placeholder="password" />
    <button onclick="login()">Login</button>
    <button onclick="register()">Register</button>
    <div id="token-display" style="margin-top:10px; color: #ff5c8a; font-size:0.8rem;"></div>
  </div>

  <div class="section">
    <h3>2. Connect to WebSocket</h3>
    <button onclick="connect()">Connect</button>
    <button onclick="disconnect()">Disconnect</button>
    <span><span class="status" id="status"></span><span id="status-text">Disconnected</span></span>
  </div>

  <div class="section">
    <h3>3. Join a room</h3>
    <input id="roomName" placeholder="Room name (e.g. general)" />
    <button onclick="joinRoom()">Join Room</button>
    <button onclick="leaveRoom()">Leave Room</button>
  </div>

  <div class="section">
    <h3>4. Send a message</h3>
    <input id="messageInput" placeholder="Type a message..." style="width:350px" />
    <button onclick="sendMessage()">Send</button>
  </div>

  <h3>Messages</h3>
  <div id="messages"></div>

  <h3>Event Log</h3>
  <div id="log"></div>

  <script>
    let socket = null;
    let token = null;
    let currentRoom = null;
    const API_URL = window.location.origin;

    function log(msg) {
      const el = document.getElementById('log');
      el.innerHTML += '<div>' + new Date().toLocaleTimeString() + ' — ' + msg + '</div>';
      el.scrollTop = el.scrollHeight;
    }

    function addMessage(data) {
      const el = document.getElementById('messages');
      el.innerHTML += '<div class="msg"><strong>' + data.sender + '</strong>: ' + data.content + ' <span style="color:#6e1a2b;font-size:0.75rem">' + new Date(data.createdAt).toLocaleTimeString() + '</span></div>';
      el.scrollTop = el.scrollHeight;
    }

    async function register() {
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const username = email.split('@')[0];
      const res = await fetch(API_URL + '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      const data = await res.json();
      log('Register: ' + JSON.stringify(data));
    }

    async function login() {
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const res = await fetch(API_URL + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.access_token) {
        token = data.access_token;
        document.getElementById('token-display').textContent = 'Logged in as: ' + data.username;
        log('Login successful — token saved');
      } else {
        log('Login failed: ' + JSON.stringify(data));
      }
    }

    function connect() {
      if (!token) { log('Login first to get a token'); return; }
      socket = io(API_URL, { auth: { token } });

      socket.on('connect', () => {
        document.getElementById('status').className = 'status connected';
        document.getElementById('status-text').textContent = 'Connected (' + socket.id + ')';
        log('Connected to WebSocket');
      });

      socket.on('disconnect', () => {
        document.getElementById('status').className = 'status';
        document.getElementById('status-text').textContent = 'Disconnected';
        log('Disconnected');
      });

      socket.on('room_history', (data) => {
        log('Room history received — ' + data.messages.length + ' messages');
        document.getElementById('messages').innerHTML = '';
        data.messages.forEach(addMessage);
      });

      socket.on('new_message', addMessage);

      socket.on('user_joined', (data) => {
        log(data.username + ' joined ' + data.room);
      });

      socket.on('user_left', (data) => {
        log(data.username + ' left ' + data.room);
      });

      socket.on('error', (data) => {
        log('Error: ' + data.message);
      });
    }

    function disconnect() {
      if (socket) { socket.disconnect(); socket = null; }
    }

    function joinRoom() {
      if (!socket) { log('Connect first'); return; }
      currentRoom = document.getElementById('roomName').value;
      socket.emit('join_room', currentRoom);
      log('Joining room: ' + currentRoom);
    }

    function leaveRoom() {
      if (!socket || !currentRoom) return;
      socket.emit('leave_room', currentRoom);
      log('Left room: ' + currentRoom);
      currentRoom = null;
    }

    function sendMessage() {
      if (!socket || !currentRoom) { log('Join a room first'); return; }
      const content = document.getElementById('messageInput').value;
      socket.emit('send_message', { roomName: currentRoom, content });
      document.getElementById('messageInput').value = '';
    }

    document.getElementById('messageInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  </script>
</body>
</html>
  `);
});

export default router;
