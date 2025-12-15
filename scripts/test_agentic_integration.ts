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

// async function runTest() {
//     loadEnv();
//     // const { analyzeStyleWithGemini, generateDesignWithNanoBanana } = await import('../src/lib/vertex');
//     console.log("Test disabled temporarily due to missing export.");

//     // console.log("--- TEST: AGENTIC WORKFLOW INTEGRATION ---");

//     // // 1. MOCK DATA
//     // const MOCK_STYLE_IMAGE = fs.readFileSync(path.join(process.cwd(), 'public', 'styles', 'industrial.png')).toString('base64');
//     // const MOCK_TARGET_IMAGE = fs.readFileSync(path.join(process.cwd(), 'public', 'styles', 'industrial.png')).toString('base64'); // Just re-using for test

//     // console.log("1. Simulating Style Analysis...");
//     // let styleDescription = "";
//     // try {
//     //     styleDescription = await analyzeStyleWithGemini(MOCK_STYLE_IMAGE);
//     //     console.log("   > Analysis Result:", styleDescription.substring(0, 100) + "...");
//     // } catch (e) {
//     //     console.error("   > Analysis FAILED:", e);
//     //     return;
//     // }

//     // console.log("\n2. Simulating Generation with Dynamic Prompt...");
//     // // Here we would normally inject the styleDescription into the prompt template
//     // // But generateDesignWithNanoBanana takes a styleInput.
//     // // If we pass the description string as styleInput, the new logic should handle it.
    
//     // const promptConfig = {
//     //     systemInstruction: "You are an expert architect.", // This would come from DB
//     //     userTemplate: ` Renovate this space. style: {{style}}.` // This would come from DB
//     // };

//     // try {
//     //     // Passing the text description as the style input to verify text-based prompting
//     //     const result = await generateDesignWithNanoBanana(
//     //         MOCK_TARGET_IMAGE,
//     //         styleDescription, // Passing the textual description!
//     //         promptConfig
//     //     );

//     //     if (result.success) {
//     //         console.log("   > Generation SUCCESS!");
//     //         console.log("   > Usage:", result.usage);
//     //     } else {
//     //         console.error("   > Generation FAILED:", result.error);
//     //     }

//     // } catch (e) {
//     //     console.error("   > Generation Error:", e);
//     // }

// }

// runTest();
