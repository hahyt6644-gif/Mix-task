const express = require("express");
const fetch = require("node-fetch");
const mongoose = require("mongoose");

const app = express();

// --------------------------------------------
// 1. MONGO CONNECTION
// --------------------------------------------
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log("MongoDB Connected"))
.catch(err => console.error("MongoDB Error:", err));

// --------------------------------------------
// 2. MONGO SCHEMA
// --------------------------------------------
const TaskSchema = new mongoose.Schema({
    task_id: String,
    main_url: String,
    meme_url: String,
    status: String,       // queued, processing, done, failed
    response: Object,     // final answer from main API
    error: String
});

const Task = mongoose.model("Task", TaskSchema);

// Helper: Create unique task ID
function newTaskID() {
    return (
        Date.now().toString(36) +
        Math.random().toString(36).substring(2, 10)
    );
}

// --------------------------------------------
// 3. START ENDPOINT  → creates task
// --------------------------------------------
app.get("/start", async (req, res) => {
    const { main_url, meme_url } = req.query;

    if (!main_url || !meme_url) {
        return res.json({ status: "error", msg: "main_url & meme_url required" });
    }

    const id = newTaskID();

    await Task.create({
        task_id: id,
        main_url,
        meme_url,
        status: "queued",
        response: null,
        error: null
    });

    return res.json({ task_id: id, status: "queued" });
});

// --------------------------------------------
// 4. STATUS ENDPOINT  → shows result
// --------------------------------------------
app.get("/status", async (req, res) => {
    const { task_id } = req.query;

    if (!task_id) return res.json({ status: "error", msg: "task_id required" });

    const task = await Task.findOne({ task_id });

    if (!task) return res.json({ status: "error", msg: "invalid task_id" });

    return res.json(task);
});

// --------------------------------------------
// 5. BACKGROUND WORKER (every 3 sec)
// --------------------------------------------
setInterval(async () => {
    const queuedTasks = await Task.find({ status: "queued" });

    for (const job of queuedTasks) {
        job.status = "processing";
        await job.save();

        try {
            const apiURL =
                `http://src.is-normal.site:7782/api.php?main_url=${encodeURIComponent(job.main_url)}&meme_url=${encodeURIComponent(job.meme_url)}`;

            const resp = await fetch(apiURL, { timeout: 0 });
            const json = await resp.json();

            job.status = "done";
            job.response = json;
            await job.save();

        } catch (err) {
            job.status = "failed";
            job.error = err.message;
            await job.save();
        }
    }
}, 3000);

// --------------------------------------------
// 6. START SERVER (Railway-safe)
// --------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log("Task API running on port", PORT);
});
