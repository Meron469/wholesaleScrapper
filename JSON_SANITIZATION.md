# JSON Sanitization Techniques

This document outlines the comprehensive approach we've implemented to ensure our Zillow FSBO scraper never returns HTML content, especially CAPTCHA pages, and always provides clean JSON data.

## Multi-Layer Sanitization Strategy

We've implemented a "belt and suspenders" approach with multiple validation layers to guarantee clean JSON responses:

### 1. Initial HTML Detection
- Response type is explicitly set to `text` to allow inspecting raw content
- Comprehensive pattern detection checks for common HTML markers like:
  - `<!DOCTYPE html>`
  - `<html`, `<body>`, `<head>`
  - `<div>`, `<script>`, `<iframe>`, `<meta>`

### 2. Deep Sanitization Function
- Recursively inspects all strings in response objects
- Converts any HTML content to clean error objects
- Preserves the original data structure while removing potentially harmful content

### 3. Final Validation
- Last check before sending response
- JSON.stringify() + pattern match to catch any missed HTML content
- Complete fallback to sanitized error response if HTML is detected

### 4. Standardized Error Responses
- All error responses follow a consistent JSON structure
- Include timestamps, status codes, and error types
- Never include original HTML content that might contain tracking scripts

## Example Sanitized Error Response

```json
{
  "error": "HTML_RESPONSE_BLOCKED",
  "message": "The scraper returned HTML content which was blocked",
  "zipCode": "90210",
  "count": 0,
  "listings": [],
  "timestamp": "2025-04-30T02:45:10.123Z",
  "status": "error"
}
```

## Test Endpoints

For testing and debugging purposes, we've added two reliable endpoints that always return clean JSON:

### 1. `/api/test-json`
Returns a sample Zillow FSBO listing response that matches the structure of real data

### 2. `/api/test/:zipCode`
Returns a simple success message confirming the API is working properly

## Additional Safeguards

- Custom axios request options to handle all status codes gracefully
- Response type checking to ensure proper data format
- Multiple fallback mechanisms for various error scenarios
- Consistent error format regardless of where the error occurs

This comprehensive approach ensures our API never returns HTML content, especially CAPTCHA challenges, maintaining a reliable and secure service regardless of Zillow's anti-scraping measures.