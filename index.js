const express = require("express");
const fs = require("fs");
const fetch = require("node-fetch");
const path = require("path");

const app = express();

// ------------------------------
// Correct, Railway-safe tasks folder
// ------------------------------
const TASK_DIR = path.join(__dirname, "tasks");

if (!fs.existsSync(TASK_DIR)) {
    fs.mkdirSync(TASK_DIR, { recursive: true });
}

// Generate task ID
function newTaskID() {
    return (
        Date.now().toString(36) +
        Math.random().toString(36).substring(2, 10)
    );
}

// ------------------------------
// /start → Create new task
// ------------------------------
app.get("/start", (req, res) => {
    const { main_url, meme_url } = req.query;

    if (!main_url || !meme_url) {
        return res.json({ status: "error", msg: "main_url & meme_url required" });
    }

    const id = newTaskID();
    const fpath = path.join(TASK_DIR, `${id}.json`);

    const task = {
        task_id: id,
        main_url,
        meme_url,
        status: "queued",
        response: null,
        error: null
    };

    fs.writeFileSync(fpath, JSON.stringify(task, null, 2));

    return res.json({ task_id: id, status: "queued" });
});

// ------------------------------
// /status → Check task status
// ------------------------------
app.get("/status", (req, res) => {
    const { task_id } = req.query;

    if (!task_id) {
        return res.json({ status: "error", msg: "task_id required" });
    }

    const fpath = path.join(TASK_DIR, `${task_id}.json`);

    if (!fs.existsSync(fpath)) {
        return res.json({ status: "error", msg: "invalid task_id" });
    }

    const data = JSON.parse(fs.readFileSync(fpath));
    return res.json(data);
});

// ------------------------------
// Background Worker → every 3 sec
// ------------------------------
setInterval(async () => {
    const files = fs.readdirSync(TASK_DIR);

    for (const file of files) {
        const fpath = path.join(TASK_DIR, file);
        let data = JSON.parse(fs.readFileSync(fpath));

        if (data.status !== "queued") continue;

        // Mark as processing
        data.status = "processing";
        fs.writeFileSync(fpath, JSON.stringify(data, null, 2));

        try {
            // Build main API URL
            const url =
                `http://src.is-normal.site:7782/api.php?main_url=${encodeURIComponent(data.main_url)}&meme_url=${encodeURIComponent(data.meme_url)}`;

            // Wait unlimited time (no timeout)
            const resp = await fetch(url, { timeout: 0 });
            const json = await resp.json();

            // Save success response
            data.status = "done";
            data.response = json;
            fs.writeFileSync(fpath, JSON.stringify(data, null, 2));

        } catch (err) {
            data.status = "failed";
            data.error = err.message;
            fs.writeFileSync(fpath, JSON.stringify(data, null, 2));
        }
    }
}, 3000);

// ------------------------------
// Must use Railway's dynamic port
// ------------------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log("Task API running on port", PORT);
});
