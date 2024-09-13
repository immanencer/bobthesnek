// AIModule.js
import fetch from 'node-fetch';
import TaskModule from './taskModule.js';

// Constants for configuration
const {
    OPENROUTER_API_KEY,
    AI_MODEL = "nousresearch/hermes-3-llama-3.1-405b",
    SYSTEM_PROMPT = "You are a helpful assistant.",
    AI_TASK_PROCESS_INTERVAL = 10000, // in milliseconds
} = process.env;

// Utility function for timestamped logs
function log(message, ...optionalParams) {
    console.log(`[${new Date().toISOString()}] ${message}`, ...optionalParams);
}

class AIModule {
    constructor(options = {}) {
        // Configuration options with defaults
        this.apiKey = options.apiKey || OPENROUTER_API_KEY;
        this.model = options.model || AI_MODEL;
        this.systemPrompt = options.systemPrompt || SYSTEM_PROMPT;
        this.taskProcessInterval = parseInt(options.taskProcessInterval, 10) || AI_TASK_PROCESS_INTERVAL;

        // Initialize TaskModule
        this.taskModule = options.taskModule || new TaskModule();

        // Bind methods
        this.processAIPendingTasks = this.processAIPendingTasks.bind(this);
        this.startTaskProcessing = this.startTaskProcessing.bind(this);
        this.shutdown = this.shutdown.bind(this);

        // Internal state
        this.isProcessing = false;
        this.taskTimeout = null;
    }

    /**
     * Start processing AI pending tasks at regular intervals.
     */
    startTaskProcessing() {
        if (this.isProcessing) {
            log('AI task processing is already running.');
            return;
        }
        this.isProcessing = true;
        log('Starting AI task processing loop...');
        this.scheduleNextTask();
    }

    /**
     * Schedule the next task processing cycle.
     */
    scheduleNextTask() {
        if (!this.isProcessing) return;
        this.taskTimeout = setTimeout(async () => {
            try {
                await this.processAIPendingTasks();
            } catch (error) {
                log('Error in processing AI pending tasks:', error);
            } finally {
                this.scheduleNextTask();
            }
        }, this.taskProcessInterval);
    }

    /**
     * Stop the task processing loop.
     */
    stopTaskProcessing() {
        if (this.taskTimeout) {
            clearTimeout(this.taskTimeout);
            this.taskTimeout = null;
            log('AI task processing loop stopped.');
        }
        this.isProcessing = false;
    }

    /**
     * Process all pending AI tasks.
     */
    async processAIPendingTasks() {
        try {
            log('Fetching pending AI tasks...');
            const tasks = await this.taskModule.getPendingTasks('ai');

            if (tasks.length === 0) {
                log('No pending AI tasks to process.');
                return;
            }

            log(`Processing ${tasks.length} AI task(s).`);

            // Process tasks sequentially to manage API rate limits
            for (const task of tasks) {
                await this.processSingleTask(task);
            }

            log('All pending AI tasks have been processed.');
        } catch (error) {
            log('Error in processAIPendingTasks:', error);
        }
    }

    /**
     * Process a single AI task.
     * @param {Object} task - The task object from TaskModule.
     */
    async processSingleTask(task) {
        try {
            const { _id, content } = task;

            log(`Processing AI task with ID: ${_id}`);

            // Validate task content
            if (!content || typeof content !== 'string') {
                log(`Invalid content for task ID: ${_id}. Marking as failed.`);
                await this.taskModule.updateTaskStatus(_id, 'failed');
                return;
            }

            // Get AI response
            const aiResponse = await this.chatWithAI(content);

            // Update task status to completed with AI response
            await this.taskModule.completeTask(_id, aiResponse);

            log(`AI Task ${_id} completed successfully.`);
        } catch (error) {
            log(`Failed to process AI task ${task._id}:`, error);
            // Optionally, implement retry logic or mark the task as failed
            try {
                await this.taskModule.updateTaskStatus(task._id, 'failed');
            } catch (updateError) {
                log(`Failed to update status for task ${task._id}:`, updateError);
            }
        }
    }

    /**
     * Communicate with the AI API to get a response.
     * @param {string} userContent - The user's message content.
     * @returns {string} - The AI's response.
     */
    async chatWithAI(userContent) {
        if (!this.apiKey) {
            throw new Error('OpenRouter API key is not configured.');
        }

        const apiUrl = "https://openrouter.ai/api/v1/chat/completions";

        const payload = {
            model: this.model,
            messages: [
                { role: "system", content: this.systemPrompt },
                { role: "user", content: userContent }
            ],
        };

        try {
            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`AI API responded with status ${response.status}: ${errorText}`);
            }

            const data = await response.json();

            if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
                throw new Error('Invalid response format from AI API.');
            }

            const aiMessage = data.choices[0].message?.content;

            if (!aiMessage) {
                throw new Error('AI API response does not contain message content.');
            }

            return aiMessage.trim();
        } catch (error) {
            log('Error communicating with AI API:', error);
            throw error; // Rethrow to handle in the calling function
        }
    }

    /**
     * Gracefully shut down the AIModule, stopping task processing.
     */
    async shutdown() {
        try {
            log('Shutting down AIModule...');
            this.stopTaskProcessing();
            // If TaskModule requires shutdown, implement it here
            if (typeof this.taskModule.shutdown === 'function') {
                await this.taskModule.shutdown();
                log('TaskModule shutdown.');
            }
            log('AIModule shut down successfully.');
        } catch (error) {
            log('Error during AIModule shutdown:', error);
        }
    }
}

export default AIModule;
