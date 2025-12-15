
// import fs from 'fs';
// import path from 'path';

// // Manual env loader
// function loadEnv() {
//     console.log("CWD:", process.cwd());
//     try {
//         const envPath = path.resolve(process.cwd(), '.env.local');
//         console.log("Checking .env at:", envPath);
//         if (!fs.existsSync(envPath)) {
//             console.error("File does not exist!");
//             return;
//         }
//         const envConfig = fs.readFileSync(envPath, 'utf8');
//         console.log("File read. Size:", envConfig.length);

//         envConfig.split('\n').forEach((line, idx) => {
//             const trimmedLine = line.trim();
//             if (!trimmedLine || trimmedLine.startsWith('#')) return;

//             const eqIdx = trimmedLine.indexOf('=');
//             if (eqIdx > 0) {
//                 const key = trimmedLine.substring(0, eqIdx).trim();
//                 let value = trimmedLine.substring(eqIdx + 1).trim();

//                 // Remove surrounding quotes
//                 if ((value.startsWith('"') && value.endsWith('"')) ||
//                     (value.startsWith("'") && value.endsWith("'"))) {
//                     value = value.slice(1, -1);
//                 }

//                 process.env[key] = value;
//                 if (key.includes('PROJECT') || key.includes('CREDENTIALS')) {
//                     console.log(`[ENV] Loaded ${key} (Length: ${value.length})`);
//                 }
//             } else {
//                 if (trimmedLine.includes('=')) {
//                     console.log(`[ENV WARN] Line ${idx} failed parse: ${trimmedLine.substring(0, 20)}...`);
//                 }
//             }
//         });
//     } catch (e) {
//         console.error("Error loading env:", e);
//     }
// }

// async function runDemo() {
//     loadEnv();

//     // Dynamic import to ensure process.env is populated first
//     // const { analyzeStyleWithGemini } = await import('../src/lib/vertex');
//     console.log("Demo disabled temporarily due to missing export.");

//     // // 1. Load a sample image
//     // const imagePath = path.join(process.cwd(), 'public', 'styles', 'industrial.png');
//     // console.log(`\n--- DEMO: ANALYZING STYLE [${path.basename(imagePath)}] ---`);

//     // if (!fs.existsSync(imagePath)) {
//     //     console.error("Sample image not found!");
//     //     return;
//     // }

//     // const buffer = fs.readFileSync(imagePath);
//     // const base64 = buffer.toString('base64');

//     // // 2. Call the "Inspector" (Gemini)
//     // console.log("Sending to Gemini 3 Pro (Global)...");
//     // try {
//     //     const description = await analyzeStyleWithGemini(base64);

//     //     // 3. Output results
//     //     console.log("\n--- RESULT: STYLE CODE (METADATA) ---");
//     //     console.log(description);
//     //     console.log("\n-------------------------------------");
//     //     console.log("In the full workflow, this text is saved to DB and sent alongside the image.");
//     // } catch (e) {
//     //     console.error("Analysis failed:", e);
//     // }
// }

// runDemo();
