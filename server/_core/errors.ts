/**
 * Error Handling Utilities
 * 
 * This module provides standardized error handling utilities for the SSP application.
 * It includes custom error classes, error codes, and helper functions for consistent
 * error responses across the API.
 * 
 * @module server/_core/errors
 */

import { TRPCError } from "@trpc/server";

/**
 * Application-specific error codes
 * 
 * These codes provide more granular error information than HTTP status codes.
 */
export enum ErrorCode {
  // Authentication & Authorization (1xxx)
  UNAUTHORIZED = 1001,
  FORBIDDEN = 1002,
  TOKEN_EXPIRED = 1003,
  INVALID_CREDENTIALS = 1004,

  // Resource Errors (2xxx)
  RESOURCE_NOT_FOUND = 2001,
  RESOURCE_ALREADY_EXISTS = 2002,
  RESOURCE_DELETED = 2003,

  // Validation Errors (3xxx)
  INVALID_INPUT = 3001,
  MISSING_REQUIRED_FIELD = 3002,
  INVALID_FORMAT = 3003,
  OUT_OF_RANGE = 3004,

  // Business Logic Errors (4xxx)
  INSUFFICIENT_BALANCE = 4001,
  INSUFFICIENT_STOCK = 4002,
  PAYMENT_LIMIT_EXCEEDED = 4003,
  DEVICE_OFFLINE = 4004,
  FACE_RECOGNITION_INACTIVE = 4005,
  WALLET_INACTIVE = 4006,
  ORDER_CANNOT_BE_CANCELLED = 4007,

  // Payment Errors (5xxx)
  PAYMENT_FAILED = 5001,
  PAYMENT_TIMEOUT = 5002,
  PAYMENT_DECLINED = 5003,
  BLOCKCHAIN_ERROR = 5004,

  // System Errors (9xxx)
  INTERNAL_ERROR = 9001,
  DATABASE_ERROR = 9002,
  EXTERNAL_SERVICE_ERROR = 9003,
}

/**
 * Error message templates
 * 
 * Provides consistent error messages across the application.
 */
export const ErrorMessages: Record<ErrorCode, string> = {
  // Authentication & Authorization
  [ErrorCode.UNAUTHORIZED]: "Authentication required",
  [ErrorCode.FORBIDDEN]: "You don't have permission to perform this action",
  [ErrorCode.TOKEN_EXPIRED]: "Your session has expired. Please log in again",
  [ErrorCode.INVALID_CREDENTIALS]: "Invalid username or password",

  // Resource Errors
  [ErrorCode.RESOURCE_NOT_FOUND]: "The requested resource was not found",
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: "A resource with this identifier already exists",
  [ErrorCode.RESOURCE_DELETED]: "This resource has been deleted",

  // Validation Errors
  [ErrorCode.INVALID_INPUT]: "Invalid input provided",
  [ErrorCode.MISSING_REQUIRED_FIELD]: "Required field is missing",
  [ErrorCode.INVALID_FORMAT]: "Invalid format",
  [ErrorCode.OUT_OF_RANGE]: "Value is out of acceptable range",

  // Business Logic Errors
  [ErrorCode.INSUFFICIENT_BALANCE]: "Insufficient wallet balance",
  [ErrorCode.INSUFFICIENT_STOCK]: "Insufficient product stock",
  [ErrorCode.PAYMENT_LIMIT_EXCEEDED]: "Payment amount exceeds limit",
  [ErrorCode.DEVICE_OFFLINE]: "Device is offline",
  [ErrorCode.FACE_RECOGNITION_INACTIVE]: "Face recognition is not active",
  [ErrorCode.WALLET_INACTIVE]: "Wallet is not active",
  [ErrorCode.ORDER_CANNOT_BE_CANCELLED]: "Order cannot be cancelled in current state",

  // Payment Errors
  [ErrorCode.PAYMENT_FAILED]: "Payment processing failed",
  [ErrorCode.PAYMENT_TIMEOUT]: "Payment request timed out",
  [ErrorCode.PAYMENT_DECLINED]: "Payment was declined",
  [ErrorCode.BLOCKCHAIN_ERROR]: "Blockchain transaction failed",

  // System Errors
  [ErrorCode.INTERNAL_ERROR]: "An internal error occurred",
  [ErrorCode.DATABASE_ERROR]: "Database operation failed",
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: "External service is unavailable",
};

/**
 * Map error codes to HTTP status codes
 */
const ErrorCodeToHttpStatus: Record<ErrorCode, number> = {
  // 401 Unauthorized
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.INVALID_CREDENTIALS]: 401,

  // 403 Forbidden
  [ErrorCode.FORBIDDEN]: 403,

  // 404 Not Found
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ErrorCode.RESOURCE_DELETED]: 404,

  // 400 Bad Request
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCode.INVALID_FORMAT]: 400,
  [ErrorCode.OUT_OF_RANGE]: 400,

  // 409 Conflict
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: 409,

  // 422 Unprocessable Entity
  [ErrorCode.INSUFFICIENT_BALANCE]: 422,
  [ErrorCode.INSUFFICIENT_STOCK]: 422,
  [ErrorCode.PAYMENT_LIMIT_EXCEEDED]: 422,
  [ErrorCode.DEVICE_OFFLINE]: 422,
  [ErrorCode.FACE_RECOGNITION_INACTIVE]: 422,
  [ErrorCode.WALLET_INACTIVE]: 422,
  [ErrorCode.ORDER_CANNOT_BE_CANCELLED]: 422,

  // 402 Payment Required
  [ErrorCode.PAYMENT_FAILED]: 402,
  [ErrorCode.PAYMENT_TIMEOUT]: 408,
  [ErrorCode.PAYMENT_DECLINED]: 402,
  [ErrorCode.BLOCKCHAIN_ERROR]: 502,

  // 500 Internal Server Error
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 503,
};

/**
 * Custom Application Error
 * 
 * Extends the standard Error class with application-specific error codes
 * and additional context.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly details?: any;
  public readonly timestamp: Date;

  constructor(
    code: ErrorCode,
    message?: string,
    details?: any
  ) {
    super(message || ErrorMessages[code]);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = ErrorCodeToHttpStatus[code] || 500;
    this.details = details;
    this.timestamp = new Date();

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to TRPC error
   */
  toTRPCError(): TRPCError {
    const trpcCode = this.httpStatusToTRPCCode(this.httpStatus);
    
    return new TRPCError({
      code: trpcCode,
      message: this.message,
      cause: {
        code: this.code,
        details: this.details,
        timestamp: this.timestamp,
      },
    });
  }

  /**
   * Convert HTTP status to TRPC error code
   */
  private httpStatusToTRPCCode(status: number): any {
    switch (status) {
      case 400: return "BAD_REQUEST";
      case 401: return "UNAUTHORIZED";
      case 403: return "FORBIDDEN";
      case 404: return "NOT_FOUND";
      case 408: return "TIMEOUT";
      case 409: return "CONFLICT";
      case 422: return "PRECONDITION_FAILED";
      case 429: return "TOO_MANY_REQUESTS";
      case 500: return "INTERNAL_SERVER_ERROR";
      case 502: return "BAD_GATEWAY";
      case 503: return "SERVICE_UNAVAILABLE";
      default: return "INTERNAL_SERVER_ERROR";
    }
  }

  /**
   * Convert to JSON for logging or API responses
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      httpStatus: this.httpStatus,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

/**
 * Error Factory Functions
 * 
 * Convenient functions for creating common errors.
 */

export function notFoundError(resource: string, identifier?: string | number): AppError {
  return new AppError(
    ErrorCode.RESOURCE_NOT_FOUND,
    identifier 
      ? `${resource} with identifier "${identifier}" not found`
      : `${resource} not found`,
    { resource, identifier }
  );
}

export function insufficientBalanceError(
  balance: number,
  required: number,
  currency: string = "USD"
): AppError {
  return new AppError(
    ErrorCode.INSUFFICIENT_BALANCE,
    `Insufficient balance. Available: ${(balance / 100).toFixed(2)} ${currency}, Required: ${(required / 100).toFixed(2)} ${currency}`,
    { balance, required, currency }
  );
}

export function insufficientStockError(
  productName: string,
  available: number,
  requested: number
): AppError {
  return new AppError(
    ErrorCode.INSUFFICIENT_STOCK,
    `Insufficient stock for "${productName}". Available: ${available}, Requested: ${requested}`,
    { productName, available, requested }
  );
}

export function paymentLimitExceededError(
  amount: number,
  limit: number,
  currency: string = "USD"
): AppError {
  return new AppError(
    ErrorCode.PAYMENT_LIMIT_EXCEEDED,
    `Payment amount (${(amount / 100).toFixed(2)} ${currency}) exceeds limit (${(limit / 100).toFixed(2)} ${currency})`,
    { amount, limit, currency }
  );
}

export function deviceOfflineError(deviceId: number, status: string): AppError {
  return new AppError(
    ErrorCode.DEVICE_OFFLINE,
    `Device ${deviceId} is ${status}. Only online devices can process orders.`,
    { deviceId, status }
  );
}

export function inactiveResourceError(resource: string, status: string): AppError {
  const code = resource === "wallet" 
    ? ErrorCode.WALLET_INACTIVE 
    : ErrorCode.FACE_RECOGNITION_INACTIVE;
  
  return new AppError(
    code,
    `${resource} is ${status}. Only active ${resource}s can be used.`,
    { resource, status }
  );
}

/**
 * Error Logger
 * 
 * Logs errors with appropriate detail level based on error type.
 */
export function logError(error: Error | AppError, context?: string): void {
  const timestamp = new Date().toISOString();
  const contextStr = context ? `[${context}]` : "";

  if (error instanceof AppError) {
    console.error(
      `${timestamp} ${contextStr} AppError [${error.code}]:`,
      error.message,
      error.details ? `\nDetails: ${JSON.stringify(error.details)}` : ""
    );
  } else {
    console.error(
      `${timestamp} ${contextStr} Error:`,
      error.message,
      error.stack
    );
  }
}

/**
 * Async error wrapper
 * 
 * Wraps async functions to catch and handle errors consistently.
 */
export function asyncHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(error as Error, context);
      throw error;
    }
  }) as T;
}
