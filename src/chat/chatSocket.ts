import * as socketIo from 'socket.io';

import * as chatService from './chatService';
import { log } from '../util';

/*
user = 
  {
    uid:                       // socket.id (v)
    type: 0/1                  // 0 for user, 1 for service (v)
    target:                    // the customer or the service
    isAvailable: true/false    // only if type === 1, is available for service
    socket:                    // user socket
    uuid:                      // chatroom
  }

socket emmits:
  - id: Default id for customer.
  - info: Informaton.
  - mood: Return sentences mood and keywords.
socket on:
  - login: User login. Server will start matching service and customer.
  - message: User send message. Server will emit message to target and sending data to backend for getting mood.
*/

var _onlineUsers = {};
var _timers = {};

export default function onConnect(socket: socketIo.Socket): void {
  log('chatSocket onConnect:\t', 'Connected client');
  socket.emit('id', socket.id);

  socket.on('login', onLogin);
  socket.on('message', onMessage);
  socket.on('status', getStatus);
  socket.on('disconnect', onDisconnect);
}


// Matching Customer and Service
async function csMatching(uid: string): Promise<void> {
  log('chatSocket csMatching:\t', 'Start matching serivce...');
  // If uid not found, stop matching service
  if(typeof _onlineUsers[uid] === 'undefined'){
    log('chatSocket csMatching:\t', 'Matching stopped due to uid not found or id is service...');
    clearTimeout(_timers[uid]);
    return;
  }
  // It is no need for service to find customer
  if(_onlineUsers[uid].type === 1){
    return;
  }
  
  // Customer finding service
  var service;
  var retryCount = 0;
  var maxRetries = 5;
  for(var id in _onlineUsers) {
    service = _onlineUsers[id];
    // Finding a available service online
    if(service.type === 1 && service.isAvailable) {
      // Service is unavailable after paired.
      service.isAvailable = false;
      // Binding service and customer
      service.target = _onlineUsers[uid];
      _onlineUsers[uid].target = service;
      // emit a message telling each other
      log('chatSocket csMatching:\t', 'Matched', _onlineUsers[uid].uid, 'and', service.uid);
      _onlineUsers[uid].socket.emit('info', '客服已上線！');
      service.socket.emit('info', '已連上顧客！');
      // Require a chatroom and bind to each other
      do {
        var uuid = await chatService.getUUID();
        if(uuid !== undefined) {
          log('chatSocket csMatching:\t', 'UUID', uuid, 'get!');
          service.uuid = uuid;
          _onlineUsers[uid].uuid = uuid;
        }
        else log('chatSocket csMatching:\t', 'Getting UUID failed, retry', retryCount + 1);
      } while(uuid === undefined && ++retryCount <= maxRetries);
      if(retryCount >= 5) log('chatSocket csMatching:\t', 'FAILD getting UUID');
      return;
    }
  }
  // Services are all busy, retry matching new service in 5 seconds
  log('chatSocket csMatching:\t', 'No available service for customer', uid , ', will retry in 5 seconds');
  _timers[uid] = setTimeout(csMatching.bind(null, uid), 5000);
}

function onLogin(data): void {
  data = data || '';
  var uid = data.uid || '';

  if(!uid || typeof _onlineUsers[uid] !== 'undefined') {
    // if uid is null, or user exists in onlineUsers
    log('chatSocket onLogin:\t', 'ERROR!',  'Uid is null or onlineUsers exists!');
    // this.emit('error');
    return;
  }

  this.uid = uid; // 目前不知道這句在幹嘛

  // Create a User
  _onlineUsers[uid] = {
    uid: uid,
    type: data.type === 1 ? 1 : 0,
    isAvailable: data.type === 1,
    socket: this
  };

  // Welcome message
  if(_onlineUsers[uid].type === 1) {
    log('chatSocket onLogin:\t', 'Service', uid, 'comes online!');
    this.emit('info', '客服您好！');
  } else {
    log('chatSocket onLogin:\t', 'Customer', uid, 'login');
    this.emit('info', '您好，正在為您轉接客服...');

    csMatching(uid);
  }
}

async function onMessage(data): Promise<void> {
  data = data || '';
  var uid = data.uid || '';
  var message = data.message;
  var user = _onlineUsers[uid];
  var service = _onlineUsers[uid].type === 1 ? _onlineUsers[uid].socket : _onlineUsers[uid].target.socket;

  if(!uid || user.uuid === undefined || !user.target || !message) {
    // if uid is null, or uuid did not get, or target not found, or no message
    return;
  }
  log('chatSocket onMessage:\t', 'Message from', uid, ':', message);
  user.target.socket.emit('message', message);
  log('chatSocket onMessage:\t', 'Waiting for mood info...');
  
  var retryCount = 0;
  var maxRetries = 5;
  do {
    var mood = await chatService.sendMessage(user, message);
    if(mood !== undefined) {
      log('chatSocket onMessage:\t', 'Mood info get!', mood);
      service.emit('mood', mood);
    } else log('chatSocket onMessage:\t', 'Getting Mood failed, retry', retryCount + 1);
  } while(++retryCount <= maxRetries && mood === undefined);
  if(retryCount >= 5) log('chatSocket sendMessage:\t', 'FAILD getting mood');
}

function getStatus(data): void {
  var service;
  var s = [];
  for(var id in _onlineUsers) {
    service = _onlineUsers[id];
    // Finding online services 
    if(service.type === 1) {
      var t = {
        uid: service.uid,
        isAvailable: service.isAvailable
      }
      s.push(t);
    }
  }
  this.emit('status', s);
  log("chatSocket getStatus:\t", "Status sent");
}

function onDisconnect(data): void {
  var uid = this.uid;
  var	user = _onlineUsers[uid];
  
  if(!uid || !user) {
    return;
  }

  log('chatSocket onDisconnect:\t', user.uid, 'disconnect');

  var target = user.target;
  if(target) {
    switch(user.type){
      case 1: // Service disconnect
        if(target.socket) target.socket.emit('info', '客服已退出對話');
        break;
      default:
        target.isAvailable = true; // Service become available
        if(target.socket) target.socket.emit('info', '顧客已退出對話');
        break;
    }
    // Break binding
    delete target.target;
    delete user.target;
  }
    
  clearTimeout(_timers[uid]);
  target = user = null;

  delete _onlineUsers[uid];
}