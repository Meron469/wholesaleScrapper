# Firebase Setup Guide

This guide will walk you through setting up a new Firebase project for your Zillow FSBO Scraper.

## Step 1: Create a New Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" 
3. Name your project (e.g., "zillow-scraper-app")
4. Accept the terms and continue
5. Disable Google Analytics if you don't need it
6. Click "Create project"

## Step 2: Set Up Firestore Database

1. Once your project is created, click on "Firestore Database" in the left sidebar
2. Click "Create database"
3. Start in production mode (recommended)
4. Choose a location close to you (us-east1, us-central1, etc.)
5. Click "Enable"

## Step 3: Generate Service Account Keys

1. In the Firebase console, click on the gear icon (⚙️) next to "Project Overview"
2. Select "Project settings"
3. Go to the "Service accounts" tab
4. Click "Generate new private key"
5. Save the JSON file - this contains your credentials

## Step 4: Update Your Environment Variables

Open the downloaded JSON file. It should look something like this:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "key-id-here",
  "private_key": "-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxx@your-project-id.iam.gserviceaccount.com",
  "client_id": "client-id-here",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxx%40your-project-id.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
}
```

Extract these values and update your `.env` file:

```
VITE_FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
```

Make sure to:
1. Copy the private key exactly as it appears, including all newlines (\n)
2. Keep the quotes around the private key

## Step 5: Restart Your Application

After updating the environment variables, restart your application:

```
npm run start
```

## Step 6: Update Your Render.com Deployment

If you're using Render.com, you'll need to update the environment variables there too:

1. Go to your Render dashboard
2. Select your service
3. Go to the "Environment" tab
4. Add the same three environment variables
5. Click "Save Changes"
6. Your service will automatically redeploy with the new environment variables

## Troubleshooting

If you encounter any issues with the Firebase connection:

1. Make sure the Firestore API is enabled in your Google Cloud Console
2. Check that the private key format is correct (including all newlines)
3. Verify that your service account has the necessary permissions
4. Try regenerating the service account key if needed