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
    .filter(Boolean)
    .filter(line => !line.startsWith('#'))
    .reduce((acc, line) => {
        const [key, ...rest] = line.split('=');
        acc[key.trim()] = rest.join('=').trim();
        return acc;
    }, {});

const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
appJson.expo = appJson.expo || {};
appJson.expo.extra = appJson.expo.extra || {};

Object.keys(env).forEach(key => {
    appJson.expo.extra[key] = env[key];
});

fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
console.log('Injected .env secrets into app.json extra!');
