const express = require("express");
const fs = require("fs");
const fetch = require("node-fetch");

const app = express();
const TASK_DIR = "/home/container/tasks";

if (!fs.existsSync(TASK_DIR)) fs.mkdirSync(TASK_DIR);

// Generate random task id
function newTaskID() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
}

// -------------------------------
// 1) START ENDPOINT
// -------------------------------
app.get("/start", (req, res) => {
    const { main_url, meme_url } = req.query;

    if (!main_url || !meme_url) {
        return res.json({ status: "error", msg: "main_url & meme_url required" });
    }

    const id = newTaskID();
    const taskFile = `${TASK_DIR}/${id}.json`;

    const taskData = {
        task_id: id,
        main_url,
        meme_url,
        status: "queued",
        response: null,
        error: null
    };

    fs.writeFileSync(taskFile, JSON.stringify(taskData, null, 2));

    return res.json({
        task_id: id,
        status: "queued"
    });
});

// -------------------------------
// 2) STATUS ENDPOINT
// -------------------------------
app.get("/status", (req, res) => {
    const { task_id } = req.query;

    if (!task_id) return res.json({ status: "error", msg: "task_id required" });

    const file = `${TASK_DIR}/${task_id}.json`;
    if (!fs.existsSync(file)) {
        return res.json({ status: "error", msg: "invalid task_id" });
    }

    const task = JSON.parse(fs.readFileSync(file));

    return res.json(task);
});

// -------------------------------
// 3) BACKGROUND WORKER
// -------------------------------
setInterval(async () => {
    const tasks = fs.readdirSync(TASK_DIR);

    for (const file of tasks) {
        const path = `${TASK_DIR}/${file}`;
        let data = JSON.parse(fs.readFileSync(path));

        if (data.status !== "queued") continue;

        // Mark as processing
        data.status = "processing";
        fs.writeFileSync(path, JSON.stringify(data, null, 2));

        try {
            // Call MAIN API (your port 7782 server)
            const url =
                `http://src.is-normal.site:7782/api.php?main_url=${encodeURIComponent(data.main_url)}&meme_url=${encodeURIComponent(data.meme_url)}`;

            const response = await fetch(url, { timeout: 0 }); // no timeout
            const json = await response.json();

            // Save response
            data.status = "done";
            data.response = json;
            fs.writeFileSync(path, JSON.stringify(data, null, 2));

        } catch (err) {
            data.status = "failed";
            data.error = err.message;
            fs.writeFileSync(path, JSON.stringify(data, null, 2));
        }
    }
}, 3000); // check every 3 sec

// -------------------------------
app.listen(3000, () => console.log("Task API Started"));
