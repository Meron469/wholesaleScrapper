# Zillow CAPTCHA Bypass Implementation Guide

## Overview
This document outlines the anti-CAPTCHA techniques implemented in our Zillow FSBO scraper to maximize success rates when dealing with various protection mechanisms. The system combines automated CAPTCHA solving using the Anti-Captcha service with advanced manual bypass techniques.

## Implemented Techniques

### 1. Anti-Captcha Service Integration
- **Package**: @antiadmin/anticaptchaofficial
- **Purpose**: Professional CAPTCHA solving service that uses a combination of AI and human workers
- **Cost**: $0.50-$1.80 per 1,000 CAPTCHAs (varies by type)
- **CAPTCHA Types Supported**:
  - reCAPTCHA v2 (checkbox and image challenges)
  - PerimeterX CAPTCHAs (press-and-hold type)
  - Image CAPTCHAs (select all images with...)
- **Implementation**: Automatically detects CAPTCHA type and sends to Anti-Captcha's API for solving

### 2. Puppeteer Stealth Plugin
- **Package**: puppeteer-extra + puppeteer-extra-plugin-stealth
- **Purpose**: Makes Puppeteer harder to detect by websites
- **Implementation**: The stealth plugin modifies browser fingerprints, WebDriver flags, and other characteristics that could identify automation

### 2. User-Agent Randomization
- **Package**: random-useragent
- **Purpose**: Prevents tracking through browser fingerprinting
- **Implementation**: Each session uses a different, realistic user agent

### 3. Browser Fingerprint Spoofing
- **Function**: Custom JavaScript injections to modify browser properties
- **Properties Modified**:
  - Navigator properties (webdriver, hardwareConcurrency, deviceMemory)
  - Plugins array
  - Screen dimensions
  - WebGL renderer information
  - Canvas fingerprinting randomization

### 4. Human-like Navigation
- **Technique**: Multi-step approach to appear more natural
- **Steps**:
  1. Visit Google first
  2. Search for Zillow (optional)
  3. Click on Zillow results
  4. Finally navigate to target URL
- **Benefits**: Establishes browser history and appears more legitimate

### 5. Press-and-Hold CAPTCHA Handling
- **Detection**: Comprehensive selector list for identifying various CAPTCHA elements
- **Interaction**: Natural mouse movements with acceleration/deceleration curves
- **Timing**: Random hold times between 2-4 seconds

### 6. Slider CAPTCHA Handling
- **Detection**: Intelligent identification of slider vs. standard press elements
- **Movement**: Natural slide behavior with ease-in/ease-out motion
- **Jitter**: Small random movements to appear human-like

### 7. Cookie & Header Management
- **Technique**: Setting realistic cookies that typical browsers have
- **Headers**: Adding proper Sec-* headers and other browser-specific headers

### 8. Mouse Movement Simulation
- **Algorithm**: Natural curve movements using bezier or easing functions
- **Randomization**: Varies timing, acceleration, and adds subtle jitter

## Usage Instructions

### Basic Usage
```javascript
// The scraper automatically implements all techniques
// Just use the /scrape endpoint with a ZIP code
// Example: /scrape?zip=75243
```

### Advanced Options
```javascript
// Different URL formats can be tested with the urlType parameter
// Example: /scrape?zip=75243&urlType=fsbo
// Options: simple, fsbo, complex
```

## Success Metrics

The CAPTCHA bypass implementation has significantly reduced detection rates and improved scraping success. When CAPTCHA challenges do appear, our system can often solve them automatically using the methods described above.

## Debugging Tools

When a CAPTCHA is encountered, the system:
1. Saves an HTML copy of the CAPTCHA page to 'captcha-page.html'
2. Takes a screenshot saved as 'captcha-page.png'
3. Logs detailed information about the CAPTCHA type and bypass attempts

## Maintenance Notes

As CAPTCHA systems evolve, the selectors and techniques may need updates. The modular design allows for adding new bypass methods when needed.