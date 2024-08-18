import http from 'http';
import { MongoClient, ObjectId } from 'mongodb';
import BotModule from './botModule.js';

const mongoUrl = process.env.MONGODB_;
const dbName = 'bobDB';
const taskCollectionName = 'tasks';
const port = process.env.CONSOLE_PORT || 3000;

class ConsoleModule {
    constructor() {
        this.botModule = new BotModule();
        this.botModule.start();
    }

    async fetchTasks() {
        const client = new MongoClient(mongoUrl);
        try {
            await client.connect();
            const db = client.db(dbName);
            const collection = db.collection(taskCollectionName);

            return await collection.find().toArray();
        } catch (error) {
            console.error('Error fetching tasks:', error);
            return [];
        } finally {
            await client.close();
        }
    }

    async updateTaskStatus(taskId, status) {
        const client = new MongoClient(mongoUrl);
        try {
            await client.connect();
            const db = client.db(dbName);
            const collection = db.collection(taskCollectionName);

            await collection.updateOne({ _id: new ObjectId(taskId) }, { $set: { status } });
        } catch (error) {
            console.error('Error updating task status:', error);
        } finally {
            await client.close();
        }
    }

    createServer() {
        const server = http.createServer(async (req, res) => {
            if (req.method === 'GET' && req.url === '/') {
                const tasks = await this.fetchTasks();
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.write('<h1>BobBot Web Console</h1>');
                res.write('<button onclick="location.href=\'/process-tasks\'">Process Tasks</button>');
                res.write('<h2>Current Tasks</h2>');
                res.write('<ul>');

                tasks.forEach(task => {
                    res.write(`
                        <li>
                            ${task.type} - ${task.content} - Status: ${task.status}
                            ${task.status === 'pending' ? `<a href="/approve/${task._id}">Approve</a>` : ''}
                        </li>
                    `);
                });

                res.write('</ul>');
                res.end();
            } else if (req.method === 'GET' && req.url === '/process-tasks') {
                await this.botModule.processTasks(); // Manually trigger task processing
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.write('<h1>Tasks Processed</h1>');
                res.write('<a href="/">Go back</a>');
                res.end();
            } else if (req.method === 'GET' && req.url.startsWith('/approve/')) {
                const taskId = req.url.split('/')[2];
                await this.updateTaskStatus(taskId, 'approved');
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.write('<h1>Task Approved</h1>');
                res.write('<a href="/">Go back</a>');
                res.end();
            } else {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.write('<h1>404 - Not Found</h1>');
                res.end();
            }
        });

        server.listen(port, () => {
            console.log(`🐍 BobBot Console running at http://localhost:${port}/`);
        });
    }

    start() {
        this.createServer();
    }
}

export default ConsoleModule;
