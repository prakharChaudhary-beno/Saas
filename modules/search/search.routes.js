// modules/search/search.routes.js
// Global search API endpoint

const express = require('express')
const router = express.Router()
const searchController = require('./search.controller')
const { authenticate } = require('../../middlewares/auth.middleware')

// ─── Global Search Endpoint ────────────────────────────────────────────────
// GET /api/v1/search?q={query}&limit={5}&modules={employees,leave}
//
// Headers:
//   Authorization: Bearer {token}
//
// Query Params:
//   q       - Search query (required, min 2 chars)
//   limit   - Results per module (default: 5, max: 20)
//   modules - Comma-separated module filter (optional)
//
// Response:
//   {
//     success: true,
//     query: "rahul",
//     results: {
//       employees: [...],
//       leave: [...],
//       departments: [...]
//     },
//     count: 12
//   }
// ────────────────────────────────────────────────────────────────────────────
router.get('/', authenticate, searchController.globalSearch)

module.exports = router
