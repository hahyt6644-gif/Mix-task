const express = require("express");
const fetch = require("node-fetch");

const app = express();

app.get("/", async (req, res) => {
    try {
        const query = req.url.split("?")[1] || "";
        const url = "http://src.is-normal.site:7782/api.php?" + query;

        const response = await fetch(url);
        const data = await response.text();

        res.setHeader("Content-Type", "application/json");
        res.send(data);
        
    } catch (err) {
        console.error("Proxy Error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(3000, () => {
    console.log("Server started on port 3000");
});
