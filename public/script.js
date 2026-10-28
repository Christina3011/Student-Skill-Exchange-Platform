const API = "/api";

let currentUser = null;
let allSkills = [];
let authMode = "register";
let sessionToken = localStorage.getItem("skillswap_token") || "";

const authModal = new bootstrap.Modal(document.getElementById("authModal"));
const skillModal = new bootstrap.Modal(document.getElementById("skillModal"));
const sessionModal = new bootstrap.Modal(document.getElementById("sessionModal"));

document.getElementById("year").textContent = new Date().getFullYear();

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
  document.getElementById("loginNav").hidden = Boolean(currentUser);
  document.getElementById("registerNav").hidden = Boolean(currentUser);
  document.getElementById("logoutNav").hidden = !currentUser;
  document.getElementById("profileNav").hidden = !currentUser;
  document.getElementById("profile").hidden = !currentUser;

  if (currentUser) {
    document.getElementById("profileDetails").innerHTML = `
      <h3 class="h5 mb-2">${escapeHtml(currentUser.name)}</h3>
      <p class="mb-1 text-muted">${escapeHtml(currentUser.email)}</p>
      <p class="mb-0">Welcome to your student profile. Add a skill to help another student learn.</p>`;
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

function iconForCategory(category) {
  const icons = {
    Programming: "💻",
    Design: "🎨",
    Languages: "🌐",
    Academics: "📚",
    Music: "🎵",
    Other: "✨"
  };
  return icons[category] || "💡";
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

document.getElementById("logoutBtn").addEventListener("click", async () => {
  try {
    await apiRequest("/auth/logout", { method: "POST" });
    currentUser = null;
    sessionToken = "";
    localStorage.removeItem("skillswap_token");
    setAuthView();
    await loadSkills();
    showToast("You have logged out.");
  } catch (error) {
    showToast(error.message);
  }
});

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

  list.innerHTML = filtered.map((skill) => `
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
        ${currentUser && skill.owner?._id === currentUser.id
          ? '<button class="btn btn-outline-secondary w-100" disabled>Your skill</button>'
          : `<button class="btn btn-primary w-100 request-session" data-id="${escapeHtml(skill._id)}">Request a session</button>`}
      </div>
    </div>`).join("");

  document.querySelectorAll(".request-session").forEach((button) => {
    button.addEventListener("click", () => requestSession(button.dataset.id));
  });
}

async function loadSkills() {
  try {
    const data = await apiRequest("/skills");
    allSkills = data.skills || [];
    document.getElementById("skillCount").textContent = allSkills.length;
    renderSkills();
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
  const container = document.getElementById("mySessions");
  if (!currentUser) {
    container.innerHTML = "";
    return;
  }

  try {
    const data = await apiRequest("/sessions/mine");
    if (!data.sessions.length) {
      container.innerHTML = '<div class="col-12 text-muted">You have not requested any sessions yet.</div>';
      return;
    }

    container.innerHTML = data.sessions.map((session) => `
      <div class="col-md-6">
        <div class="session-card">
          <h4 class="h6">${escapeHtml(session.skill?.title || "Skill session")}</h4>
          <p class="mb-1"><strong>Teacher:</strong> ${escapeHtml(session.teacher?.name || "Student")}</p>
          <p class="mb-1"><strong>Date:</strong> ${escapeHtml(session.preferredDate)}</p>
          <p class="mb-1"><strong>Status:</strong> <span class="badge text-bg-${session.status === "Accepted" ? "success" : "secondary"}">${escapeHtml(session.status)}</span></p>
          <p class="text-muted mb-0">${escapeHtml(session.note || "No message added.")}</p>
        </div>
      </div>`).join("");
  } catch (error) {
    container.innerHTML = `<div class="col-12 text-muted">${escapeHtml(error.message)}</div>`;
  }
}

async function checkLogin() {
  try {
    const data = await apiRequest("/auth/me");
    currentUser = data.user || null;
    if (!currentUser) {
      sessionToken = "";
      localStorage.removeItem("skillswap_token");
    }
  } catch (error) {
    currentUser = null;
  }
  setAuthView();
  await loadSkills();
  await loadMySessions();
}

checkLogin();
