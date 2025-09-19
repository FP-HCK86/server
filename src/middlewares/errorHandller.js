function errorHandler(err, req, res, next) {
	
	console.error('[ErrorHandler]', err);

	let code = err.status || 500;
	let message = err.message || 'Internal server error';

	switch (err.name) {
		case 'JsonWebTokenError':
		case 'TokenExpiredError':
			code = 401;
			message = 'Invalid or expired token';
			break;
		case 'Unauthorized':
			code = 401;
			message = message || 'Unauthorized';
			break;
		case 'BadRequest':
			code = 400;
			break;
		case 'NotFound':
			code = 404;
			break;
		case 'Forbidden':
			code = 403;
			break;

		case 'SequelizeValidationError':
		case 'SequelizeUniqueConstraintError':
			code = 400;
			message = (err.errors || []).map(e => e.message).join(', ') || 'Validation error';
			break;
		case 'SequelizeForeignKeyConstraintError':
			code = 400;
			message = 'Invalid reference to another resource';
			break;
	}

	if (/google/i.test(err.message || '') && code === 500) {
		code = 401;
	}

	res.status(code).json({
		status: 'error',
		message,
		...(process.env.NODE_ENV !== 'production' && { details: err.message }),
	});
}

module.exports = errorHandler;

