require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/student_skill_exchange";

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const skillSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 60 },
  category: { type: String, required: true, enum: ["Programming", "Design", "Languages", "Academics", "Music", "Other"] },
  description: { type: String, required: true, trim: true, maxlength: 300 },
  level: { type: String, enum: ["Beginner", "Intermediate", "Advanced"], default: "Beginner" },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now }
});

const sessionSchema = new mongoose.Schema({
  skill: { type: mongoose.Schema.Types.ObjectId, ref: "Skill", required: true },
  learner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  preferredDate: { type: String, required: true },
  note: { type: String, trim: true, maxlength: 300, default: "" },
  status: { type: String, enum: ["Pending", "Accepted", "Declined"], default: "Pending" },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);
const Skill = mongoose.model("Skill", skillSchema);
const LearningSession = mongoose.model("LearningSession", sessionSchema);

// in memory 

const loginSessions = new Map();

function makeToken() {
  return crypto.randomBytes(32).toString("hex");
}

function safeUser(user) {
  return { id: user._id.toString(), name: user.name, email: user.email };
}

function authRequired(req, res, next) {
  const token = req.header("x-session-token");
  const userId = token ? loginSessions.get(token) : null;
  if (!userId) {
    return res.status(401).json({ message: "Please log in to continue." });
  }
  req.userId = userId;
  req.sessionToken = token;
  next();
}

app.use((req, res, next) => {
  const token = req.header("x-session-token");
  if (token && loginSessions.has(token)) {
    req.userId = loginSessions.get(token);
    req.sessionToken = token;
  }
  next();
});

//login or reg

app.post("/api/auth/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (name.length < 2) return res.status(400).json({ message: "Please enter your full name." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Please enter a valid email." });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: "An account with this email already exists." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword });
    const token = makeToken();
    loginSessions.set(token, user._id.toString());
    res.json({ user: safeUser(user), token });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "An account with this email already exists." });
    res.status(500).json({ message: "Could not create account. Please try again." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Email or password is incorrect." });
    }
    const token = makeToken();
    loginSessions.set(token, user._id.toString());
    res.json({ user: safeUser(user), token });
  } catch (error) {
    res.status(500).json({ message: "Could not log in. Please try again." });
  }
});

app.post("/api/auth/logout", (req, res) => {
  const token = req.header("x-session-token");
  if (token) loginSessions.delete(token);
  res.json({ message: "Logged out." });
});

app.get("/api/auth/me", async (req, res) => {
  try {
    const token = req.header("x-session-token");
    const userId = token ? loginSessions.get(token) : null;
    if (!userId) return res.json({ user: null });
    const user = await User.findById(userId);
    if (!user) return res.json({ user: null });
    res.json({ user: safeUser(user) });
  } catch (error) {
    res.status(500).json({ message: "Could not check login." });
  }
});

app.get("/api/skills", async (req, res) => {
  try {
    const skills = await Skill.find().populate("owner", "name").sort({ createdAt: -1 }).lean();
    res.json({ skills });
  } catch (error) {
    res.status(500).json({ message: "Could not load skills." });
  }
});

app.post("/api/skills", authRequired, async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();
    const category = String(req.body.category || "");
    const description = String(req.body.description || "").trim();
    const level = String(req.body.level || "Beginner");

    if (title.length < 2) return res.status(400).json({ message: "Enter a skill name." });
    if (!["Programming", "Design", "Languages", "Academics", "Music", "Other"].includes(category)) {
      return res.status(400).json({ message: "Choose a valid category." });
    }
    if (description.length < 5) return res.status(400).json({ message: "Please add a short description." });
    if (!["Beginner", "Intermediate", "Advanced"].includes(level)) return res.status(400).json({ message: "Choose a valid level." });

    const skill = await Skill.create({ title, category, description, level, owner: req.userId });
    res.status(201).json({ skill });
  } catch (error) {
    res.status(500).json({ message: "Could not save your skill." });
  }
});

app.post("/api/sessions", authRequired, async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const skillId = String(body.skillId || "");
    if (!mongoose.Types.ObjectId.isValid(skillId)) {
      return res.status(400).json({ message: "Choose a valid skill." });
    }

    const skill = await Skill.findById(skillId);
    if (!skill) return res.status(404).json({ message: "This skill could not be found." });
    if (skill.owner.toString() === req.userId) return res.status(400).json({ message: "You cannot request a session for your own skill." });

    const preferredDate = String(body.preferredDate || "");
    const parsedDate = new Date(`${preferredDate}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)
      || Number.isNaN(parsedDate.getTime())
      || parsedDate.toISOString().slice(0, 10) !== preferredDate
      || preferredDate < new Date().toISOString().slice(0, 10)) {
      return res.status(400).json({ message: "Please choose today or a future date." });
    }

    const note = String(body.note || "").trim();
    if (note.length > 300) return res.status(400).json({ message: "Please keep your message under 300 characters." });
    const session = await LearningSession.create({
      skill: skill._id,
      learner: req.userId,
      teacher: skill.owner,
      preferredDate,
      note
    });
    res.status(201).json({ session });
  } catch (error) {
    res.status(500).json({ message: "Could not send the session request." });
  }
});

app.get("/api/sessions/mine", authRequired, async (req, res) => {
  try {
    const sessions = await LearningSession.find({ learner: req.userId })
      .populate("skill", "title category")
      .populate("teacher", "name")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ message: "Could not load your session requests." });
  }
});

app.get("/api/sessions/incoming", authRequired, async (req, res) => {
  try {
    const sessions = await LearningSession.find({ teacher: req.userId })
      .populate("skill", "title category")
      .populate("learner", "name email")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ message: "Could not load incoming requests." });
  }
});

app.patch("/api/sessions/:sessionId/status", authRequired, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { status } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ message: "Choose a valid learning request." });
    }
    if (!["Accepted", "Declined"].includes(status)) {
      return res.status(400).json({ message: "Choose Accept or Reject for this request." });
    }

    const session = await LearningSession.findOneAndUpdate(
      { _id: sessionId, teacher: req.userId, status: "Pending" },
      { $set: { status } },
      { new: true, runValidators: true }
    );
    if (!session) {
      return res.status(404).json({ message: "This request was not found or is no longer pending." });
    }

    res.json({ session });
  } catch (error) {
    res.status(500).json({ message: "Could not update this request." });
  }
});

app.get("/api/stats", async (req, res) => {
  try {
    const [students, skills, sessions] = await Promise.all([
      User.countDocuments(),
      Skill.countDocuments(),
      LearningSession.countDocuments()
    ]);
    res.json({ students, skills, sessions });
  } catch (error) {
    res.status(500).json({ message: "Could not load statistics." });
  }
});

// Add starter skills that are not already in the collection.
async function addSampleSkills() {
  const samples = [
    { title: "Python Basics", category: "Programming", description: "Learn variables, loops, functions and simple Python programs.", level: "Beginner" },
    { title: "HTML and CSS", category: "Programming", description: "Build a basic webpage and style it with CSS.", level: "Beginner" },
    { title: "Poster Designing", category: "Design", description: "Learn the basics of making clear and creative posters.", level: "Beginner" },
    { title: "Spoken English", category: "Languages", description: "Practise everyday English conversations in a friendly way.", level: "Intermediate" },
    { title: "Basic Guitar", category: "Music", description: "Learn a few chords and practise simple songs.", level: "Beginner" },
    { title: "Maths Help", category: "Academics", description: "Study algebra and practise solving basic maths questions.", level: "Intermediate" },
    { title: "JavaScript Fundamentals", category: "Programming", description: "Understand variables, functions, arrays and interactive webpages.", level: "Beginner" },
    { title: "Git and GitHub", category: "Programming", description: "Practise version control, commits and sharing projects on GitHub.", level: "Beginner" },
    { title: "Introduction to Java", category: "Programming", description: "Learn Java syntax, classes and object-oriented programming basics.", level: "Beginner" },
    { title: "Canva Design", category: "Design", description: "Create polished social posts, presentations and simple graphics.", level: "Beginner" },
    { title: "Figma UI Design", category: "Design", description: "Explore layouts, components and clickable app prototypes in Figma.", level: "Intermediate" },
    { title: "Photography Basics", category: "Design", description: "Practise composition, lighting and taking better photos with a phone.", level: "Beginner" },
    { title: "Spanish Conversation", category: "Languages", description: "Build confidence with useful Spanish phrases and everyday conversation.", level: "Beginner" },
    { title: "French for Beginners", category: "Languages", description: "Learn French greetings, pronunciation and common expressions.", level: "Beginner" },
    { title: "Study Skills and Note-taking", category: "Academics", description: "Try practical note-taking, revision and study-planning techniques.", level: "Beginner" },
    { title: "Physics Problem Solving", category: "Academics", description: "Work through foundational mechanics problems step by step.", level: "Intermediate" },
    { title: "Piano Basics", category: "Music", description: "Learn keyboard notes, simple scales and beginner-friendly melodies.", level: "Beginner" },
    { title: "Ukulele for Beginners", category: "Music", description: "Practise basic chords and strumming patterns on the ukulele.", level: "Beginner" },
    { title: "Public Speaking", category: "Other", description: "Build confidence with clear speaking, presentation and practice tips.", level: "Beginner" },
    { title: "Resume and Interview Practice", category: "Other", description: "Get peer support preparing a student resume and practising interviews.", level: "Intermediate" }
  ];

  let sampleOwner = await User.findOne({ email: "sample@skillswap.local" });
  if (!sampleOwner) {
    sampleOwner = await User.create({
      name: "SkillSwap Student",
      email: "sample@skillswap.local",
      password: await bcrypt.hash(crypto.randomBytes(20).toString("hex"), 10)
    });
  }

  const existingSkills = await Skill.find({ title: { $in: samples.map((sample) => sample.title) } })
    .select("title")
    .lean();
  const existingTitles = new Set(existingSkills.map((skill) => skill.title));
  const missingSamples = samples.filter((sample) => !existingTitles.has(sample.title));

  if (missingSamples.length) {
    await Skill.insertMany(missingSamples.map((sample) => ({ ...sample, owner: sampleOwner._id })));
    console.log(`Added ${missingSamples.length} sample skills.`);
  }
}

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log("Connected to MongoDB.");
    await addSampleSkills();
    app.listen(PORT, () => {
      console.log(`Student Skill Exchange is running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Could not connect to MongoDB:", error.message);
    process.exit(1);
  });
