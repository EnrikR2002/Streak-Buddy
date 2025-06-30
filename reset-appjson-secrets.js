const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, 'app.json');

const placeholderSecrets = {
    FIREBASE_API_KEY: 'YOUR_API_KEY',
    FIREBASE_AUTH_DOMAIN: 'YOUR_AUTH_DOMAIN',
    FIREBASE_PROJECT_ID: 'YOUR_PROJECT_ID',
    FIREBASE_STORAGE_BUCKET: 'YOUR_STORAGE_BUCKET',
    FIREBASE_MESSAGING_SENDER_ID: 'YOUR_MESSAGING_SENDER_ID',
    FIREBASE_APP_ID: 'YOUR_APP_ID',
    FIREBASE_MEASUREMENT_ID: 'YOUR_MEASUREMENT_ID'
};

try {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
    appJson.expo = appJson.expo || {};
    appJson.expo.extra = { ...placeholderSecrets };

    fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
    console.log('Reset app.json extra secrets to placeholders!');
} catch (error) {
    console.error('Failed to reset app.json secrets:', error.message);
    process.exit(1);
}