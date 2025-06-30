const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const appJsonPath = path.join(__dirname, 'app.json');

if (!fs.existsSync(envPath)) {
    console.error('.env file not found!');
    process.exit(1);
}

const env = fs.readFileSync(envPath, 'utf-8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .reduce((acc, line) => {
        const equalIndex = line.indexOf('=');
        if (equalIndex === -1) {
            console.warn(`Skipping malformed line: ${line}`);
            return acc;
        }
        const key = line.substring(0, equalIndex).trim();
        const value = line.substring(equalIndex + 1).trim();
        if (key) {
            acc[key] = value;
        }
        return acc;
    }, {});
try {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
    appJson.expo = appJson.expo || {};
    appJson.expo.extra = appJson.expo.extra || {};

    Object.keys(env).forEach(key => {
        appJson.expo.extra[key] = env[key];
    });

    fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
    console.log('Injected .env secrets into app.json extra!');
} catch (error) {
    console.error('Failed to inject environment variables:', error.message);
    process.exit(1);
}