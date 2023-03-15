# tc-sockets

<b>This branch contains distribution files. Check main branch for source</b>

Library for communication via WebSockets.

This repository is a fork of [ag-sockets](https://github.com/Agamnentzar/ag-sockets)


## What does this fork offer?
  * Ability to to run the library without code generator therefor it should be safe to run it without `unsafe-eval` in `CSP`
  * Adds uWebSockets.js version 20.19.0 or higher compatibly

This fork has slightly different folder structure than original

## Dependencies

This package has a peer dependency on `uWebSockets.js` version v20.19.0 or higher.


## Installation
Distribution files are currently available on uws.js-dist branch 

Using npm
```bash
npm i "https://github.com/Terncode/tc-sockets#uws.js-dist" 
```

## Usage

The following code only works with typescript

```typescript
import { createServer } from 'tc-sockets';
import { App } from 'uWebSockets.js';
const app = App();

// ...
const wsServer = createServer(app, ... { arrayBuffer: true });

```

if for whatever reason you need to have code generator code
```typescript
import { createServer } from 'tc-sockets';
import { createCodeGenHandlers } from 'tc-sockets/dist/codeGenHandler';
import { App } from 'uWebSockets.js';
const app = App();
// ...

const wsServer = createServer(app, ..., { arrayBuffer: true }, undefined, undefined, createCodeGenHandler());
```

### Set up sockets

#### Common interfaces

```typescript
// interfaces.ts

import { SocketClient, SocketServer } from 'tc-sockets';

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

import { Method } from 'tc-sockets';
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

import { Method, Socket, ClientExtensions } from 'tc-sockets';
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

```typescript
import { App } from 'uWebSockets.js';
import { createServer } from 'tc-sockets';
import { ExampleClient } from './client';
import { ExampleServer } from './server';
// code gen
import { createCodeGenHandlers } from 'tc-sockets/dist/codeGenHandler';


const app = App();

const server = http.createServer(app);
const wsServer = createServer(ExampleServer, ExampleClient, client => new Server(client));

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
import { createClientSocket } from 'tc-sockets';
import { ExampleClient } from './client';
import { IExampleClient, IExampleServer } from './interfaces';
// code gen
import { createCodeGenHandlers } from 'tc-sockets/dist/codeGenHandler';


const options = {}
const service = createClientSocket<IExampleClient, IExampleServer>(options/*, undefined, undefined, undefined, undefined, createCodeGenHandlers()*/);
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
