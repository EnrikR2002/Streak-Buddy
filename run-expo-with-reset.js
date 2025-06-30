// run-expo-with-reset.js
// Runs Expo and always resets secrets on exit, even with Ctrl+C or errors.

const { spawn } = require('child_process');
const path = require('path');

const isWin = process.platform === 'win32';
const expoCmd = isWin ? 'cmd.exe' : 'npx';
const expoArgs = isWin
    ? ['/c', 'npx', 'expo', 'start', ...process.argv.slice(2)]
    : ['expo', 'start', ...process.argv.slice(2)];

const resetScript = path.join(__dirname, 'reset-appjson-secrets.js');

const expo = spawn(expoCmd, expoArgs, { stdio: 'inherit' });

function resetSecretsAndExit(code) {
    const reset = spawn(process.execPath, [resetScript], { stdio: 'inherit' });
    reset.on('close', () => process.exit(code));
}

expo.on('close', resetSecretsAndExit);

let exiting = false;

function handleSignal(signal) {
    if (exiting) return;
    exiting = true;
    expo.kill(signal);
}

process.on('SIGINT', () => {
    handleSignal('SIGINT');
});

process.on('SIGTERM', () => {
    handleSignal('SIGTERM');
});
process.on('uncaughtException', (err) => {
    console.error(err);
    resetSecretsAndExit(1);
});
