# ts-sockets

Library for communication via WebSockets

## Installation

```bash
# From my experience this command takes really long time 
npm i "https://github.com/Terncode/tc-sockets#uws.js-dist" 
```

## Usage

The following code only works with typescript

```typescript
import { createServer } from 'ts-sockets';

// ...
const wsServer = createServer({ arrayBuffer: true, port: 12345 });
```

### Set up sockets

#### Common interfaces

```typescript
// interfaces.ts

import { SocketClient, SocketServer } from 'ts-sockets';

export interface IExampleClient extends SocketClient {
  message(name: string, message: string);
}

export interface IExampleServer extends SocketServer {
  connected(): void;
  disconnected(): void;
  broadcast(message: string): void;
  setName(name: string): void;
}
```

#### Client object

```typescript
// client.ts

import { Method } from 'ts-sockets';
import { IExampleClient, IExampleServer } from './interfaces';

export class ExampleClient implements IExampleClient {
  constructor(private server: IExampleServer) {
  }
  connected() {
    this.server.setName('John');
    this.server.broadcast('Hello!');
  }
  @Method()
  message(name: string, message: string) {
    console.log(`${name}: ${message}`);
  }
}
```

#### Server object

```typescript
// server.ts

import { Method, Socket, ClientExtensions } from 'ts-sockets';
import { IExampleClient, IExampleServer } from './interfaces';

const clients: ExampleClient[] = [];

@Socket({ path: '/test' })
export class ExampleServer implements IExampleServer {
  private name: string;
  constructor(private client: IExampleClient & ClientExtensions) {
  }
  connected() {
    clients.push(this.client);
  }
  disconnected() {
    clients.splice(clients.indexOf(this.client), 1);
  }
  @Method() // annotations are optional if all class methods are to be available
  broadcast(message: string) {
    clients.forEach(c => c.message(this.name, message));
  }
  @Method()
  setName(name: string) {
    this.name = name;
  }
}
```

#### Start server

### With node http server
```typescript
import * as http from 'http';
import { createServer } from 'ts-sockets';
import { ExampleClient } from './client';
import { ExampleServer } from './server';

const server = http.createServer();

const wsServer = createServer(ExampleServer, ExampleClient, client => new Server(client), {
  port: 12346, // Note you need dedicated port to run sockets
});
// pass 'wsServer.options()' to client side

server.listen(12345, () => console.log('server listening...'));
```

### With uws app http server
```typescript
import { App } from 'ts-sockets/uws';
import { createServer } from 'ts-sockets';
import { ExampleClient } from './client';
import { ExampleServer } from './server';

const app = App();

const server = http.createServer(app);
const wsServer = createServer(ExampleServer, ExampleClient, client => new Server(client), {
  app
});
// pass 'wsServer.options()' to client side

app.listen(12345, (token) => {
  if (token) {
    console.log('server listening')
  } else {
    console.log('Failed to start')
    process.exit(1);
  }
});
```

#### Connect client

```typescript
import { createClientSocket } from 'ts-sockets/';
import { ExampleClient } from './client';
import { IExampleClient, IExampleServer } from './interfaces';

const options = // get 'wsServer.options()' from server side
const service = createClientSocket<IExampleClient, IExampleServer>(options);
service.client = new ExampleClient(service.server);
service.connect();
```

### Binary communication

```typescript
export const enum Bin {
	I8,
	U8,
	I16,
	U16,
	I32,
	U32,
	F32,
	F64,
	Bool,
	Str,
	Obj,
}

// examples

class Client {
	@Method({ binary: [Bin.I32, Bin.Str] })
	foo(a: number, b: string) {
	}
	@Method({ binary: [[Bin.I32], [Bin.I32, Bin.I32, Bin.I32]] })
	bar(a: number[], b: [number, number, number][]) {
	}
	@Method({ binary: [[Bin.F32], Bin.Obj] })
	boo(a: number[], b: any) {
	}
}
```

## Development

```bash
gulp build          # build production version of code

gulp dev            # build and start watch tasks
gulp dev --tests    # build and start watch tasks with tests
gulp dev --coverage # build and start watch tasks with tests and code coverage

gulp lint           # typescript lint
```
