const socket = io();
const chat = document.getElementById('chat');
const start = document.getElementById('start');
const next  = document.getElementById('next');

function appendMessage(speaker, text){
  const el = document.createElement('div');
  el.classList.add('message');
  el.innerHTML = `<span class="speaker">${speaker}:</span>${text.replace(/\n/g,'<br>')}`;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
}

socket.on('bot-message', ({ speaker, text }) => {
  appendMessage(speaker, text);
});

start.onclick = () => socket.emit('start');
next.onclick  = () => socket.emit('next');