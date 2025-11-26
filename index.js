const express = require("express");
const fs = require("fs");
const fetch = require("node-fetch");
const path = require("path");

const app = express();

// tasks directory inside project
const TASK_DIR = path.join(__dirname, "tasks");
if (!fs.existsSync(TASK_DIR)) {
  fs.mkdirSync(TASK_DIR, { recursive: true });
}

function newTaskID() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
}

// --- /start endpoint to queue job ---
app.get("/start", (req, res) => {
  const { main_url, meme_url } = req.query;
  if (!main_url || !meme_url) {
    return res.json({ status: "error", msg: "main_url & meme_url required" });
  }

  const id = newTaskID();
  const file = path.join(TASK_DIR, `${id}.json`);

  const task = { task_id: id, main_url, meme_url, status: "queued", response: null, error: null };
  fs.writeFileSync(file, JSON.stringify(task, null, 2));

  return res.json({ task_id: id, status: "queued" });
});

// --- /status endpoint to check job ---
app.get("/status", (req, res) => {
  const { task_id } = req.query;
  if (!task_id) return res.json({ status: "error", msg: "task_id required" });

  const file = path.join(TASK_DIR, `${task_id}.json`);
  if (!fs.existsSync(file)) {
    return res.json({ status: "error", msg: "invalid task_id" });
  }

  const data = JSON.parse(fs.readFileSync(file));
  return res.json(data);
});

// Background worker — runs every few seconds to process queue
setInterval(async () => {
  const files = fs.readdirSync(TASK_DIR);
  for (const fname of files) {
    const fpath = path.join(TASK_DIR, fname);
    let task = JSON.parse(fs.readFileSync(fpath));

    if (task.status !== "queued") continue;

    task.status = "processing";
    fs.writeFileSync(fpath, JSON.stringify(task, null, 2));

    try {
      const url = `http://src.is-normal.site:7782/api.php?main_url=${encodeURIComponent(task.main_url)}&meme_url=${encodeURIComponent(task.meme_url)}`;
      const resp = await fetch(url, { timeout: 0 });
      const j = await resp.json();

      task.status = "done";
      task.response = j;
      fs.writeFileSync(fpath, JSON.stringify(task, null, 2));

    } catch (err) {
      task.status = "failed";
      task.error = err.message;
      fs.writeFileSync(fpath, JSON.stringify(task, null, 2));
    }
  }
}, 3000);

// Start express server — respect Railway port
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("Task API running on port", PORT);
});
