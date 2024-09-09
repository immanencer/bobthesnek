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
                if (!task.channelId) {
                    console.error('No channel ID provided');
                    await this.taskModule.updateTaskStatus(task._id, 'failed');
                    continue;
                }

                const channel = await this.client.channels.fetch(task.channelId);
                if (channel) {
                    const chunks = this.chunkMessage(task.content);

                    for (const chunk of chunks) {
                        await channel.send(chunk);
                    }

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

    chunkMessage(content) {
        const paragraphs = content.split(/\n\s*\n/); // Split by double line breaks or multiple line breaks
        const chunks = [];
        let currentChunk = '';
    
        for (const paragraph of paragraphs) {
            const trimmedParagraph = paragraph.trim();
    
            if (trimmedParagraph.length === 0) {
                continue; // Skip empty paragraphs
            }
    
            // If the current paragraph exceeds the limit, split it by sentences or characters
            if (trimmedParagraph.length > 2000) {
                const subParagraphs = this.splitLongParagraph(trimmedParagraph);
                subParagraphs.forEach(sub => {
                    if (currentChunk.length + sub.length + 2 > 2000) {
                        chunks.push(currentChunk.trim());
                        currentChunk = sub;
                    } else {
                        currentChunk += '\n\n' + sub;
                    }
                });
            } else if (currentChunk.length + trimmedParagraph.length + 2 > 2000) {
                chunks.push(currentChunk.trim());
                currentChunk = trimmedParagraph;
            } else {
                currentChunk += (currentChunk.length ? '\n\n' : '') + trimmedParagraph;
            }
        }
    
        if (currentChunk.trim().length > 0) {
            chunks.push(currentChunk.trim());
        }
    
        return chunks;
    }
    
    // Helper method to split long paragraphs if they exceed the 2000-character limit
    splitLongParagraph(paragraph) {
        const sentences = paragraph.match(/[^.!?]+[.!?]*/g) || [paragraph]; // Split by sentence or fallback to the paragraph itself
    
        const chunks = [];
        let currentChunk = '';
    
        for (const sentence of sentences) {
            if (currentChunk.length + sentence.length + 1 > 2000) {
                chunks.push(currentChunk.trim());
                currentChunk = sentence;
            } else {
                currentChunk += sentence;
            }
        }
    
        if (currentChunk.trim().length > 0) {
            chunks.push(currentChunk.trim());
        }
    
        return chunks;
    }    
}

export default DiscordModule;
