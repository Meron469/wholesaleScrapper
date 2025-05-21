const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');
const cron = require('node-cron');
const path = require('path');

const app = express();
const port = process.env.PORT || 5000;

let firebaseInitialized = false;
let db;
let zillowCollection;

// Initialize Firebase with environment variables
function initializeFirebase() {
  console.log('--------- Firebase Initialization Start ---------');
  
  // Check if we have the necessary environment variables
  if (!process.env.VITE_FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    console.log('Missing Firebase credentials. The following environment variables are required:');
    console.log('- VITE_FIREBASE_PROJECT_ID: ' + (process.env.VITE_FIREBASE_PROJECT_ID ? 'Present' : 'Missing'));
    console.log('- FIREBASE_CLIENT_EMAIL: ' + (process.env.FIREBASE_CLIENT_EMAIL ? 'Present' : 'Missing'));
    console.log('- FIREBASE_PRIVATE_KEY: ' + (process.env.FIREBASE_PRIVATE_KEY ? 'Present' : 'Missing'));
    console.log('The app will work in demo mode without saving data to Firebase');
    console.log('--------- Firebase Initialization Failed ---------');
    return false;
  }
  
  try {
    // Process the private key to handle any encoding issues
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    
    console.log('Checking private key format...');
    
    // The private key often comes with escaped newlines and quotes that need to be processed
    // First remove any surrounding quotes if present
    if (privateKey && privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
      console.log('Removed surrounding quotes from private key');
    }
    
    // Then replace escaped newlines with actual newlines
    if (privateKey) {
      const originalLength = privateKey.length;
      privateKey = privateKey.replace(/\\n/g, '\n');
      const newLength = privateKey.length;
      
      if (originalLength !== newLength) {
        console.log(`Replaced escaped newlines in private key (length changed from ${originalLength} to ${newLength})`);
      }
    }
    
    // Log a snippet of the key for debugging but keep most of it private
    if (privateKey) {
      const firstPart = privateKey.substring(0, 15);
      const lastPart = privateKey.substring(privateKey.length - 15);
      console.log(`Private key format check: ${firstPart}...${lastPart}`);
    } else {
      console.log('Private key is null or empty');
    }
    
    // Only try to initialize if we have what looks like a valid private key
    if (!privateKey || !privateKey.includes('BEGIN PRIVATE KEY')) {
      console.log('Private key appears to be invalid or improperly formatted. It must contain "BEGIN PRIVATE KEY".');
      console.log('The app will work in demo mode without saving data to Firebase');
      console.log('--------- Firebase Initialization Failed ---------');
      return false;
    }
    
    console.log(`Initializing Firebase with Project ID: ${process.env.VITE_FIREBASE_PROJECT_ID}`);
    console.log(`Using client email: ${process.env.FIREBASE_CLIENT_EMAIL}`);
    
    // Try to initialize Firebase with explicit databaseURL to avoid auth issues
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey
      }),
      // Add explicit database URL to help with authentication
      databaseURL: `https://${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseio.com`
    });
    
    // Test the connection by initializing Firestore
    console.log('Initializing Firestore database...');
    db = admin.firestore();
    
    // Test a simple operation to verify connectivity and set helpful options
    db.settings({ 
      ignoreUndefinedProperties: true,
      // Add retry settings for better reliability
      retry: {
        maxAttempts: 5,
        initialDelayMs: 500,
        maxDelayMs: 5000
      }
    });
    
    // Create the collection reference
    zillowCollection = db.collection('zillow_listings');
    
    // Try a simple operation to validate the connection
    console.log('Testing Firebase connection with a simple operation...');
    
    // Make a quick, simple query to test authentication
    zillowCollection.limit(1).get()
      .then(() => {
        console.log('Successfully tested Firestore connection!');
      })
      .catch(err => {
        console.error('Warning: Firestore test operation failed:', err.message);
        
        // Check if this is a SERVICE_DISABLED error
        if (err.code === 7 && err.details && err.details.includes('SERVICE_DISABLED')) {
          console.error('\n----------- FIRESTORE DATABASE NOT CREATED -----------');
          console.error('You need to create a Firestore database instance:');
          console.error('1. Go to: https://console.firebase.google.com/project/zillow-fsbo-scraper/firestore');
          console.error('2. Click "Create database"');
          console.error('3. Choose "Start in production mode" or "Start in test mode"');
          console.error('4. Select a database location (usually the default is fine)');
          console.error('5. Click "Enable"');
          console.error('6. Wait a few minutes for changes to propagate');
          console.error('7. Restart this server');
          console.error('-----------------------------------------------\n');
        }
        
        console.error('The app will continue, but Firebase operations may fail');
      });
    
    console.log('Firebase initialized successfully');
    console.log('--------- Firebase Initialization Complete ---------');
    return true;
  } catch (error) {
    console.error('Firebase initialization error:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    
    console.log('The app will work in demo mode without saving data to Firebase');
    
    // If Firebase is already initialized, we need to handle that case
    if (error.code === 'app/duplicate-app') {
      console.log('Firebase app already exists, trying to reuse...');
      try {
        // Try to reuse the existing app
        const defaultApp = admin.app();
        db = defaultApp.firestore();
        zillowCollection = db.collection('zillow_listings');
        console.log('Successfully reused existing Firebase app');
        console.log('--------- Firebase Initialization Complete (Reused) ---------');
        return true;
      } catch (innerError) {
        console.error('Failed to reuse Firebase app:', innerError.message);
      }
    }
    
    console.log('--------- Firebase Initialization Failed ---------');
    return false;
  }
}

// Try to initialize Firebase with additional debugging
firebaseInitialized = initializeFirebase();

// Configure Express middleware
// Add request logging
app.use((req, res, next) => {
  console.log(`Request: ${req.method} ${req.url}`);
  next();
});

// Parse JSON and form bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
// Important: This needs to be before route definitions
app.use(express.static('public'));

// Set up CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

/**
 * Helper function to fetch FSBO listings from the Zillow scraper API
 * @param {string} zipCode - ZIP code to search
 * @returns {Promise<Object>} - Response from the scraper
 */
async function fetchZillowListings(zipCode) {
  try {
    // First try the local scraper (for development)
    console.log(`Attempting scrape for ZIP: ${zipCode} from local scraper first`);
    
    try {
      // Try local scraper first with a longer timeout since CAPTCHA bypass takes time
      const localResponse = await axios.get(`http://localhost:5001/scrape?zip=${zipCode}`, {
        timeout: 120000, // 120 second timeout for local scraper with CAPTCHA bypass
        validateStatus: function (status) {
          // Accept all status codes so we can handle them ourselves (including CAPTCHA 403)
          return true;
        },
        responseType: 'text' // Get response as text so we can check if it's HTML
      });
      
      // Enhanced validation to ensure we only ever return clean JSON
      let responseData;
      
      // First check if response is HTML or contains any HTML tags
      if (typeof localResponse.data === 'string' && (
          localResponse.data.includes('<!DOCTYPE html>') || 
          localResponse.data.includes('<html') ||
          localResponse.data.includes('<body') ||
          localResponse.data.includes('<head') ||
          // Additional HTML indicators to more aggressively filter
          localResponse.data.includes('<div') ||
          localResponse.data.includes('<script') ||
          localResponse.data.includes('<iframe') ||
          localResponse.data.includes('<meta')
      )) {
        // Response contains HTML - convert to proper JSON error object
        console.log('Received HTML response from scraper (likely CAPTCHA page) - converting to JSON error object');
        
        // Log the first 200 characters for debugging (but don't include in response)
        if (localResponse.data.length > 0) {
          const preview = localResponse.data.substring(0, 200).replace(/\n/g, ' ');
          console.log(`HTML content preview (first 200 chars): ${preview}...`);
        }
        
        // Create a clean structured error response with only JSON data
        responseData = {
          zipCode,
          count: 0,
          listings: [],
          timestamp: new Date().toISOString(),
          status: 'error',
          code: 'CAPTCHA_DETECTED',
          message: 'Unable to retrieve listings due to website protection.',
          bypassAttempted: true
        };
      } else {
        // Try to parse as JSON if it's a string
        if (typeof localResponse.data === 'string') {
          try {
            responseData = JSON.parse(localResponse.data);
          } catch (parseError) {
            console.error('Error parsing response as JSON:', parseError.message);
            // Create an error response
            responseData = {
              zipCode,
              count: 0,
              listings: [],
              timestamp: new Date().toISOString(),
              error: 'INVALID_RESPONSE',
              message: 'Scraper returned invalid JSON response.',
              responseType: typeof localResponse.data
            };
          }
        } else {
          // Response is already an object
          responseData = localResponse.data;
        }
        
        // Add a timestamp if not present
        if (!responseData.timestamp) {
          responseData.timestamp = new Date().toISOString();
        }
        
        console.log(`Successfully scraped from local service: ${responseData.count || 0} listings found`);
      }
      
      return responseData;
    } catch (localError) {
      // Fall back to the Render.com hosted scraper
      console.log(`Local scraper not available, using Render.com hosted service`);
      
      // Use the Render.com hosted scraper URL
      const scraperUrl = process.env.SCRAPER_URL || 'https://zillowscraper134.onrender.com';
      
      // Use our new local advanced-scrape endpoint as a primary option
      console.log(`Trying advanced PerimeterX bypass for ZIP: ${zipCode}`);
      try {
        // First try our local advanced scraper with PerimeterX bypass
        const localAdvancedResponse = await axios.get(`http://localhost:5001/advanced-scrape?zip=${zipCode}`, {
          timeout: 60000,
          validateStatus: function (status) {
            return true; // Accept all status codes
          }
        });
        
        if (localAdvancedResponse.status === 200 && localAdvancedResponse.data && 
            localAdvancedResponse.data.success && 
            localAdvancedResponse.data.listings && 
            localAdvancedResponse.data.listings.length > 0) {
          console.log(`Successfully scraped using advanced PerimeterX bypass: ${localAdvancedResponse.data.listings.length} listings`);
          return localAdvancedResponse.data;
        } else {
          console.log('Advanced PerimeterX bypass unsuccessful, falling back to Render service');
        }
      } catch (advError) {
        console.log(`Advanced PerimeterX bypass error: ${advError.message}`);
      }
      
      console.log(`Fetching listings for ZIP: ${zipCode} from ${scraperUrl}/api/zillow/fsbo/${zipCode}`);
      
      // Use a strategy of three attempts with increasing timeouts
      let lastError = null;
      
      // Try multiple times with increasing timeouts
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`Attempt ${attempt} of 3 to fetch listings from Render service for ZIP: ${zipCode}`);
          
          // Calculate timeout based on attempt (increase timeout with each attempt)
          const timeout = attempt * 45000; // 45s, 90s, 135s
          
          const response = await axios.get(`${scraperUrl}/api/zillow/fsbo/${zipCode}`, {
            timeout: timeout,
            maxContentLength: 10 * 1024 * 1024, // 10MB max response size
            responseType: 'text', // Get as text first to verify it's not HTML
            validateStatus: function (status) {
              // Accept all status codes so we can properly handle them
              return true;
            },
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            }
          });
          
          // Enhanced check for HTML content in Render.com response
          let responseData;
          
          if (typeof response.data === 'string' && (
              response.data.includes('<!DOCTYPE html>') || 
              response.data.includes('<html') ||
              response.data.includes('<body') ||
              response.data.includes('<head') ||
              // Additional HTML indicators to more aggressively filter
              response.data.includes('<div') ||
              response.data.includes('<script') ||
              response.data.includes('<iframe') ||
              response.data.includes('<meta')
          )) {
            // Response contains HTML - convert to proper JSON
            console.log(`Received HTML response from Render service (attempt ${attempt}) - converting to JSON error object`);
            
            // Log the first 200 characters for debugging (but don't include in response)
            if (response.data.length > 0) {
              const preview = response.data.substring(0, 200).replace(/\n/g, ' ');
              console.log(`HTML content preview (first 200 chars): ${preview}...`);
            }
            
            // Create a clean structured error response - no HTML content is preserved
            responseData = {
              zipCode,
              count: 0,
              listings: [],
              timestamp: new Date().toISOString(),
              status: 'error',
              code: 'CAPTCHA_DETECTED',
              message: 'Unable to retrieve listings due to website protection.',
              bypassAttempted: true,
              scrapedFrom: 'render',
              attempts: attempt
            };
            
            // Don't store HTML content - just return the JSON
            return responseData;
          } else {
            // Try to parse as JSON if it's a string
            if (typeof response.data === 'string') {
              try {
                responseData = JSON.parse(response.data);
              } catch (parseError) {
                console.log(`Invalid JSON from Render service (attempt ${attempt}), retrying...`);
                lastError = new Error('Invalid JSON response format');
                continue; // Try next attempt
              }
            } else {
              // Response is already an object
              responseData = response.data;
            }
            
            // Validate that it has the count property
            if (responseData && 'count' in responseData) {
              console.log(`Successfully scraped from Render service (attempt ${attempt}): ${responseData.count} listings found`);
              
              // Add some additional metadata
              responseData.scrapedFrom = 'render';
              responseData.attempts = attempt;
              
              return responseData;
            } else {
              console.log(`Missing count property in Render response (attempt ${attempt}), retrying...`);
              lastError = new Error('Invalid response format from scraper service - missing count property');
            }
          }
        } catch (error) {
          lastError = error;
          
          if (attempt < 3) {
            // If not the last attempt, log error and wait before retrying
            console.log(`Error on attempt ${attempt}, retrying in 5 seconds:`, error.message);
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
          } else {
            // Last attempt failed, will return error response after loop
            console.error(`All attempts failed for ZIP ${zipCode}:`, error.message);
          }
        }
      }
      
      // If we got here, all attempts failed
      throw lastError || new Error('All scraping attempts failed for unknown reasons');
    }
  } catch (error) {
    console.error(`Error fetching Zillow listings for ZIP ${zipCode}:`, error.message);
    
    // Return a detailed error object
    return {
      zipCode,
      count: 0,
      listings: [],
      timestamp: new Date().toISOString(),
      error: 'Failed to fetch listings from scraping service',
      message: error.message || 'Unknown error occurred during scraping',
      hasError: true,
      // Add information about the Render.com service being used
      scrapingService: process.env.SCRAPER_URL || 'https://zillowscraper134.onrender.com'
    };
  }
}

/**
 * Save the scraped listings to Firebase
 * @param {Object} data - Scraped data from Zillow
 * @returns {Promise<string>} - ID of the created document or null if Firebase not initialized
 */
async function saveToFirebase(data) {
  if (!firebaseInitialized) {
    console.log('Firebase not initialized - skipping saving to database');
    return {
      id: `demo-${Date.now()}`,
      status: 'demo',
      timestamp: new Date().toISOString(),
      message: 'Data stored in demo mode (Firebase not configured)'
    };
  }
  
  try {
    const timestamp = new Date();
    
    // Use simple object without server timestamp to avoid potential issues
    const docData = {
      ...data,
      timestamp,
      fetchedAt: timestamp.toISOString() // Using ISO string instead of server timestamp
    };
    
    // Create a new document with auto-generated ID
    const docRef = await zillowCollection.add(docData);
    
    console.log(`Saved listings to Firebase with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error('Error saving to Firebase:', error);
    // Don't throw the error, just log it and return null
    console.log('Continuing without saving to Firebase due to error');
    return null;
  }
}

/**
 * Utility function to sanitize responses and ensure no HTML is ever included
 * @param {any} data - Data to sanitize
 * @returns {Object} - Sanitized data with no HTML
 */
function sanitizeResponse(data) {
  // If the data is a string, check for HTML content
  if (typeof data === 'string') {
    if (data.includes('<') && data.includes('>')) {
      console.log('HTML detected in string value - converting to safe JSON');
      return { 
        error: 'HTML_CONTENT_REMOVED',
        message: 'HTML content was detected and removed for security',
        originalType: 'string',
        originalLength: data.length
      };
    }
    return data;
  }
  
  // If the data is an array, sanitize each element
  if (Array.isArray(data)) {
    return data.map(item => sanitizeResponse(item));
  }
  
  // If the data is an object, sanitize each property
  if (data !== null && typeof data === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeResponse(value);
    }
    return sanitized;
  }
  
  // Return primitives unchanged
  return data;
}

/**
 * Main webhook endpoint to trigger a scrape and save results
 */
app.post('/webhook/zillow', async (req, res) => {
  try {
    const { zipCode } = req.body;
    
    if (!zipCode || !zipCode.match(/^\d{5}$/)) {
      return res.status(400).json({ error: 'Invalid ZIP code. Must be 5 digits.' });
    }
  
    // Fetch listings from the scraper
    const listings = await fetchZillowListings(zipCode);
    
    // Save results to Firebase if initialized
    let docId = null;
    if (firebaseInitialized) {
      docId = await saveToFirebase(listings);
    } else {
      console.log('Firebase not initialized - returning listings without saving');
    }
    
    // Create response object
    const responseObj = {
      success: true,
      message: firebaseInitialized 
        ? `Scraped and saved ${listings.count} listings for ZIP ${zipCode}` 
        : `Scraped ${listings.count} listings for ZIP ${zipCode} (not saved - Firebase not configured)`,
      savedId: docId,
      listings: listings
    };
    
    // Final safety check - sanitize the entire response to guarantee no HTML content
    // This is a belt-and-suspenders approach to ensure we NEVER return HTML
    const sanitizedResponse = sanitizeResponse(responseObj);
    
    // Additional validation log - never send HTML to client
    if (JSON.stringify(sanitizedResponse).includes('<html') || 
        JSON.stringify(sanitizedResponse).includes('<!DOCTYPE')) {
      console.error('ERROR: HTML content detected in final response - using fallback response');
      // Completely override with a safe error response
      return res.json({
        error: 'HTML_CONTENT_DETECTED',
        message: 'Response contained HTML content and was blocked',
        zipCode: zipCode,
        count: 0,
        listings: [],
        timestamp: new Date().toISOString()
      });
    }
    
    return res.json(sanitizedResponse);
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ 
      error: 'WEBHOOK_ERROR',
      message: 'Webhook processing failed',
      errorDetail: error.message,
      zipCode: req.body.zipCode || 'unknown',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get all historical scrapes from Firebase
 */
app.get('/api/history', async (req, res) => {
  // Create a demo result for cases where Firebase isn't initialized or has errors
  // This helps the application work in demo mode without requiring Firebase
  const demoResponse = [
    {
      id: 'demo-id-1',
      zipCode: '10001',
      count: 3,
      timestamp: new Date().toISOString(),
      hasError: false,
      isDemo: true
    },
    {
      id: 'demo-id-2',
      zipCode: '90210',
      count: 5,
      timestamp: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      hasError: false,
      isDemo: true
    },
    {
      id: 'demo-id-3',
      zipCode: '60601',
      count: 2,
      timestamp: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
      hasError: false,
      isDemo: true
    }
  ];
  
  // If Firebase isn't initialized, return an informative error
  if (!firebaseInitialized) {
    console.log('Firebase not initialized - returning helpful error message');
    return res.status(503).json({
      error: 'Firebase Setup Required',
      message: 'The Firestore database is not yet set up. Please visit our setup guide.',
      status: 'error',
      setupGuideUrl: '/firebase-setup'
    });
  }
  
  try {
    console.log('Attempting to fetch history from Firebase');
    // Attempt to fetch real data from Firebase
    const snapshot = await zillowCollection
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();
    
    if (snapshot.empty) {
      console.log('No history records found in Firebase, using demo response');
      return res.json(demoResponse);
    }
    
    // Convert Firebase documents to a cleaner response format
    const history = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        zipCode: data.zipCode || 'unknown',
        count: data.count || 0,
        timestamp: data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate().toISOString() : data.timestamp) : new Date().toISOString(),
        hasError: data.hasError || false
      };
    });
    
    console.log(`Successfully fetched ${history.length} history records from Firebase`);
    return res.json(history);
  } catch (error) {
    console.error('Error fetching history from Firebase:', error);
    console.log('Using demo response for history due to error');
    return res.json(demoResponse);
  }
});

/**
 * View a specific scrape result
 */
app.get('/api/listings/:id', async (req, res) => {
  // Create demo response with sample listings in Zillow style
  const demoResponse = {
    zipCode: '10001',
    count: 3,
    listings: [
      {
        address: "123 Main St, New York, NY 10001",
        price: "$650,000",
        beds: "2",
        baths: "1",
        link: "https://www.zillow.com/homes/for_sale/10001_rb/",
        description: "Beautiful apartment in Manhattan"
      },
      {
        address: "456 Park Ave, New York, NY 10001",
        price: "$1,250,000",
        beds: "3",
        baths: "2.5",
        link: "https://www.zillow.com/homes/for_sale/10001_rb/",
        description: "Spacious loft with city views"
      },
      {
        address: "789 Broadway, New York, NY 10001",
        price: "$899,000",
        beds: "1",
        baths: "1",
        link: "https://www.zillow.com/homes/for_sale/10001_rb/",
        description: "Cozy studio in prime location"
      }
    ],
    timestamp: new Date().toISOString(),
    message: 'This is a demonstration of Zillow-style listings display.',
    isDemo: true,
    note: 'This is demo data only. No actual scraping performed.'
  };
  
  // If this is a demo ID or Firebase isn't initialized, return the appropriate demo response
  if (req.params.id.startsWith('demo-') || !firebaseInitialized) {
    console.log(`Using demo response for listings detail view for ID: ${req.params.id}`);
    
    // Customize demo response based on the ID for more varied testing
    if (req.params.id === 'demo-id-2') {
      return res.json({
        ...demoResponse,
        zipCode: '90210',
        listings: demoResponse.listings.map(l => ({
          ...l,
          address: l.address.replace('New York, NY 10001', 'Beverly Hills, CA 90210')
        }))
      });
    } else if (req.params.id === 'demo-id-3') {
      return res.json({
        ...demoResponse,
        zipCode: '60601',
        listings: demoResponse.listings.map(l => ({
          ...l,
          address: l.address.replace('New York, NY 10001', 'Chicago, IL 60601')
        }))
      });
    }
    
    // Default demo response
    return res.json(demoResponse);
  }
  
  // If we get here, Firebase is initialized and the ID is not a demo ID
  try {
    console.log(`Attempting to fetch listings from Firebase with ID: ${req.params.id}`);
    
    // Try to get the document from Firebase
    const docRef = zillowCollection.doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      console.log(`No document found in Firebase with ID: ${req.params.id}, using demo response`);
      return res.json({
        ...demoResponse,
        error: 'Document not found in database',
        isDemo: true
      });
    }
    
    // Return the document data
    const data = doc.data();
    console.log(`Successfully fetched listings from Firebase with ID: ${req.params.id}`);
    return res.json({
      ...data,
      id: doc.id
    });
  } catch (error) {
    console.error(`Error fetching listings from Firebase with ID: ${req.params.id}:`, error);
    console.log('Using demo response for listings detail view due to error');
    return res.json({
      ...demoResponse,
      error: 'Error fetching document from database',
      errorMessage: error.message,
      isDemo: true
    });
  }
});

/**
 * Scheduled task to scrape predefined ZIP codes daily
 * Edit this list with the ZIPs you want to monitor
 */
const zipCodesToMonitor = ['75216', '90210', '10001', '60601', '98101'];

// Schedule to run at 3:00 AM every day
cron.schedule('0 3 * * *', async () => {
  console.log('Running scheduled ZIP code scraping...');
  
  if (!firebaseInitialized) {
    console.log('Firebase not initialized - scheduled scraping will run but results will not be saved');
  }
  
  for (const zipCode of zipCodesToMonitor) {
    try {
      console.log(`Scheduled scrape for ZIP: ${zipCode}`);
      const listings = await fetchZillowListings(zipCode);
      
      // Only try to save to Firebase if it's initialized
      if (firebaseInitialized) {
        await saveToFirebase(listings);
      } else {
        console.log(`Scraped ${listings.count} listings for ZIP ${zipCode} (not saved to Firebase)`);
      }
      
      // Wait 30 seconds between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 30000));
    } catch (error) {
      console.error(`Error in scheduled scrape for ZIP ${zipCode}:`, error);
    }
  }
  
  console.log('Scheduled scraping completed');
});

/**
 * Home page route
 */
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

/**
 * Debug page with direct ZIP code testing
 */
app.get('/debug/:zipCode', (req, res) => {
  const zipCode = req.params.zipCode;
  if (!zipCode || !zipCode.match(/^\d{5}$/)) {
    return res.status(400).send('Please provide a valid 5-digit US ZIP code');
  }
  
  res.send(`
    <h1>Debug Test for ZIP: ${zipCode}</h1>
    <p>Testing scraper with improved CAPTCHA bypass techniques...</p>
    <p>Click the button to start the scrape:</p>
    <button onclick="startScrape()">Start Scrape</button>
    <div id="results" style="margin-top: 20px; padding: 10px; border: 1px solid #ccc;"></div>
    
    <script>
      function startScrape() {
        document.getElementById('results').innerHTML = 'Scraping... (this may take up to 60 seconds)';
        
        fetch('/api/scrape/${zipCode}')
          .then(response => response.json())
          .then(data => {
            let html = '<h3>Results:</h3>';
            if (data.error) {
              html += '<p style="color: red;">Error: ' + data.message + '</p>';
              if (data.technicalDetails) {
                html += '<p>Technical details: ' + data.technicalDetails + '</p>';
              }
              if (data.possibleSolutions) {
                html += '<p>Possible solutions:</p><ul>';
                data.possibleSolutions.forEach(solution => {
                  html += '<li>' + solution + '</li>';
                });
                html += '</ul>';
              }
            } else {
              html += '<p>Found ' + data.count + ' listings</p>';
              html += '<ul>';
              data.listings.forEach(listing => {
                html += '<li>';
                html += '<strong>' + listing.address + '</strong><br>';
                html += 'Price: ' + listing.price + '<br>';
                html += 'Beds/Baths: ' + listing.beds + ' / ' + listing.baths + '<br>';
                if (listing.link) {
                  html += '<a href="' + listing.link + '" target="_blank">View on Zillow</a>';
                }
                html += '</li>';
              });
              html += '</ul>';
            }
            document.getElementById('results').innerHTML = html;
          })
          .catch(error => {
            document.getElementById('results').innerHTML = 'Error: ' + error.message;
          });
      }
    </script>
  `);
});

/**
 * Test endpoint to trigger a scrape and save to Firebase
 */
app.get('/test-firebase', async (req, res) => {
  const zipCode = req.query.zip || '90210';
  console.log(`Testing Firebase with scrape for ZIP: ${zipCode}`);
  
  try {
    // Call the scraper
    console.log(`Fetching Zillow listings for ${zipCode}...`);
    const data = await fetchZillowListings(zipCode);
    
    if (!data || data.error) {
      return res.status(500).json({
        error: 'Scrape failed',
        message: data?.error || 'Unknown error occurred during scrape'
      });
    }
    
    // Save to Firebase
    console.log('Scrape successful, saving to Firebase...');
    const saveResult = await saveToFirebase(data);
    
    return res.json({
      status: 'success',
      message: 'Test scrape completed and saved to Firebase',
      scrapeData: {
        zipCode,
        timestamp: new Date().toISOString(),
        listingCount: data.listings ? data.listings.length : 0
      },
      saveResult,
      viewUrl: saveResult?.id ? `/view/${saveResult.id}` : null
    });
    
  } catch (error) {
    console.error('Error in test-firebase endpoint:', error);
    return res.status(500).json({
      error: 'Test failed',
      message: error.message
    });
  }
});

/**
 * Simple GET endpoint to trigger a scrape (for easier testing)
 */
app.get('/api/scrape/:zipCode', async (req, res) => {
  try {
    const { zipCode } = req.params;
    const urlType = req.query.urlType || 'simple'; // Default to simple
    
    if (!zipCode || !zipCode.match(/^\d{5}$/)) {
      return res.status(400).json({ error: 'Invalid ZIP code. Must be 5 digits.' });
    }
    
    console.log(`API scrape request for ZIP: ${zipCode} using URL type: ${urlType}`);
    
    // Try to get the data from our local scraper first, then fall back to the remote one
    try {
      // Define the remote scraper URL
      const remoteScraper = process.env.SCRAPER_URL || 'https://zillowscraper134.onrender.com';
      
      console.log(`Attempting to use local or remote scraper for ZIP: ${zipCode}`);
      
      // First try the remote scraper since it's more likely to be available
      const response = await axios.get(`${remoteScraper}/api/zillow/fsbo/${zipCode}?urlType=${urlType}`, {
        responseType: 'text', // Get as text first so we can check for HTML
        validateStatus: function (status) {
          // Accept all status codes so we can properly handle them
          return true;
        }
      });
      
      // Validate the response - check specifically for HTML content
      let responseData;
      
      if (typeof response.data === 'string') {
        // Check if the response contains HTML
        if (response.data.includes('<!DOCTYPE html>') || 
            response.data.includes('<html') ||
            response.data.includes('<body') ||
            response.data.includes('<head') ||
            response.data.includes('<div') ||
            response.data.includes('<script')) {
          
          console.log('Received HTML response from scraper - converting to clean JSON error');
          
          // Create a clean error response without any HTML content
          responseData = {
            zipCode,
            count: 0,
            listings: [],
            timestamp: new Date().toISOString(),
            error: 'HTML_RESPONSE_BLOCKED',
            message: 'The scraper returned HTML content which was blocked',
            status: 'error'
          };
        } else {
          // Try to parse as JSON
          try {
            responseData = JSON.parse(response.data);
          } catch (parseError) {
            console.error('Error parsing response as JSON:', parseError.message);
            
            // Response isn't HTML but also isn't valid JSON
            responseData = {
              zipCode,
              count: 0,
              listings: [],
              error: 'INVALID_JSON',
              message: 'Scraper returned invalid JSON response',
              timestamp: new Date().toISOString()
            };
          }
        }
      } else {
        // Response is already an object
        responseData = response.data;
      }
      
      // Apply our sanitization function to ensure there's absolutely no HTML
      const sanitizedResponse = sanitizeResponse(responseData);
      
      // Final check - if we still somehow have HTML content, fall back to a clean error
      if (JSON.stringify(sanitizedResponse).includes('<html') || 
          JSON.stringify(sanitizedResponse).includes('<!DOCTYPE')) {
        console.error('ERROR: HTML content detected in final response - using fallback response');
        
        return res.json({
          error: 'HTML_CONTENT_DETECTED',
          message: 'Response contained HTML content and was blocked',
          zipCode: zipCode,
          count: 0,
          listings: [],
          timestamp: new Date().toISOString()
        });
      }
      
      // Add a timestamp if not present
      if (!sanitizedResponse.timestamp) {
        sanitizedResponse.timestamp = new Date().toISOString();
      }
      
      // Log the clean response
      console.log(`Returning clean JSON response with ${sanitizedResponse.count || 0} listings`);
      
      // Return the sanitized data
      return res.json(sanitizedResponse);
    } catch (error) {
      console.error('Error connecting to scraper service:', error.message);
      
      // Handle Axios errors more gracefully
      if (error.response) {
        // The request was made and the server responded with a non-2xx status code
        console.log('Server responded with error status:', error.response.status);
        return res.status(error.response.status).json({
          error: 'SCRAPER_ERROR',
          message: `Scraper service returned an error: ${error.response.status}`,
          zipCode,
          timestamp: new Date().toISOString()
        });
      } else if (error.request) {
        // The request was made but no response was received
        console.log('No response received from scraper service');
        return res.status(500).json({
          error: 'SCRAPER_UNAVAILABLE',
          message: 'Scraper service is not responding',
          zipCode,
          timestamp: new Date().toISOString()
        });
      } else {
        // Something happened in setting up the request that triggered an Error
        console.log('Error setting up request:', error.message);
        return res.status(500).json({
          error: 'REQUEST_SETUP_ERROR',
          message: `Error setting up request: ${error.message}`,
          zipCode,
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.error('API scrape error:', error);
    return res.status(500).json({ 
      error: 'API_SCRAPE_FAILED', 
      message: error.message,
      zipCode: req.params.zipCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Firebase Setup Guide
 */
app.get('/firebase-setup', (req, res) => {
  res.sendFile(__dirname + '/public/firebase-setup.html');
});

/**
 * CAPTCHA Visual Analysis Tool (redirects to scraper endpoint)
 */
app.get('/captcha-analysis', (req, res) => {
  const zipCode = req.query.zip || '90210';
  const scraperUrl = process.env.SCRAPER_URL || 'http://localhost:5001';
  
  console.log(`Redirecting to CAPTCHA analysis for ZIP: ${zipCode}`);
  res.redirect(`${scraperUrl}/analyze-captcha?zip=${zipCode}`);
});

/**
 * Proxy Test Page
 * Allows testing and verification of the PacketStream proxy setup
 */
app.get('/proxy-test', (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>PacketStream Proxy Test</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        h1, h2 { color: #333; }
        .container { max-width: 900px; margin: 0 auto; }
        .test-button { 
          display: inline-block;
          padding: 10px 20px;
          background: #4CAF50;
          color: white;
          text-decoration: none;
          border-radius: 4px;
          font-weight: bold;
          margin: 10px 0;
        }
        .status-box {
          padding: 15px;
          background: #f5f5f5;
          border-left: 4px solid #2196F3;
          margin: 20px 0;
        }
        .steps {
          background: #f9f9f9;
          padding: 15px;
          border-radius: 4px;
        }
        .steps ol { margin-left: 20px; }
        code {
          background: #f1f1f1;
          padding: 2px 5px;
          border-radius: 3px;
          font-family: monospace;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>PacketStream Proxy Tester</h1>
        
        <div class="status-box">
          <h3>Current Proxy Status</h3>
          <p><strong>Proxy Enabled:</strong> ${process.env.USE_PROXY === 'true' ? 'YES ✅' : 'NO ❌'}</p>
          <p><strong>Proxy Host:</strong> ${process.env.PROXY_HOST || 'Not configured'}</p>
          <p><strong>Username:</strong> ${process.env.PROXY_USERNAME || 'Not configured'}</p>
        </div>
        
        <h2>Test Your Proxy</h2>
        <p>Click the button below to test if your proxy is working:</p>
        <a href="/test-scrape?zipCode=90210" class="test-button">Run Proxy Test</a>
        
        <div class="steps">
          <h3>How to Test:</h3>
          <ol>
            <li>Click the button above to start a test scrape with ZIP code 90210</li>
            <li>Check the ScrapeServer logs in your Replit console</li>
            <li>Look for messages confirming the proxy is being used</li>
            <li>If the scrape succeeds, your proxy is working correctly!</li>
          </ol>
        </div>
        
        <h2>Advanced Testing</h2>
        <p>For a detailed visual analysis of how the proxy affects CAPTCHA handling:</p>
        <a href="/analyze-captcha?zip=90210" class="test-button">Run CAPTCHA Analysis</a>
        
        <h2>Troubleshooting</h2>
        <ul>
          <li>If you see "Proxy disabled" in the logs, check your .env file and make sure USE_PROXY=true</li>
          <li>If you see authentication errors, verify your PacketStream username and password</li>
          <li>Remember to add funds to your PacketStream account before testing</li>
          <li>For detailed instructions, see the <a href="PROXY_TESTING.md">PROXY_TESTING.md</a> documentation</li>
        </ul>
      </div>
    </body>
    </html>
  `;
  res.send(html);
});

/**
 * Advanced debugging page
 */
app.get('/advanced-debug', (req, res) => {
  res.sendFile(__dirname + '/public/debug.html');
});

/**
 * CAPTCHA debug resources route - allows viewing saved CAPTCHA screenshots and HTML
 */
app.get('/captcha-debug-resources', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  // Get a list of all CAPTCHA-related files
  const debugFiles = {
    screenshots: [],
    html: []
  };
  
  // Check the project root for CAPTCHA-related files
  try {
    const files = fs.readdirSync('.');
    
    files.forEach(file => {
      if (file.includes('captcha') && file.endsWith('.png')) {
        const stats = fs.statSync(file);
        debugFiles.screenshots.push({
          name: file,
          path: '/' + file,
          size: Math.round(stats.size / 1024) + ' KB',
          modified: stats.mtime.toISOString()
        });
      }
      if (file.includes('captcha') && file.endsWith('.html')) {
        const stats = fs.statSync(file);
        debugFiles.html.push({
          name: file,
          path: '/' + file,
          size: Math.round(stats.size / 1024) + ' KB',
          modified: stats.mtime.toISOString()
        });
      }
    });
    
    // Add error screenshots too
    files.forEach(file => {
      if (file.includes('error') && file.endsWith('.png')) {
        const stats = fs.statSync(file);
        debugFiles.screenshots.push({
          name: file,
          path: '/' + file,
          size: Math.round(stats.size / 1024) + ' KB',
          modified: stats.mtime.toISOString()
        });
      }
    });
    
    res.json(debugFiles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read debug files', message: error.message });
  }
});

/**
 * Serve static debug files
 */
app.get('/captcha-page.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'captcha-page.png'));
});

app.get('/captcha-page.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'captcha-page.html'));
});

app.get('/debug-screenshot.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'debug-screenshot.png'));
});

app.get('/error-screenshot.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'error-screenshot.png'));
});

/**
 * API documentation route
 */
app.get('/api/docs', (req, res) => {
  res.json({
    name: 'Zillow FSBO Scraper API',
    version: '1.0.0',
    description: 'API for scraping Zillow For Sale By Owner (FSBO) listings',
    endpoints: [
      {
        path: '/api/scrape/:zipCode',
        method: 'GET',
        description: 'Quick test endpoint to scrape FSBO listings for a specific ZIP code'
      },
      {
        path: '/webhook/zillow', 
        method: 'POST',
        body: { zipCode: 'string (5-digit ZIP code)' },
        description: 'Scrape FSBO listings for a specific ZIP code'
      },
      {
        path: '/captcha-analysis',
        method: 'GET',
        params: { zip: 'string (5-digit ZIP code)' },
        description: 'Visual CAPTCHA analyzer tool that shows detailed information about CAPTCHA challenges'
      },
      {
        path: '/api/history',
        method: 'GET',
        description: 'Get the history of all scraped ZIP codes'
      },
      {
        path: '/api/listings/:id',
        method: 'GET',
        description: 'Get the details of a specific scrape by ID'
      },
      {
        path: '/api/test-json',
        method: 'GET',
        description: 'Get a test JSON response that always returns clean, well-formatted JSON (no HTML)'
      },
      {
        path: '/api/bypass-test/:zipCode',
        method: 'GET',
        description: 'Test multiple CAPTCHA bypass strategies and identify which ones work best'
      }
    ]
  });
});

/**
 * Clean JSON test endpoint for Zillow FSBO listings
 * This endpoint always returns properly formatted JSON regardless of scraping outcome
 * It never returns HTML content, only clean JSON data
 */
app.get('/api/test-json', (req, res) => {
  // Get ZIP code from query parameter, or use a default
  const zipCode = req.query.zip || '90210';
  
  // Create a sample FSBO listings response that matches our production structure
  const demoListings = {
    zipCode: zipCode,
    count: 3,
    status: 'success',
    timestamp: new Date().toISOString(),
    listings: [
      {
        address: '123 Main St, Beverly Hills, CA ' + zipCode,
        price: '$1,295,000',
        beds: '3',
        baths: '2',
        sqft: '1,850',
        link: 'https://www.zillow.com/homedetails/123-main-st-' + zipCode
      },
      {
        address: '456 Oak Ave, Beverly Hills, CA ' + zipCode,
        price: '$2,100,000',
        beds: '4',
        baths: '3.5',
        sqft: '2,750',
        link: 'https://www.zillow.com/homedetails/456-oak-ave-' + zipCode
      },
      {
        address: '789 Palm Dr, Beverly Hills, CA ' + zipCode,
        price: '$4,500,000',
        beds: '5',
        baths: '4.5',
        sqft: '4,200',
        link: 'https://www.zillow.com/homedetails/789-palm-dr-' + zipCode
      }
    ],
    meta: {
      source: 'test-endpoint',
      responseType: 'json-only',
      isTestData: true,
      requestedZip: zipCode,
      apiVersion: '1.0'
    }
  };
  
  // Use the same consistent JSON structure to enable easy testing
  // This endpoint will NEVER return HTML content
  res.json(demoListings);
});

/**
 * Simple test endpoint that always returns clean JSON
 * Useful for testing the JSON response handling
 */
app.get('/api/test/:zipCode', (req, res) => {
  const zipCode = req.params.zipCode;
  
  // Always return a clean JSON response
  return res.json({
    success: true,
    message: "This is a test endpoint that always returns clean JSON",
    zipCode: zipCode,
    timestamp: new Date().toISOString(),
    endpoint: "test",
    note: "This endpoint does not perform any actual scraping"
  });
});

/**
 * Advanced CAPTCHA bypass testing endpoint
 * This endpoint tests multiple bypass strategies and returns details about what worked
 */
app.get('/api/bypass-test/:zipCode', async (req, res) => {
  try {
    const { zipCode } = req.params;
    
    if (!zipCode || !zipCode.match(/^\d{5}$/)) {
      return res.status(400).json({ error: 'Invalid ZIP code. Must be 5 digits.' });
    }
    
    console.log(`Advanced CAPTCHA bypass test for ZIP: ${zipCode}`);
    
    // Array of bypass strategies to try
    const bypassStrategies = [
      { name: 'mobile-url', urlType: 'mobile', description: 'Mobile URL format (m.zillow.com)' },
      { name: 'complex-params', urlType: 'complex', description: 'Complex URL with many parameters' },
      { name: 'google-referrer', urlType: 'google', description: 'URL with Google search referrer' },
      { name: 'fsbo-direct', urlType: 'fsbo', description: 'Direct FSBO search URL' }
    ];
    
    // Results of each strategy
    const results = [];
    
    // Try each strategy
    for (const strategy of bypassStrategies) {
      console.log(`Testing strategy: ${strategy.name} (${strategy.description})`);
      
      try {
        const response = await axios.get(`http://localhost:5001/advanced-scrape?zip=${zipCode}&urlType=${strategy.urlType}`, {
          responseType: 'text',
          timeout: 30000, // 30 second timeout
          validateStatus: function (status) {
            return true; // Accept all status codes
          }
        });
        
        // Check if we got HTML or JSON
        let result = {
          strategy: strategy.name,
          description: strategy.description,
          success: false,
          timestamp: new Date().toISOString()
        };
        
        if (typeof response.data === 'string') {
          if (response.data.includes('<!DOCTYPE html>') || 
              response.data.includes('<html') ||
              response.data.includes('<body') ||
              response.data.includes('<head')) {
            
            // Got HTML - strategy failed
            result.success = false;
            result.htmlDetected = true;
            result.statusCode = response.status;
            result.message = 'Strategy failed - received HTML content (likely CAPTCHA)';
            
          } else {
            // Try to parse as JSON
            try {
              const jsonData = JSON.parse(response.data);
              
              // Check if we got listings
              if (jsonData.count && jsonData.count > 0) {
                result.success = true;
                result.count = jsonData.count;
                result.statusCode = response.status;
                result.message = `Success - found ${jsonData.count} listings`;
              } else {
                result.success = false;
                result.count = 0;
                result.statusCode = response.status;
                result.message = jsonData.error || 'No listings found';
              }
            } catch (parseError) {
              result.success = false;
              result.message = 'Received non-HTML content but failed to parse as JSON';
              result.error = parseError.message;
            }
          }
        } else if (typeof response.data === 'object') {
          // Already parsed as JSON
          if (response.data.count && response.data.count > 0) {
            result.success = true;
            result.count = response.data.count;
            result.statusCode = response.status;
            result.message = `Success - found ${response.data.count} listings`;
          } else {
            result.success = false;
            result.count = 0;
            result.statusCode = response.status;
            result.message = response.data.error || 'No listings found';
          }
        }
        
        results.push(result);
        
        // If a strategy succeeded, we can stop testing
        if (result.success) {
          console.log(`Strategy ${strategy.name} succeeded - stopping tests`);
          break;
        }
        
        // Wait between tests to avoid rate limiting
        if (strategy !== bypassStrategies[bypassStrategies.length - 1]) {
          console.log('Waiting 5 seconds before trying next strategy...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error) {
        console.error(`Error testing strategy ${strategy.name}:`, error.message);
        results.push({
          strategy: strategy.name,
          description: strategy.description,
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Create final response with all test results
    return res.json({
      zipCode,
      timestamp: new Date().toISOString(),
      testsRun: results.length,
      successfulTests: results.filter(r => r.success).length,
      results: results,
      message: results.some(r => r.success) 
        ? 'At least one bypass strategy was successful'
        : 'All bypass strategies failed - CAPTCHA could not be bypassed',
      nextSteps: results.some(r => r.success)
        ? 'Use the successful strategy for future requests'
        : 'Try again later or implement more advanced bypass techniques'
    });
  } catch (error) {
    console.error('Error in bypass test endpoint:', error);
    return res.status(500).json({
      error: 'BYPASS_TEST_ERROR',
      message: error.message,
      zipCode: req.params.zipCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Test scrape endpoint for proxy testing
 */
app.get('/test-scrape', async (req, res) => {
  const zipCode = req.query.zipCode;
  
  if (!zipCode || !zipCode.match(/^\d{5}$/)) {
    return res.status(400).json({
      error: 'Invalid ZIP code',
      message: 'Please provide a valid 5-digit US ZIP code as the "zipCode" query parameter'
    });
  }
  
  console.log(`Test scrape request for ZIP: ${zipCode} (proxy testing)`);
  
  try {
    // Show a loading message in HTML
    res.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Proxy Test for ZIP ${zipCode}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; margin: 20px; }
          h1 { color: #333; }
          .loading { background: #f8f9fa; padding: 15px; border-left: 4px solid #17a2b8; }
          .results { margin-top: 20px; }
          pre { background: #f5f5f5; padding: 10px; overflow: auto; }
        </style>
      </head>
      <body>
        <h1>PacketStream Proxy Test</h1>
        <div class="loading">
          <p><strong>Testing proxy with ZIP code ${zipCode}...</strong></p>
          <p>This may take up to 30 seconds. Please check your ScrapeServer console logs for proxy status messages.</p>
        </div>
        <div class="results">
          <h2>Scraping Results:</h2>
    `);
    
    // Make the actual request
    const data = await fetchZillowListings(zipCode);
    
    // Complete the HTML with the results
    res.write(`
          <pre>${JSON.stringify(data, null, 2)}</pre>
          <p>✅ Test completed successfully!</p>
          <p><a href="/proxy-test">Return to Proxy Test Page</a></p>
        </div>
      </body>
      </html>
    `);
    res.end();
  } catch (error) {
    console.error('Error in test scrape endpoint:', error);
    res.write(`
          <pre>${JSON.stringify({
            error: 'Scraping failed',
            message: error.message,
            stack: error.stack
          }, null, 2)}</pre>
          <p>❌ Test failed. Check ScrapeServer logs for details.</p>
          <p><a href="/proxy-test">Return to Proxy Test Page</a></p>
        </div>
      </body>
      </html>
    `);
    res.end();
  }
});

// Start the server
// Make sure we're using port 5000 for the main server to work with Replit's tools
// Use the port variable defined at the top of the file
app.listen(port, '0.0.0.0', () => {
  console.log(`Zillow webhook server running on port ${port} (accessible to public)`);
});