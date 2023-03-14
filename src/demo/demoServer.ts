import * as path from 'path';
import * as fs from 'fs';
import { createServer, Method, Socket } from '../index';
import { DemoClient } from './demoClient';
import { App } from 'uWebSockets.js';

const clients: DemoClient[] = [];

@Socket({
	path: '/ws',
	debug: false,
	// connectionTokens: true,
	// transferLimit: 100,
})
class DemoServer {
	constructor(private client: DemoClient) {
	}
	connected() {
		console.log('connected');
		clients.push(this.client);
	}
	disconnected() {
		clients.splice(clients.indexOf(this.client), 1);
	}
	@Method()
	name(text: string) {
		console.log('name', text);
		this.client.name = text;
	}
	@Method({ rateLimit: '2/s' })
	message(text: string) {
		console.log('message', text);
		clients.forEach(c => c.message(this.client.name, text));
	}
}

const PORT = 8071;

const app = App();

const socket = createServer(app, DemoServer, DemoClient, client => new DemoServer(client), {
	port: PORT + 1,
}, {
	handleError: console.log,
	handleRejection: console.log,
	handleRecvError: console.log,
});

app.get('/demo.js', async res => {
	const data = fs.readFileSync(path.join(__dirname, 'demo.js'));
	res.writeHeader('Content-Type', 'application/javascript');
	res.end(data);
});
app.get('/', (res) => {
	const html = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'demo', 'demo.html'), 'utf8');
	res.writeHeader('Content-Type', 'text/html');
	res.end(html.replace(/CONFIG/, JSON.stringify(socket.options())));
});
app.listen(PORT, () => {
	console.log(`Listening on ${PORT}`);
});
