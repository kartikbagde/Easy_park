
document.getElementById("toggle-btn").addEventListener("click", function () {
  const body = document.getElementById("chat-body");
  body.classList.toggle("hidden");
  this.textContent = body.classList.contains("hidden") ? "+" : "–";
});

function sendMessage() {
  const input = document.getElementById("user-input");
  const message = input.value.trim();
  if (message === "") return;

  const chatBox = document.getElementById("chat-box");

  
  const userMsg = document.createElement("div");
  userMsg.className = "user-message";
  userMsg.textContent = message;
  chatBox.appendChild(userMsg);

  
  const botMsg = document.createElement("div");
  botMsg.className = "bot-message";
  botMsg.textContent = getBotResponse(message);
  chatBox.appendChild(botMsg);

  input.value = "";
  chatBox.scrollTop = chatBox.scrollHeight;
}

function getBotResponse(msg) {
msg = msg.toLowerCase();

if (msg.includes("locations") || msg.includes("location")) {
    return "ParkSmart is currently available at 3 campuses: GH Raisoni Wadi, GH Raisoni Dighdoh, and GH Raisoni Sadar.";
} 
else if (msg.includes("service")) {
    return "We provide smart parking services 24/7 for your convenience.";
} 
else if (msg.includes("timing") || msg.includes("open")) {
    return "Our parking facilities are open from 6 AM to 10 AM and 5 PM to 10 PM every day.";
} 
else if (msg.includes("contact") || msg.includes("phone") || msg.includes("call")) {
    return "You can reach us at +91-7517291733 or email us at support@parksmart.com.";
} 
else if (msg.includes("slots") || msg.includes("availability")) {
    return "You can check available parking slots in real-time on our website for each campus.";
} 
else if (msg.includes("hello") || msg.includes("hi") || msg.includes("hii")) {
    return "Hi! Welcome to ParkSmart. How can we assist you with your parking needs today?";
} 
else {
    return "Sorry, I didn't understand that. Can you please rephrase or ask about locations, timings, or parking slots?";
}

}
