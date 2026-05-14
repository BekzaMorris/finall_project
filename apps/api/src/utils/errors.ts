/**
 * Custom error classes for the API.
 * Each error type maps to a specific HTTP status code.
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  public readonly fields?: Record<string, string>;

  constructor(message: string, fields?: Record<string, string>) {
    super(message, 400);
    this.fields = fields;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Invalid credentials') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not Found') {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409);
  }
}

export class StatusTransitionError extends AppError {
  public readonly currentStatus: string;
  public readonly allowedTransitions: string[];

  constructor(currentStatus: string, allowedTransitions: string[]) {
    super(
      `Invalid status transition from ${currentStatus}. Allowed transitions: ${allowedTransitions.length > 0 ? allowedTransitions.join(', ') : 'none (terminal state)'}`,
      422,
    );
    this.currentStatus = currentStatus;
    this.allowedTransitions = allowedTransitions;
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(message = 'Too Many Requests', retryAfter = 60) {
    super(message, 429);
    this.retryAfter = retryAfter;
  }
}
