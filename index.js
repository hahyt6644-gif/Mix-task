const express = require("express");
const fs = require("fs");
const fetch = require("node-fetch");
const path = require("path");

const app = express();

// Writable task directory (Railway-safe)
const TASK_DIR = path.join(__dirname, "tasks");
if (!fs.existsSync(TASK_DIR)) {
    fs.mkdirSync(TASK_DIR, { recursive: true });
}

function newTaskID() {
    return (
        Date.now().toString(36) +
        Math.random().toString(36).substring(2, 10)
    );
}

// CREATE TASK
app.get("/start", (req, res) => {
    const { main_url, meme_url } = req.query;
    if (!main_url || !meme_url) {
        return res.json({ status: "error", msg: "main_url & meme_url required" });
    }

    const id = newTaskID();
    const filePath = path.join(TASK_DIR, `${id}.json`);

    const task = {
        task_id: id,
        main_url,
        meme_url,
        status: "queued",
        response: null,
        error: null
    };

    fs.writeFileSync(filePath, JSON.stringify(task, null, 2));

    return res.json({ task_id: id, status: "queued" });
});

// CHECK STATUS
app.get("/status", (req, res) => {
    const { task_id } = req.query;

    if (!task_id) {
        return res.json({ status: "error", msg: "task_id required" });
    }

    const filePath = path.join(TASK_DIR, `${task_id}.json`);
    if (!fs.existsSync(filePath)) {
        return res.json({ status: "error", msg: "invalid task_id" });
    }

    const data = JSON.parse(fs.readFileSync(filePath));
    return res.json(data);
});

// BACKGROUND WORKER
setInterval(async () => {
    const files = fs.readdirSync(TASK_DIR);

    for (const file of files) {
        const filePath = path.join(TASK_DIR, file);
        let task = JSON.parse(fs.readFileSync(filePath));

        if (task.status !== "queued") continue;

        task.status = "processing";
        fs.writeFileSync(filePath, JSON.stringify(task, null, 2));

        try {
            const url =
                `http://src.is-normal.site:7782/api.php?main_url=${encodeURIComponent(task.main_url)}&meme_url=${encodeURIComponent(task.meme_url)}`;

            const resp = await fetch(url, { timeout: 0 }); // no timeout
            const json = await resp.json();

            task.status = "done";
            task.response = json;
            fs.writeFileSync(filePath, JSON.stringify(task, null, 2));

        } catch (err) {
            task.status = "failed";
            task.error = err.message;
            fs.writeFileSync(filePath, JSON.stringify(task, null, 2));
        }
    }
}, 3000);

// START SERVER — Railway compatible
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log("Task API running on port", PORT);
});
