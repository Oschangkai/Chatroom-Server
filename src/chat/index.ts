import { createServer, Server } from 'http';
import * as express from 'express';
import * as socketIo from 'socket.io';

import onConnect from './chatSocket';
import { log } from '../util';

export class chatServer {
  public static readonly PORT: number = 8080;
  private app: express.Application;
  private server: Server;
  private io: SocketIO.Server;
  private port: string | number;

  constructor() {
    this.initServer();
    this.listen();
  }

  private initServer(): void {
    this.app = express();
    this.server = createServer(this.app);
    this.port = process.env.PORT || chatServer.PORT;
    this.io = socketIo(this.server);
  }

  private listen(): void {
    this.server.listen(this.port, () => {
      log('Running server on port', this.port);
    });

    this.io.on('connection', onConnect);
  }

  public getApp(): express.Application {
    return this.app;
  }
}