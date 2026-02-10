let CURRENT_USER_ID = null;
let ACTIVE_CHAT_USER_ID = null;
let refreshInterval = null;
let badgeInterval = null;

// Function to get random color for avatar background
function getUserColor(userId) {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
    '#F8B739', '#52B788', '#E63946', '#457B9D'
  ];
  return colors[userId % colors.length];
}

document.addEventListener("DOMContentLoaded", async function () {

  /* ==========================
     ONLY ONE API CALL ON DOM LOAD - GET USER & START BADGE
  ========================== */
  try {
    const res = await fetch("/chat/me");
    const data = await res.json();

    if (!data.id) {
      console.error("User not logged in");
      return;
    }

    CURRENT_USER_ID = data.id;
    console.log("Logged in as:", CURRENT_USER_ID);

    // THIS IS THE ONLY API THAT RUNS ON DOM LOAD
    updateUnreadBadge();

    // Update badge every 5 seconds in background
    badgeInterval = setInterval(() => {
      updateUnreadBadge();
    }, 5000);

  } catch (err) {
    console.error("Failed to fetch current user", err);
    return;
  }

  const chatBtn = document.getElementById("chatBtn");
  const messagingModalEl = document.getElementById("messagingModal");
  const contactsList = document.getElementById("contactsList");
  const searchInput = document.getElementById("contactSearch");

  if (!chatBtn || !messagingModalEl) return;

  const messagingModal = new bootstrap.Modal(messagingModalEl);

  /* ==========================
     UPDATE UNREAD BADGE
  ========================== */
  function updateUnreadBadge() {
    fetch("/chat/unread-count")
      .then(res => res.json())
      .then(data => {
        const badge = document.getElementById("unreadBadge");
        const count = data.unread_count;

        if (count > 0) {
          badge.textContent = count > 99 ? '99+' : count;
          badge.style.display = "inline-block";
        } else {
          badge.style.display = "none";
        }
      })
      .catch(err => console.error("Failed to update badge:", err));
  }

  /* ==========================
     OPEN MODAL - LOADS CONTACTS ONLY WHEN CLICKED
  ========================== */
  chatBtn.addEventListener("click", function () {
    messagingModal.show();
    loadContacts("");
    updateUnreadBadge();
  });

  searchInput.addEventListener("keyup", function () {
    loadContacts(this.value);
  });

  /* ==========================
     LOAD CONTACTS - WITH AVATARS AND UNREAD COUNTS
  ========================== */
  function loadContacts(query) {
    fetch(`/chat/users?q=${query}`)
      .then(res => res.json())
      .then(data => {
        contactsList.innerHTML = "";

        if (!data.length) {
          contactsList.innerHTML =
            "<p class='text-muted text-center mt-3'>No contacts found</p>";
          return;
        }

        data.forEach(user => {
          const div = document.createElement("div");
          div.className = "contact-item";
          div.dataset.userId = user.id;
          
          // Avatar icon - SAME ICON FOR ALL USERS
          const avatarDiv = document.createElement("div");
          avatarDiv.className = "contact-avatar";
          avatarDiv.style.backgroundColor = getUserColor(user.id);
          
          const iconElement = document.createElement("i");
          iconElement.className = "fas fa-user-circle"; // Single icon for all
          avatarDiv.appendChild(iconElement);
          div.appendChild(avatarDiv);
          
          // Username
          const nameSpan = document.createElement("span");
          nameSpan.textContent = user.username;
          nameSpan.className = "contact-name";
          div.appendChild(nameSpan);

          // Unread badge for this contact
          if (user.unread_count > 0) {
            const unreadBadge = document.createElement("span");
            unreadBadge.className = "contact-unread-badge";
            unreadBadge.textContent = user.unread_count > 99 ? '99+' : user.unread_count;
            div.appendChild(unreadBadge);
            
            div.classList.add("has-unread");
          }

          // If this is the active chat, keep it highlighted
          if (ACTIVE_CHAT_USER_ID && Number(user.id) === Number(ACTIVE_CHAT_USER_ID)) {
            div.classList.add("active");
          }

          div.onclick = (e) => openConversation(user.id, user.username, e);
          contactsList.appendChild(div);
        });
      })
      .catch(err => console.error("Failed to load contacts:", err));
  }

  /* ==========================
     OPEN CONVERSATION - WITH AVATAR IN HEADER
  ========================== */
  function openConversation(userId, userName, event) {
    ACTIVE_CHAT_USER_ID = userId;

    if (refreshInterval) {
      clearInterval(refreshInterval);
    }

    document.querySelectorAll(".contact-item").forEach(item =>
      item.classList.remove("active")
    );
    
    event.currentTarget.classList.add("active");

    // Create avatar for conversation header
    const avatarColor = getUserColor(userId);

    document.querySelector(".conversation-panel").innerHTML = `
      <div class="conversation-header">
        <div class="conversation-avatar" style="background-color: ${avatarColor};">
          <i class="fas fa-user-circle"></i>
        </div>
        <h6 class="mb-0">${userName}</h6>
      </div>

      <div class="chat-messages" id="chatMessages"></div>

      <div class="chat-input-wrapper">
        <input
          type="text"
          id="messageInput"
          class="form-control"
          placeholder="Type a message…"
        />
        <button class="btn btn-primary" id="sendMessageBtn">
          Send
        </button>
      </div>
    `;

    loadMessages(userId);

    refreshInterval = setInterval(() => {
      loadMessages(userId);
    }, 2000);

    document
      .getElementById("sendMessageBtn")
      .addEventListener("click", sendMessage);

    document
      .getElementById("messageInput")
      .addEventListener("keypress", e => {
        if (e.key === "Enter") sendMessage();
      });
  }

  /* ==========================
     LOAD MESSAGES - WITH AVATARS
  ========================== */
  function loadMessages(userId) {
    fetch(`/chat/messages/${userId}`)
      .then(res => res.json())
      .then(messages => {
        const box = document.getElementById("chatMessages");

        box.innerHTML = "";

        if (!messages.length) {
          box.innerHTML = `<div class="text-muted text-center mt-3">No messages yet 👋</div>`;
          return;
        }

        messages.forEach(msg => {
          const messageWrapper = document.createElement("div");
          messageWrapper.className = "message-wrapper";
          
          const isSent = Number(msg.sender_id) === Number(CURRENT_USER_ID);
          messageWrapper.classList.add(isSent ? "sent-wrapper" : "received-wrapper");

          // Add avatar for received messages
          if (!isSent) {
            const avatar = document.createElement("div");
            avatar.className = "message-avatar";
            avatar.style.backgroundColor = getUserColor(msg.sender_id);
            
            const icon = document.createElement("i");
            icon.className = "fas fa-user-circle"; // Same icon for all
            avatar.appendChild(icon);
            
            messageWrapper.appendChild(avatar);
          }

          // Message bubble
          const div = document.createElement("div");
          div.classList.add("message");
          div.classList.add(isSent ? "sent" : "received");

          // Message text
          const textSpan = document.createElement("span");
          textSpan.className = "message-text";
          textSpan.textContent = msg.message;
          div.appendChild(textSpan);

          // Message info (timestamp + status)
          const infoDiv = document.createElement("div");
          infoDiv.className = "message-info";

          // Format timestamp
          const timestamp = new Date(msg.created_at);
          const timeString = timestamp.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          });
          
          const timeSpan = document.createElement("span");
          timeSpan.className = "message-time";
          timeSpan.textContent = timeString;
          infoDiv.appendChild(timeSpan);

          // Add status for sent messages
          if (isSent) {
            const statusSpan = document.createElement("span");
            statusSpan.className = "message-status";
            
            if (msg.status === 'read') {
              statusSpan.innerHTML = " ✓✓";
              statusSpan.classList.add("read");
            } else if (msg.status === 'sent') {
              statusSpan.innerHTML = " ✓";
              statusSpan.classList.add("sent-status");
            }
            
            infoDiv.appendChild(statusSpan);
          }

          div.appendChild(infoDiv);
          messageWrapper.appendChild(div);
          box.appendChild(messageWrapper);
        });

        box.scrollTop = box.scrollHeight;

        loadContacts(searchInput.value);
        updateUnreadBadge();
      })
      .catch(err => {
        console.error("Failed to load messages:", err);
      });
  }

  /* ==========================
     SEND MESSAGE
  ========================== */
  function sendMessage() {
    const input = document.getElementById("messageInput");
    const text = input.value.trim();

    if (!text || !ACTIVE_CHAT_USER_ID) return;

    fetch("/chat/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receiver_id: ACTIVE_CHAT_USER_ID,
        message: text
      })
    })
      .then(() => {
        input.value = "";
        loadMessages(ACTIVE_CHAT_USER_ID);
      })
      .catch(err => {
        console.error("Failed to send message:", err);
      });
  }

  /* ==========================
     STOP REFRESH WHEN MODAL CLOSES
  ========================== */
  messagingModalEl.addEventListener('hidden.bs.modal', () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
    ACTIVE_CHAT_USER_ID = null;
    
    updateUnreadBadge();
  });

  /* ==========================
     CLEANUP ON PAGE UNLOAD
  ========================== */
  window.addEventListener('beforeunload', () => {
    if (badgeInterval) clearInterval(badgeInterval);
    if (refreshInterval) clearInterval(refreshInterval);
  });
});