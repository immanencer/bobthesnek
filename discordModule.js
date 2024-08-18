import { Client, GatewayIntentBits } from 'discord.js';
import { MongoClient } from 'mongodb';
import TaskModule from './taskModule.js';

class DiscordModule {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
            ]
        });
        this.mongoClient = new MongoClient(process.env.MONGO_URL || 'mongodb://localhost:27017');
        this.db = this.mongoClient.db('botDB');
        this.collection = this.db.collection('messages'); // MongoDB collection for logging messages

        this.taskModule = new TaskModule(); // Use TaskModule for task management
    }

    async start() {
        await this.mongoClient.connect(); // Connect to MongoDB

        this.client.once('ready', () => {
            console.log('Discord bot is online');
        });

        this.client.on('messageCreate', async (message) => {

            // Log the message to MongoDB
            await this.collection.insertOne({
                clientId: this.client.user.id,
                content: message.content,
                authorId: message.author.id,
                authorUsername: message.author.username,
                channelId: message.channel.id,
                channelName: message.channel.name,
                createdAt: new Date(),
                mentions: message.mentions.members.map(member => member.id)
            });

            console.log('Message logged:', message.content);

        });

        this.client.login(process.env.DISCORD_BOT_TOKEN);
    }

    // Method to process pending Discord tasks using TaskModule
    async processDiscordPendingTasks() {
        const tasks = await this.taskModule.getPendingTasks('discord');

        for (const task of tasks) {
            try {
                const channel = await this.client.channels.fetch(task.channelId);
                if (channel) {
                    await channel.send(task.content);
                    await this.taskModule.updateTaskStatus(task._id, 'completed');
                    console.log('Message sent to channel:', task.channelId);
                } else {
                    console.error('Channel not found:', task.channelId);
                }
            } catch (error) {
                console.error('Error processing Discord task:', error);
            }
        }
    }
}

export default DiscordModule;
