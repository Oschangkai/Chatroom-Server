import { chatServer } from './chat';

let app = new chatServer().getApp();
export { app };