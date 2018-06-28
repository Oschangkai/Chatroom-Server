import fetch from "node-fetch";

import { log } from '../util';

var _baseURL = "http://35.189.180.199:5000/api/v1";

export async function getUUID(): Promise<string> {
  log('chatService getUUID:\t', 'Getting UUID...');
  var uuid;
  try {
    await fetch(_baseURL + "/chat", { method: "POST" })
        .then(res => res.json())
        .then(json => uuid = json.uuid)
        .then(_ => log("chatService getUUID: " + uuid));
  } catch(e) {
    log("chatService getUUID:\t", e);
  }
  return uuid;
}

export async function sendMessage(user, message): Promise<Object> {
  user = user || '';
  message = message || '';

  if(!user || !message || !user.uuid) {
    return;
  }
  // Construct POST data
  var time = new Date().toISOString();
  var data = {
    userID: user.uid,
    sentence: message,
    timestamp: time
  }
  log('chatService sendMessage:\t', JSON.stringify(data));

  var documentSentiment = '';
  var entities = [];
  var entities_length = '';
  try {
    await fetch(_baseURL + "/chat/" + user.uuid, { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    .then(res => res.json())
    .then(j => {
      // Fetch mood
      try {
        if (j.documentSentiment && j.documentSentiment != 'undefined') documentSentiment = JSON.stringify(j.documentSentiment.score);
        else documentSentiment = "0"
      } catch (e) {
        documentSentiment = "0"
      }
      // Fetch keywords
      try {
        if (j.entities && j.entities != 'undefined') {
          var t = j.entities;
          for (var i = 0; i < t.length; i++) entities.push(t[i]["name"]);
          entities_length = entities.length.toString();
        } else {
          entities = [''];
          entities_length = '0';
        }
      } catch (e) {
        entities = [''];
        entities_length = '0';
      }
    })
    .then(_ => {
      log('chatService sendMessage:\t', 'documentSentiment:', documentSentiment);
      log('chatService sendMessage:\t', 'entities:', entities.toString());
      log('chatService sendMessage:\t', 'entities_length:', entities_length);
    });
  } catch(e) {
    log('chatService sendMessage:\t', e);
  }

  var meta = {
    documentSentiment: documentSentiment,
    entities: entities,
    entities_length: entities_length
  }
  return meta;
}