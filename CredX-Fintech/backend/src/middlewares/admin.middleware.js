const requireRole = require('./role.middleware');

// Kept as a named middleware for the admin routes.
module.exports = requireRole('admin');
