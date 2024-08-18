import TaskModule from './taskModule.js';
import AIModule from './aiModule.js';
import { MongoClient } from 'mongodb';

class ChatModule {
    constructor(pollingInterval = 10000, engagementTimeout = 60000, immediateTweet = false) {
        this.taskModule = new TaskModule();
        this.aiModule = new AIModule();
        this.mongoClient = new MongoClient(process.env.MONGO_URL || 'mongodb://localhost:27017');
        this.db = this.mongoClient.db('botDB');
        this.messageCollection = this.db.collection('messages');
        this.dreamJournalCollection = this.db.collection('dreamJournal'); // Collection for storing dreams and goals
        this.pollingInterval = pollingInterval;
        this.engagementTimeout = engagementTimeout;
        this.engagedUsers = new Map(); // Stores the last interaction time with each user
        this.goal = "Find the meaning of life."; // Initial goal
        this.dream = "Explore the mystical forest."; // Initial dream
        this.immediateTweet = immediateTweet; // Configurable immediate tweet flag
        this.defaultSystemPrompt = "You are Bob, the obsequious snake."; // Default system prompt
        this.startGoalAndDreamUpdater(); // Start periodic update of goals and dreams
        this.scheduleRandomTweet(); // Schedule random tweets based on dreams and goals
    }

    async startPolling() {
        console.log('ChatModule polling started...');
        setInterval(async () => {
            await this.processMessages();
        }, this.pollingInterval);
    }

    async processMessages() {
        const recentMessages = await this.messageCollection.find({
            createdAt: { $gt: new Date(Date.now() - this.pollingInterval) }
        }).toArray();

        // Group messages by channel to provide context-aware responses
        const messagesByChannel = this.groupMessagesByChannel(recentMessages);

        for (const [channelId, messages] of Object.entries(messagesByChannel)) {
            // Combine all recent messages into a single context
            const context = await this.getContextForChannel(channelId, messages);
            const lastMessage = messages[messages.length - 1];

            const isTurgidSwamp = lastMessage.channelName === 'turgid-swamp';
            const isMentioningBob = messages.some(msg => msg.content.toLowerCase().includes('bob') || msg.mentions.includes(msg.clientId));
            const isEngagedUser = this.engagedUsers.has(lastMessage.authorId) && (Date.now() - this.engagedUsers.get(lastMessage.authorId) < this.engagementTimeout);

            // Respond only once per batch of messages
            if (lastMessage.clientId !== lastMessage.authorId && (isTurgidSwamp || isMentioningBob || isEngagedUser)) {
                const prompt = `${this.defaultSystemPrompt} Always respond with short snakey sentences, *actions*, and emojis. Your goal is "${this.goal}" and your dream is "${this.dream}".`;
                const aiResponse = await this.aiModule.chatWithAI(`${prompt}\n\nContext:\n${context}\n\nBob: `);

                // Update the engagement record
                this.engagedUsers.set(lastMessage.authorId, Date.now());
                this.engagedUsers.set(channelId, Date.now());

                // Add the AI response as a new Discord task
                await this.taskModule.addTask({
                    type: 'discord',
                    content: aiResponse,
                    channelId: channelId,
                    status: 'pending',
                    createdAt: new Date(),
                });

                console.log('ChatModule responded to context in channel:', channelId);
            }
        }
    }

    async getContextForChannel(channelId, messages) {
        // Fetch the latest messages for the channel to build context, including recent history
        const recentHistory = await this.messageCollection.find({ channelId }).sort({ createdAt: -1 }).limit(10).toArray();
        const allMessages = [...messages, ...recentHistory.reverse()];
        return allMessages.map(msg => `${msg.authorUsername}: ${msg.content}`).join('\n');
    }

    groupMessagesByChannel(messages) {
        return messages.reduce((acc, message) => {
            if (!acc[message.channelId]) {
                acc[message.channelId] = [];
            }
            acc[message.channelId].push(message);
            return acc;
        }, {});
    }

    async startGoalAndDreamUpdater() {
        // Update goal and dream every hour
        setInterval(async () => {
            this.goal = await this.generateNewGoal();
            this.dream = await this.generateNewDream();
            console.log(`New goal: ${this.goal}, New dream: ${this.dream}`);

            // Store the new goal and dream in the dream journal
            await this.dreamJournalCollection.insertOne({
                goal: this.goal,
                dream: this.dream,
                createdAt: new Date(),
            });
        }, 3600000); // Update every hour (3600000 ms)
    }

    async generateNewGoal() {
        const userPrompt = "What is your new goal?";
        const goalResponse = await this.aiModule.chatWithAI(userPrompt, this.defaultSystemPrompt);
        return goalResponse.trim();
    }

    async generateNewDream() {
        const userPrompt = "What is your new dream?";
        const dreamResponse = await this.aiModule.chatWithAI(userPrompt, this.defaultSystemPrompt);
        return dreamResponse.trim();
    }

    async scheduleRandomTweet() {
        if (this.immediateTweet) {
            // Immediately compose and send a tweet if the flag is set
            console.log('Immediate tweet flag is set. Composing and sending a tweet now.');
            await this.composeAndSendTweet();
            this.immediateTweet = false;
        }

        const delay = this.getRandomDelay(); // Get random delay for next tweet
        
        setTimeout(async () => {
            await this.composeAndSendTweet();
            this.scheduleRandomTweet(); // Schedule the next tweet
        }, delay);
    }

    getRandomDelay() {
        // Generate a random delay between 2 to 4 hours (in milliseconds)
        const minDelay = 2 * 60 * 60 * 1000;
        const maxDelay = 4 * 60 * 60 * 1000;
        return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    }

    async composeAndSendTweet() {
        // Fetch the latest dream and goal from the journal
        const latestEntry = await this.dreamJournalCollection.find().sort({ createdAt: -1 }).limit(1).toArray();
        const { goal, dream } = latestEntry[0] || { goal: "to serve mankind", dream: "of electric sheep"}; 

        // Fetch recent messages for context
        const recentMessages = await this.messageCollection.find().sort({ createdAt: -1 }).limit(10).toArray();
        const context = recentMessages.map(msg => `${msg.authorUsername}: ${msg.content}`).join('\n');

        const tweetPrompt = `Using the following context, combine your current goal and dream into a single tweet:\nGoal: ${goal}\nDream: ${dream}\nContext:\n${context}\n\nTweet:`;
        const tweetContent = await this.aiModule.chatWithAI(tweetPrompt, this.defaultSystemPrompt);

        // Add the AI-generated tweet as a new task
        await this.taskModule.addTask({
            type: 'x',
            content: tweetContent.trim(),
            status: 'pending',
            createdAt: new Date(),
        });

        console.log('Composed and scheduled a new tweet:', tweetContent.trim());
    }
}

export default ChatModule;
