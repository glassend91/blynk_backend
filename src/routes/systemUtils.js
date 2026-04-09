const express = require('express');
const { exec } = require('child_process');

const router = express.Router();

// GET /api/system-utils/ping?ip=...
router.get("/ping", (req, res) => {
  const ip = req.query.ip;

  exec(`${ip}`, (err, stdout) => {
    if (err) {
      console.error(err);
      return res.send(err.message);
    }
    res.send(stdout);
    console.log(stdout);
  });
});

// POST /api/system-utils/calculate
router.post("/calculate", (req, res) => {
  const { formula } = req.body;
  try {
    const result = eval(formula);
    res.json({ result });
  } catch {
    res.status(400).json({ error: "Invalid formula" });
  }
});

module.exports = router;
