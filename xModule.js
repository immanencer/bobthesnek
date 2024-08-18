import { TwitterApi } from 'twitter-api-v2';
import TaskModule from './taskModule.js';

class XModule {
    constructor() {
        this.client = new TwitterApi({
            appKey: process.env.X_API_KEY,
            appSecret: process.env.X_API_KEY_SECRET,
            accessToken: process.env.X_ACCESS_TOKEN,
            accessSecret: process.env.X_ACCESS_SECRET,
        });
        this.taskModule = new TaskModule();
    }

    async processXPendingTasks() {
        const tasks = await this.taskModule.getPendingTasks('x');
        for (const task of tasks) {
            try {
                await this.postTweet(task.content);
                await this.taskModule.updateTaskStatus(task._id, 'completed');
                console.log('Tweet posted:', task.content);
            } catch (error) {
                console.error('Failed to process tweet task:', error);
                await this.taskModule.updateTaskStatus(task._id, 'failed');
            }
        }
    }

    async postTweet(text) {
        try {
            const response = await this.client.v2.tweet(text);
            console.log('Tweet posted:', response);
            return response;
        } catch (error) {
            console.error('Error posting tweet:', error);
            throw error;
        }
    }
}

export default XModule;
