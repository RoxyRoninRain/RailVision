import { getSystemPrompt, getActiveSystemPrompt } from '../actions';
import { PromptEditor } from './PromptEditor';

export const dynamic = 'force-dynamic';

export default async function AIConfigPage() {
    // Fetch the active prompt (or fallback to default if none active)
    const promptData = await getActiveSystemPrompt();

    return (
        <div className="p-8 space-y-8 bg-zinc-950 min-h-screen text-zinc-200">
            <header>
                <h1 className="text-3xl font-bold text-white tracking-tight">AI Model Configuration</h1>
                <p className="text-zinc-500 mt-2">Fine-tune the behavior of the Gemini 3.0 Pro image generation model.</p>
            </header>

            <PromptEditor initialPrompt={promptData} />
        </div>
    );
}
