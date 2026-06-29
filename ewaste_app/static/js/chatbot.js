/* ============================================================
   ECOBOT CHATBOT MODULE — JAVASCRIPT
   ============================================================
   Pure vanilla JS. No jQuery. No frameworks.
   Everything is wrapped inside DOMContentLoaded and an IIFE-like
   closure so NOTHING leaks into the global scope and NOTHING
   can collide with the existing site's main.js.

   This file only ever touches elements whose IDs/classes are
   prefixed with "chatbot-" (defined in chatbot.html), so it is
   safe to drop into a project alongside existing scripts.
   ============================================================ */

document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  /* ----------------------------------------------------------
     If the chatbot markup isn't present on this page, bail out
     quietly instead of throwing errors that could disturb the
     host page's own scripts.
  ---------------------------------------------------------- */
  var chatbotWindow = document.getElementById("chatbot-window");
  if (!chatbotWindow) {
    return;
  }

  /* ----------------------------------------------------------
     Element references (all scoped to local consts/vars —
     nothing is attached to `window`).
  ---------------------------------------------------------- */
  var launcherBtn =
    document.getElementById("nav-chatbot-btn") ||
    document.getElementById("chatbot-launcher");
  var launcherBadge = document.getElementById("chatbot-launcher-badge");
  var closeBtn = document.getElementById("chatbot-close-btn");
  var minimizeBtn = document.getElementById("chatbot-minimize-btn");
  var maximizeBtn = document.getElementById("chatbot-maximize-btn");
  var clearBtn = document.getElementById("chatbot-clear-btn");
  var messagesEl = document.getElementById("chatbot-messages");
  var suggestionsEl = document.getElementById("chatbot-suggestions");
  var typingEl = document.getElementById("chatbot-typing");
  var formEl = document.getElementById("chatbot-form");
  var inputEl = document.getElementById("chatbot-input");
  var sendBtn = document.getElementById("chatbot-send-btn");
  var headerEl = chatbotWindow.querySelector(".chatbot-header");

  /* ----------------------------------------------------------
     Module-local state (NOT global — lives only in this closure).
     Conversation history persists for the browser tab's session
     only (sessionStorage), and is cleared on tab close or via
     the Clear Chat button. No database, no permanent storage.
  ---------------------------------------------------------- */
  var STORAGE_KEY = "ecobot_session_history_v1";
  var isOpen = false;
  var isMinimized = false;
  var isMaximized = false;
  var isSending = false;
  var hasUnread = false;

  var WELCOME_MESSAGE =
    "Hi! I'm EcoBot \u{1F33F}, your AI E-Waste Assistant. Ask me anything about " +
    "recycling, repair vs. reuse, data wiping, battery disposal, or the " +
    "circular economy.";

  /* ----------------------------------------------------------
     Session history helpers (sessionStorage clears automatically
     when the tab/browser closes — satisfies "no permanent storage").
  ---------------------------------------------------------- */
  function loadHistory() {
    try {
      var raw = window.sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      return [];
    }
  }

  function saveHistory(history) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (err) {
      /* sessionStorage may be unavailable (e.g. privacy mode) —
         the chat still works, it just won't persist on reload. */
    }
  }

  function clearHistory() {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      /* no-op */
    }
  }

  /* ----------------------------------------------------------
     Rendering helpers
  ---------------------------------------------------------- */
  function formatTime(date) {
    try {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (err) {
      return "";
    }
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function appendMessage(role, text, timestamp, persist) {
    var row = document.createElement("div");
    row.className = "chatbot-msg-row " + (role === "user" ? "chatbot-msg-user" : "chatbot-msg-bot");

    var bubble = document.createElement("div");
    bubble.className = "chatbot-msg-bubble";
    bubble.innerHTML = escapeHtml(text).replace(/\n/g, "<br>");

    var time = document.createElement("span");
    time.className = "chatbot-msg-time";
    time.textContent = formatTime(timestamp ? new Date(timestamp) : new Date());
    bubble.appendChild(time);

    row.appendChild(bubble);
    messagesEl.appendChild(row);
    scrollToBottom();

    if (persist !== false) {
      var history = loadHistory();
      history.push({ role: role, text: text, timestamp: (timestamp || new Date()).toISOString ? (timestamp || new Date()).toISOString() : new Date().toISOString() });
      saveHistory(history);
    }
  }

  function scrollToBottom() {
    requestAnimationFrame(function () {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  function showTyping() {
    typingEl.hidden = false;
    typingEl.setAttribute("aria-hidden", "false");
    scrollToBottom();
  }

  function hideTyping() {
    typingEl.hidden = true;
    typingEl.setAttribute("aria-hidden", "true");
  }

  function setSendingState(sending) {
    isSending = sending;
    sendBtn.disabled = sending;
    inputEl.disabled = sending;
  }

  /* ----------------------------------------------------------
     Panel open / close / minimize
  ---------------------------------------------------------- */
  function openPanel() {
    isOpen = true;
    isMinimized = false;
    chatbotWindow.hidden = false;
    chatbotWindow.classList.remove("chatbot-window-minimized");
    /* Force a frame so the transition from hidden -> visible animates */
    requestAnimationFrame(function () {
      chatbotWindow.classList.add("chatbot-window-open");
    });
    chatbotWindow.setAttribute("aria-hidden", "false");
    launcherBtn.setAttribute("aria-expanded", "true");
    launcherBtn.setAttribute("data-hidden", "true");
    clearUnread();
    scrollToBottom();
    /* Focus the input for keyboard users, after the open animation settles */
    window.setTimeout(function () {
      inputEl.focus();
    }, 240);
  }

  function closePanel() {
    isOpen = false;
    chatbotWindow.classList.remove("chatbot-window-open");
    chatbotWindow.setAttribute("aria-hidden", "true");
    launcherBtn.setAttribute("aria-expanded", "false");
    launcherBtn.removeAttribute("data-hidden");
    /* Wait for the close transition before actually hiding from a11y tree */
    window.setTimeout(function () {
      if (!isOpen) {
        chatbotWindow.hidden = true;
      }
    }, 220);
    launcherBtn.focus();
  }

  function toggleMinimize() {

    if (isMaximized) {

        chatbotWindow.classList.remove("chatbot-window-maximized");

        isMaximized = false;

    }

    isMinimized = !isMinimized;

    chatbotWindow.classList.toggle(
        "chatbot-window-minimized",
        isMinimized
    );

    minimizeBtn.setAttribute(
        "aria-label",
        isMinimized ? "Expand chat" : "Minimize chat"
    );

}

  function toggleMaximize(){

    isMaximized = !isMaximized;

    chatbotWindow.classList.toggle(
        "chatbot-window-maximized",
        isMaximized
    );

}

  function markUnread() {
    if (isOpen) return;
    hasUnread = true;
    launcherBadge.hidden = false;
  }

  function clearUnread() {
    hasUnread = false;
    launcherBadge.hidden = true;
  }

  /* ----------------------------------------------------------
     Sending messages to the Flask backend
  ---------------------------------------------------------- */
  function sendMessageToServer(message) {
    var history = loadHistory();

    return fetch("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: message,
        history: history /* recent context; backend may also keep its own session history */
      })
    }).then(function (res) {
      if (!res.ok) {
        throw new Error("Request failed with status " + res.status);
      }
      return res.json();
    });
  }

  function handleSend(rawText) {
    var text = (rawText || "").trim();
    if (!text || isSending) return;
    // Hide suggested questions after first interaction
    if (suggestionsEl) {
    suggestionsEl.style.display = "none";
}
    appendMessage("user", text, new Date());
    inputEl.value = "";
    autoGrowInput();
    setSendingState(true);
    showTyping();

    sendMessageToServer(text)
      .then(function (data) {
        hideTyping();
        var reply = (data && data.response) ? data.response : "Sorry, I couldn't process that. Please try again.";
        appendMessage("bot", reply, new Date());
        markUnread();
      })
      .catch(function () {
        hideTyping();
        appendMessage(
          "bot",
          "I'm having trouble connecting right now. Please check your connection and try again shortly.",
          new Date()
        );
      })
      .finally(function () {
        setSendingState(false);
        inputEl.focus();
      });
  }

  /* ----------------------------------------------------------
     Textarea auto-grow (kept lightweight, capped by CSS max-height)
  ---------------------------------------------------------- */
  function autoGrowInput() {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 96) + "px";
  }

  /* ----------------------------------------------------------
     Clear chat
  ---------------------------------------------------------- */
  function clearChat() {

    messagesEl.innerHTML = "";

    clearHistory();

    // Show suggestions again
    if (suggestionsEl) {
        suggestionsEl.style.display = "";
    }

    appendMessage("bot", WELCOME_MESSAGE, new Date());
}

  /* ----------------------------------------------------------
     Restore previous session history on load (if any)
  ---------------------------------------------------------- */
  function restoreSession() {
    var history = loadHistory();
    if (!history.length) {
      appendMessage("bot", WELCOME_MESSAGE, new Date(), true);
      return;
    }
    history.forEach(function (entry) {
      appendMessage(entry.role, entry.text, entry.timestamp, false);
    });
  }

  /* ----------------------------------------------------------
     Event wiring (each listener attached exactly once)
  ---------------------------------------------------------- */
  launcherBtn.addEventListener("click", function () {
    if (isOpen && !isMinimized) {
      closePanel();
    } else {
      openPanel();
    }
  });

  closeBtn.addEventListener("click", closePanel);

  minimizeBtn.addEventListener("click", toggleMinimize);
  maximizeBtn.addEventListener("click", toggleMaximize);
  clearBtn.addEventListener("click", function () {
    clearChat();
    inputEl.focus();
  });

  formEl.addEventListener("submit", function (evt) {
    evt.preventDefault();
    handleSend(inputEl.value);
  });

  inputEl.addEventListener("keydown", function (evt) {
    /* Enter sends, Shift+Enter creates a new line */
    if (evt.key === "Enter" && !evt.shiftKey) {
      evt.preventDefault();
      handleSend(inputEl.value);
    }
  });

  inputEl.addEventListener("input", autoGrowInput);

  if (suggestionsEl) {
    suggestionsEl.addEventListener("click", function (evt) {
      var chip = evt.target.closest(".chatbot-chip");
      if (!chip) return;
      var question = chip.getAttribute("data-question") || chip.textContent;
      handleSend(question);
    });
  }

  /* ESC closes the chatbot, but only when the chatbot itself has focus
     context — this avoids hijacking ESC behavior used elsewhere on
     the host page. */
  chatbotWindow.addEventListener("keydown", function (evt) {
    if (evt.key === "Escape" && isOpen) {
      evt.preventDefault();
      closePanel();
    }
  });

  /* ----------------------------------------------------------
     Initialize
  ---------------------------------------------------------- */
 const footerChatbotLink = document.getElementById("footer-chatbot-link");

if (footerChatbotLink) {
    footerChatbotLink.addEventListener("click", function (e) {
        e.preventDefault();

        if (!isOpen) {
            openPanel();
        } else if (isMinimized) {
            toggleMinimize();
        }

        inputEl.focus();
    });
}
 
  restoreSession();


/* ----------------------------------------------------------
   Desktop Dragging (Left/Top Based)
---------------------------------------------------------- */


});
