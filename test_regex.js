
const universalRegex = /^([^\d\n].+?)(?:\s+|:\s*|,\s*)[\(\[]?(\d{1,2}:\d{2}(?::\d{2})?)[\)\]]?\s*(?::|-)?\s*(.*)/;

const lines = [
    "나리 3:30예.네 감사합니다. 저희 회사는 지금 23 년도에",
    "준석 3:45M.My.",
    "나리 3:54연간 볼륨이 아직은 그렇게 크진 않아요."
];

lines.forEach(line => {
    const match = line.match(universalRegex);
    console.log(`Testing line: "${line}"`);
    if (match) {
        console.log("MATCHED!");
        console.log("Speaker:", match[1]);
        console.log("Time:", match[2]);
        console.log("Text:", match[3]);
    } else {
        console.log("FAILED to match.");
    }
    console.log("---");
});

// Proposed Fix Regex
// Trying to handle the case where text immediately follows time without space
const chatRegex = /^([^\d\n].+?)\s+(\d{1,2}:\d{2})(.*)/;

console.log("\nTesting Proposed Fix Regex:");
lines.forEach(line => {
    const match = line.match(chatRegex);
    console.log(`Testing line: "${line}"`);
    if (match) {
        console.log("MATCHED!");
        console.log("Speaker:", match[1]);
        console.log("Time:", match[2]);
        console.log("Text:", match[3]);
    } else {
        console.log("FAILED to match.");
    }
    console.log("---");
});
