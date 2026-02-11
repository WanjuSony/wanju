console.log("Checking API Key...");
if (process.env.GOOGLE_API_KEY) {
    console.log("API Key is present (First 4 chars): " + process.env.GOOGLE_API_KEY.substring(0, 4));
} else {
    console.error("API Key is MISSING in process.env");
}
