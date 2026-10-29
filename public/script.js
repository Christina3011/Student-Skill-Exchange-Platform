const API = "/api";

let currentUser = null;
let allSkills = [];
let authMode = "register";
let sessionToken = localStorage.getItem("skillswap_token") || "";
let knownIncomingRequestIds = null;

const authModal = new bootstrap.Modal(document.getElementById("authModal"));
const skillModal = new bootstrap.Modal(document.getElementById("skillModal"));
const sessionModal = new bootstrap.Modal(document.getElementById("sessionModal"));

function loadDisplaySettings() {
  const settings = [
    { id: "compactCardsSetting", key: "skillswap_compact_cards", className: "compact-cards" },
    { id: "largerTextSetting", key: "skillswap_larger_text", className: "larger-text" },
    { id: "reduceMotionSetting", key: "skillswap_reduce_motion", className: "reduce-motion" }
  ];

  settings.forEach(({ id, key, className }) => {
    const enabled = localStorage.getItem(key) === "true";
    const checkbox = document.getElementById(id);
    checkbox.checked = enabled;
    document.body.classList.toggle(className, enabled);

    checkbox.addEventListener("change", () => {
      localStorage.setItem(key, String(checkbox.checked));
      document.body.classList.toggle(className, checkbox.checked);
    });
  });
}

loadDisplaySettings();

function showMessage(elementId, message, type = "danger") {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.className = `alert alert-${type}`;
}

function hideMessage(elementId) {
  const element = document.getElementById(elementId);
  element.textContent = "";
  element.className = "alert d-none";
}

function showToast(message) {
  document.getElementById("toastText").textContent = message;
  bootstrap.Toast.getOrCreateInstance(document.getElementById("toast")).show();
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(sessionToken ? { "x-session-token": sessionToken } : {}), ...(options.headers || {}) },
    credentials: "same-origin",
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Something went wrong. Please try again.");
  }
  return data;
}

function setAuthView() {
  const userProfilePanel = document.getElementById("userProfilePanel");
  const profileName = document.getElementById("profileName");
  const profileAvatar = document.getElementById("profileAvatar");
  const profileAvatarCard = document.getElementById("profileAvatarCard");
  const profileEmail = document.getElementById("profileEmail");
  const profileCard = document.getElementById("profileCard");

  document.getElementById("loginNav").hidden = Boolean(currentUser);
  document.getElementById("registerNav").hidden = Boolean(currentUser);
  userProfilePanel.hidden = !currentUser;
  document.getElementById("incomingRequestCount").hidden = true;
  document.getElementById("incomingRequestCount").textContent = "";
  profileCard.hidden = true;
  document.getElementById("profileTrigger").setAttribute("aria-expanded", "false");

  if (currentUser) {
    const name = currentUser.name || "Student";
    const email = currentUser.email || "student@email.com";
    const initial = name.charAt(0).toUpperCase();
    profileName.textContent = name;
    profileAvatar.textContent = initial;
    profileAvatarCard.textContent = initial;
    profileEmail.textContent = email;
    document.getElementById("profileDetails").innerHTML = `
      <div class="d-flex align-items-center gap-3">
        <span class="profile-avatar">${escapeHtml(initial)}</span>
        <div>
          <strong>${escapeHtml(name)}</strong>
          <div class="text-muted">${escapeHtml(email)}</div>
        </div>
      </div>`;
  } else {
    document.getElementById("my-skills").hidden = true;
    document.getElementById("my-learning-sessions").hidden = true;
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

function iconForCategory(category) {
  const icons = {
    Programming: "bi-code-slash",
    Design: "bi-palette",
    Languages: "bi-translate",
    Academics: "bi-book",
    Music: "bi-music-note-beamed",
    Other: "bi-stars"
  };
  return `<i class="bi ${icons[category] || "bi-lightbulb"}" aria-hidden="true"></i>`;
}

function isCurrentUsersSkill(skill) {
  const ownerId = String(skill.owner?._id || skill.owner?.id || "");
  const currentUserId = String(currentUser?.id || currentUser?._id || "");
  return Boolean(currentUserId && ownerId === currentUserId);
}

function openAuth(mode) {
  authMode = mode;
  hideMessage("authMessage");
  document.getElementById("authTitle").textContent = mode === "register" ? "Join SkillSwap" : "Welcome back";
  document.getElementById("authSubmit").textContent = mode === "register" ? "Create account" : "Login";
  document.getElementById("nameGroup").hidden = mode !== "register";
  document.getElementById("authName").required = mode === "register";
  document.getElementById("authPassword").autocomplete = mode === "register" ? "new-password" : "current-password";
  document.getElementById("authSwitchText").innerHTML = mode === "register"
    ? 'Already have an account? <button class="btn btn-link p-0" id="switchAuth" type="button">Login</button>'
    : 'New to SkillSwap? <button class="btn btn-link p-0" id="switchAuth" type="button">Create an account</button>';
  document.getElementById("switchAuth").addEventListener("click", () => openAuth(authMode === "register" ? "login" : "register"));
  document.getElementById("authForm").reset();
  authModal.show();
}

document.getElementById("showLogin").addEventListener("click", () => openAuth("login"));
document.getElementById("showRegister").addEventListener("click", () => openAuth("register"));
document.getElementById("heroJoin").addEventListener("click", () => openAuth("register"));

document.getElementById("profileTrigger").addEventListener("click", () => {
  if (!currentUser) return;
  const profileCard = document.getElementById("profileCard");
  profileCard.hidden = !profileCard.hidden;
  document.getElementById("profileTrigger").setAttribute("aria-expanded", String(!profileCard.hidden));
});

document.addEventListener("click", (event) => {
  const profileMenu = document.getElementById("userProfilePanel");
  if (!profileMenu.contains(event.target)) {
    document.getElementById("profileCard").hidden = true;
    document.getElementById("profileTrigger").setAttribute("aria-expanded", "false");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    document.getElementById("profileCard").hidden = true;
    document.getElementById("profileTrigger").setAttribute("aria-expanded", "false");
  }
});

function closeProfileMenu() {
  document.getElementById("profileCard").hidden = true;
  document.getElementById("profileTrigger").setAttribute("aria-expanded", "false");
}

document.querySelectorAll(".profile-menu-item[href]").forEach((link) => {
  link.addEventListener("click", closeProfileMenu);
});

document.getElementById("logoutBtn").addEventListener("click", async (event) => {
  const logoutButton = event.currentTarget;
  logoutButton.disabled = true;
  let logoutMessage = "You have logged out.";

  try {
    await apiRequest("/auth/logout", { method: "POST" });
  } catch (error) {
    logoutMessage = `Logged out on this device. The server could not be notified: ${error.message}`;
  } finally {
    currentUser = null;
    sessionToken = "";
    knownIncomingRequestIds = null;
    localStorage.removeItem("skillswap_token");
    setAuthView();
    await loadSkills();
    await loadMySessions();
    window.location.hash = "#home";
    showPageFromLocation();
    logoutButton.disabled = false;
    showToast(logoutMessage);
  }
});

function showPageFromLocation() {
  const hash = window.location.hash || "#home";
  const pageByHash = {
    "#home": "home",
    "#how-it-works": "home",
    "#skills": "skills",
    "#profile": "profile",
    "#my-skills": "my-skills",
    "#my-learning-sessions": "my-learning-sessions",
    "#settings": "settings"
  };
  const page = pageByHash[hash] || "home";

  if (["profile", "my-skills", "my-learning-sessions", "settings"].includes(page) && !currentUser) {
    window.location.href = "/#home";
    return;
  }

  document.querySelectorAll("main [data-page]").forEach((section) => {
    section.hidden = section.dataset.page !== page;
  });

  if (page === "my-skills") renderMySkills();
  if (page === "my-learning-sessions") loadMySessions();

  document.querySelectorAll("#mainNav .nav-link").forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === `/${hash}`);
  });

  const target = document.getElementById(hash.slice(1));
  if (target) target.scrollIntoView({ block: "start" });
}

window.addEventListener("hashchange", showPageFromLocation);

document.getElementById("authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  hideMessage("authMessage");

  const body = {
    name: document.getElementById("authName").value.trim(),
    email: document.getElementById("authEmail").value.trim(),
    password: document.getElementById("authPassword").value
  };

  try {
    const route = authMode === "register" ? "/auth/register" : "/auth/login";
    const result = await apiRequest(route, { method: "POST", body: JSON.stringify(body) });
    currentUser = result.user;
    sessionToken = result.token;
    localStorage.setItem("skillswap_token", sessionToken);
    authModal.hide();
    setAuthView();
    await loadSkills();
    await loadMySessions();
    showToast(authMode === "register" ? "Account created. Welcome!" : "You are logged in.");
  } catch (error) {
    showMessage("authMessage", error.message);
  }
});

document.getElementById("addSkillBtn").addEventListener("click", () => {
  if (!currentUser) {
    openAuth("login");
    showToast("Please log in before adding a skill.");
    return;
  }
  hideMessage("skillMessage");
  document.getElementById("skillForm").reset();
  skillModal.show();
});

document.getElementById("skillForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  hideMessage("skillMessage");

  const body = {
    title: document.getElementById("skillTitle").value.trim(),
    category: document.getElementById("skillCategory").value,
    description: document.getElementById("skillDescription").value.trim(),
    level: document.getElementById("skillLevel").value
  };

  try {
    await apiRequest("/skills", { method: "POST", body: JSON.stringify(body) });
    skillModal.hide();
    await loadSkills();
    showToast("Your skill has been added.");
  } catch (error) {
    showMessage("skillMessage", error.message);
  }
});

document.getElementById("searchInput").addEventListener("input", renderSkills);
document.getElementById("categoryFilter").addEventListener("change", renderSkills);

function renderSkills() {
  const search = document.getElementById("searchInput").value.toLowerCase().trim();
  const category = document.getElementById("categoryFilter").value;
  const filtered = allSkills.filter((skill) => {
    const text = `${skill.title} ${skill.description} ${skill.owner?.name || ""} ${skill.category}`.toLowerCase();
    return text.includes(search) && (!category || skill.category === category);
  });

  const list = document.getElementById("skillsList");
  if (!filtered.length) {
    list.innerHTML = '<div class="col-12"><div class="text-center text-muted py-5">No skills found. Try another search or add a skill.</div></div>';
    return;
  }

  list.innerHTML = filtered.map(renderSkillCard).join("");
  attachSessionRequestHandlers(list);
}

function renderMySkills() {
  const mySkills = allSkills.filter(isCurrentUsersSkill);
  const list = document.getElementById("mySkillsList");
  if (!mySkills.length) {
    list.innerHTML = '<div class="col-12"><div class="text-center text-muted py-5">You have not added any skills yet.</div></div>';
    return;
  }

  list.innerHTML = mySkills.map(renderSkillCard).join("");
  attachSessionRequestHandlers(list);
}

function renderSkillCard(skill) {
  return `
    <div class="col-md-6 col-lg-4">
      <div class="skill-card">
        <div class="skill-icon">${iconForCategory(skill.category)}</div>
        <span class="category-tag">${escapeHtml(skill.category)}</span>
        <h4>${escapeHtml(skill.title)}</h4>
        <p class="skill-description">${escapeHtml(skill.description)}</p>
        <div class="skill-owner">
          <div><strong>Teacher:</strong> ${escapeHtml(skill.owner?.name || "Student")}</div>
          <div class="text-muted mt-1"><strong>Level:</strong> ${escapeHtml(skill.level || "Beginner")}</div>
        </div>
        ${currentUser && isCurrentUsersSkill(skill)
          ? '<button class="btn btn-outline-secondary w-100" disabled>Your skill</button>'
          : `<button class="btn btn-primary w-100 request-session" data-id="${escapeHtml(skill._id)}">Request to Learn</button>`}
      </div>
    </div>`;
}

function attachSessionRequestHandlers(container) {
  container.querySelectorAll(".request-session").forEach((button) => {
    button.addEventListener("click", () => requestSession(button.dataset.id));
  });
}

async function loadSkills() {
  try {
    const data = await apiRequest("/skills");
    allSkills = data.skills || [];
    document.getElementById("skillCount").textContent = allSkills.length;
    renderSkills();
    if (currentUser) renderMySkills();
    await loadStats();
  } catch (error) {
    document.getElementById("skillsList").innerHTML = `<div class="col-12"><div class="alert alert-warning">Could not load skills. Make sure the server and MongoDB are running.</div></div>`;
  }
}

async function loadStats() {
  try {
    const stats = await apiRequest("/stats");
    document.getElementById("studentCount").textContent = stats.students;
    document.getElementById("sessionCount").textContent = stats.sessions;
  } catch (error) {
    // The homepage still works if stats cannot be loaded.
  }
}

function requestSession(skillId) {
  if (!currentUser) {
    openAuth("login");
    showToast("Please log in to request a session.");
    return;
  }
  document.getElementById("sessionSkillId").value = skillId;
  document.getElementById("sessionDate").value = "";
  document.getElementById("sessionNote").value = "";
  document.getElementById("sessionDate").min = new Date().toISOString().split("T")[0];
  hideMessage("sessionMessage");
  sessionModal.show();
}

document.getElementById("sessionForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  hideMessage("sessionMessage");
  const body = {
    skillId: document.getElementById("sessionSkillId").value,
    preferredDate: document.getElementById("sessionDate").value,
    note: document.getElementById("sessionNote").value.trim()
  };

  try {
    await apiRequest("/sessions", { method: "POST", body: JSON.stringify(body) });
    sessionModal.hide();
    await loadMySessions();
    await loadStats();
    showToast("Session request sent.");
  } catch (error) {
    showMessage("sessionMessage", error.message);
  }
});

async function loadMySessions() {
  const sentContainer = document.getElementById("mySessions");
  const incomingContainer = document.getElementById("incomingRequests");
  const requestCount = document.getElementById("incomingRequestCount");
  if (!currentUser) {
    sentContainer.innerHTML = "";
    incomingContainer.innerHTML = "";
    requestCount.textContent = "";
    requestCount.hidden = true;
    knownIncomingRequestIds = null;
    return;
  }

  try {
    const [sentData, incomingData] = await Promise.all([
      apiRequest("/sessions/mine"),
      apiRequest("/sessions/incoming")
    ]);
    const sentSessions = sentData.sessions || [];
    const incomingSessions = incomingData.sessions || [];
    updateIncomingRequestNotifications(incomingSessions);

    incomingContainer.innerHTML = incomingSessions.length
      ? incomingSessions.map(renderIncomingRequest).join("")
      : '<div class="col-12 text-muted">You have no incoming requests yet.</div>';
    sentContainer.innerHTML = sentSessions.length ? sentSessions.map((session) => `
      <div class="col-md-6">
        <div class="session-card">
          <h4 class="h6">${escapeHtml(session.skill?.title || "Skill session")}</h4>
          <p class="mb-1"><strong>Teacher:</strong> ${escapeHtml(session.teacher?.name || "Student")}</p>
          <p class="mb-1"><strong>Date:</strong> ${escapeHtml(session.preferredDate)}</p>
          <p class="mb-1"><strong>Status:</strong> <span class="badge text-bg-${session.status === "Accepted" ? "success" : "secondary"}">${escapeHtml(session.status)}</span></p>
          <p class="text-muted mb-0">${escapeHtml(session.note || "No message added.")}</p>
        </div>
      </div>`).join("") : '<div class="col-12 text-muted">You have not requested any sessions yet.</div>';
    attachRequestStatusHandlers(incomingContainer);
  } catch (error) {
    const message = escapeHtml(error.message);
    incomingContainer.innerHTML = `<div class="col-12"><div class="alert alert-warning">${message}</div></div>`;
    sentContainer.innerHTML = `<div class="col-12"><div class="alert alert-warning">${message}</div></div>`;
  }
}

function updateIncomingRequestNotifications(sessions) {
  const pendingIncoming = sessions.filter((session) => session.status === "Pending");
  const requestCount = document.getElementById("incomingRequestCount");
  requestCount.textContent = pendingIncoming.length;
  requestCount.hidden = pendingIncoming.length === 0;

  if (knownIncomingRequestIds) {
    const newRequests = pendingIncoming.filter((session) => !knownIncomingRequestIds.has(session._id));
    if (newRequests.length) {
      showToast(newRequests.length === 1
        ? `New request to learn ${newRequests[0].skill?.title ? `“${newRequests[0].skill.title}”` : "one of your skills"}.`
        : `${newRequests.length} new learning requests received.`);
    }
  }
  knownIncomingRequestIds = new Set(sessions.map((session) => session._id));
}

async function checkIncomingRequests() {
  if (!currentUser) return;
  try {
    const data = await apiRequest("/sessions/incoming");
    updateIncomingRequestNotifications(data.sessions || []);
  } catch (error) {
    console.error("Could not check incoming learning requests:", error);
  }
}

function renderIncomingRequest(session) {
  const learner = session.learner || {};
  const skill = session.skill || {};
  const statusClass = session.status === "Accepted" ? "success" : "secondary";
  return `
    <div class="col-md-6">
      <div class="session-card">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <h4 class="h6">${escapeHtml(skill.title || "Skill request")}</h4>
          <span class="badge text-bg-${statusClass}">${escapeHtml(session.status)}</span>
        </div>
        <p class="mb-1"><strong>Learner:</strong> ${escapeHtml(learner.name || "Student")}</p>
        <p class="mb-1"><strong>Email:</strong> ${escapeHtml(learner.email || "Not available")}</p>
        <p class="mb-1"><strong>Preferred date:</strong> ${escapeHtml(session.preferredDate)}</p>
        <p class="request-message mb-3">${escapeHtml(session.note || "No message added.")}</p>
        ${session.status === "Pending" ? `
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-primary btn-sm request-status-action" data-id="${escapeHtml(session._id)}" data-status="Accepted">Accept</button>
            <button type="button" class="btn btn-outline-primary btn-sm request-status-action" data-id="${escapeHtml(session._id)}" data-status="Declined">Reject</button>
          </div>` : ""}
      </div>
    </div>`;
}

function attachRequestStatusHandlers(container) {
  container.querySelectorAll(".request-status-action").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const status = button.dataset.status;
        await apiRequest(`/sessions/${encodeURIComponent(button.dataset.id)}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status })
        });
        await loadMySessions();
        showToast(status === "Accepted" ? "Learning request accepted." : "Learning request rejected.");
      } catch (error) {
        button.disabled = false;
        showToast(error.message);
      }
    });
  });
}

async function checkLogin() {
  try {
    const data = await apiRequest("/auth/me");
    currentUser = data.user || null;
    if (!currentUser) {
      sessionToken = "";
      knownIncomingRequestIds = null;
      localStorage.removeItem("skillswap_token");
    }
  } catch (error) {
    currentUser = null;
  }
  setAuthView();
  await loadSkills();
  await loadMySessions();
  showPageFromLocation();
}

checkLogin();
window.setInterval(() => {
  checkIncomingRequests();
}, 30000);
