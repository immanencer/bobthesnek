import fetch from 'node-fetch';
import TaskModule from './taskModule.js';

class AIModule {
    constructor(systemPrompt = "You are a helpful assistant.") {
        this.taskModule = new TaskModule();
        this.systemPrompt = systemPrompt; // Default system prompt or custom one passed in constructor
    }

    async processAIPendingTasks() {
        const tasks = await this.taskModule.getPendingTasks('ai');
        for (const task of tasks) {
            try {
                const response = await this.chatWithAI(task.content);
                await this.taskModule.updateTaskStatus(task._id, 'completed');
                console.log('AI Task completed:', response);
            } catch (error) {
                console.error('Failed to process AI task:', error);
            }
        }
    }

    async chatWithAI(content, systemPrompt = this.systemPrompt) {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "nousresearch/hermes-3-llama-3.1-405b",
                "messages": [
                    { "role": "system", "content": systemPrompt }, // System prompt for context
                    { "role": "user", "content": content } // User's message content
                ],
            })
        });

        const data = await response.json();
        return data.choices?.[0]?.message?.content || 'No response from AI.';
    }
}

export default AIModule;
