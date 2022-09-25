/// <reference types="mocha" />
/// <reference path="../../typings/chai.d.ts" />
/// <reference path="../../typings/chai-as-promised.d.ts" />

require('source-map-support').install();

import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { App, us_listen_socket_close } from 'uWebSockets.js';

chai.use(chaiAsPromised);

export function delay(duration: number) {
	return new Promise(resolve => setTimeout(resolve, duration));
}

export function createServerHandler() {
	const app = App();
	let token: any;
	const start = () => {
		app.listen(12345, tokenQuestionMark => {
			token = tokenQuestionMark;
		});
	};
	const stop = () => {
		us_listen_socket_close(token);
	};

	return { app, start, stop };
}

export type MockServerHandler = ReturnType<typeof createServerHandler>;
