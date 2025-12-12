import { getSystemPrompt } from '../actions';
import { PromptEditor } from './PromptEditor';

export const dynamic = 'force-dynamic';

export default async function AIConfigPage() {
    // Fetch the prompt server-side
    // If table doesn't exist yet (migration pending), this returns null.
    // The Editor handles null by showing defaults.
    const promptData = await getSystemPrompt('gemini-handrail-main');

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
