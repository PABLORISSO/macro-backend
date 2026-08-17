const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// GET /api/ipconline/products
router.get('/products', (req, res) => {
  try {
    const filePath = path.join(__dirname, '../../data/ipconline/productos_coto_prueba.json');
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'No existe datos ipconline' });

    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    return res.json({ source: 'ipconline/json', count: data.length, items: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
