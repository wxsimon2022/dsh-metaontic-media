import { ConfigManager } from '../../dist/config/config-manager.js';
import { defaultConfig } from '../../dist/config/defaults.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Application, configSchema } from '../../dist/index.js';
const cap = mediaType => ({mediaType,modes:['text'],maxReferences:0,nativeAudio:false,negativePrompt:false,cancellation:false,idempotency:false});
test('synchronous image and asynchronous video save verified assets and restart without resubmitting',async()=>{
 const root=await mkdtemp(join(tmpdir(),'generation-'));let submits=0;let queries=0;const bodies=[];
 const png=Buffer.from([137,80,78,71,13,10,26,10,1,2,3]);
 const mp4=Buffer.from([0,0,0,16,102,116,121,112,105,115,111,109,0,0,0,0]);
 const server=createServer(async(req,res)=>{const chunks=[];for await(const chunk of req){chunks.push(chunk);}if(chunks.length)bodies.push(JSON.parse(Buffer.concat(chunks).toString()));res.setHeader('content-type','application/json');if(req.url==='/v1/images/generations'){submits++;res.end(JSON.stringify({data:[{b64_json:png.toString('base64')}]}));}else if(req.url==='/submit'){submits++;res.end(JSON.stringify({id:'remote',status:'queued'}));}else{queries++;res.end(JSON.stringify({id:'remote',status:'done',outputs:[{base64:mp4.toString('base64')}]}));}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));process.env.MEDIA_TEST_KEY='test';const baseUrl=`http://127.0.0.1:${server.address().port}`;
 const config=configSchema.parse({version:1,providers:[{id:'image',adapter:'openai-image',baseUrl,apiKeyEnv:'MEDIA_TEST_KEY',allowPrivateService:true},{id:'video',adapter:'newapi-video',baseUrl,apiKeyEnv:'MEDIA_TEST_KEY',allowPrivateService:true,protocol:{submitPath:'/submit',queryPath:'/status/{id}',states:{queued:'queued',done:'succeeded'}}}],models:[{id:'image',providerId:'image',capabilities:cap('image')},{id:'video',providerId:'video',capabilities:cap('video')}]});
 try{let app=new Application(root,config);const draft=await app.draft({model:'image',mediaType:'image',mode:'text',prompt:'cat',references:[]});const result=await app.execute(draft.id,async()=>true);assert.equal(result.state,'SUCCEEDED');assert.equal((await app.assets.read(result.assetIds[0])).bytes.equals(png),true);
 const video=await app.draft({model:'video',mediaType:'video',mode:'text',prompt:'cat',references:[]});assert.equal((await app.execute(video.id,async()=>true)).state,'RUNNING');app.dispose();app=new Application(root,config);const completed=await app.resume(video.id);assert.equal(completed.state,'SUCCEEDED');assert.equal(submits,2);assert.equal(queries,1);await app.resume(video.id);assert.equal(submits,2);app.dispose();
 const managed=defaultConfig();managed.providers=[{id:'channel',name:'Channel',enabled:true,baseUrl,apiKeyRef:'env:MEDIA_TEST_KEY',adapters:{video:'newapi-video'},timeoutMs:60000,allowPrivateService:true,videoProtocol:config.providers[1].protocol}];managed.models=[{id:'local-video',name:'Video',providerId:'channel',model:'remote-video-id',enabled:true,capabilities:cap('video'),capabilitySource:'manual'}];managed.settings.defaults.video.modelId='local-video';
 const manager=new ConfigManager(root);const version=await manager.save(managed,null);app=await Application.load(root);const bound=await app.draft({model:'',mediaType:'video',mode:'text',prompt:'cat',references:[]});assert.equal(bound.request.model,'local-video');await app.execute(bound.id,async()=>true);assert.equal(bodies.at(-1).model,'remote-video-id');app.dispose();
 managed.providers[0].baseUrl='http://127.0.0.1:1';managed.providers[0].enabled=false;managed.models[0].enabled=false;managed.settings.defaults.video.modelId=null;await manager.save(managed,version.revision);app=await Application.load(root);assert.equal((await app.resume(bound.id)).state,'SUCCEEDED');assert.equal(submits,3);app.dispose();}
 finally{delete process.env.MEDIA_TEST_KEY;await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
});
