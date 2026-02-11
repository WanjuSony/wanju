const fs = require('fs');
const path = require('path');

console.log("Current CWD:", process.cwd());
const envPath = path.resolve(process.cwd(), '.env.local');
console.log("Expected .env.local:", envPath);

let key = process.env.GOOGLE_API_KEY;

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/^GOOGLE_API_KEY=(.*)$/m);
    if (match) {
        key = match[1].trim();
        console.log("Found key in .env.local!");
    } else {
        console.log("Key not found in .env.local content.");
    }
} else {
    console.log(".env.local DOES NOT EXIST at path.");
}

console.log("Loaded Key:", key ? key.substring(0, 10) + "..." : "UNDEFINED");

if (key && key.startsWith("AIzaSyAmdJ")) {
    console.log("SUCCESS: Key matches the new one provided by user.");
} else {
    console.log("FAILURE: Key does not match.");
}
