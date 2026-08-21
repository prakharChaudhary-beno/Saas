const errorHandler = (err, req, res, next) => {
  console.error('[ErrorHandler]', err.message, err.stack?.split('\n')[1]);
  
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  
  // Handle MongoDB duplicate key error (E11000)
  if (err.code === 11000 || err.name === 'MongoServerError') {
    statusCode = 409;
    
    // Extract field name from error message
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'field';
    const value = err.keyValue?.[field] || '';
    
    if (field === 'email') {
      message = 'This email is already registered. Please use a different email address.';
    } else if (field) {
      message = `Duplicate value entered for ${field}. This ${field} already exists.`;
    } else {
      message = 'Duplicate entry found. This record already exists.';
    }
  }

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;