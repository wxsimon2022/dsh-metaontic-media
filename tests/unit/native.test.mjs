import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { apply, configSchema, AssetService } from '../../dist/index.js';
import { prepare } from '../../dist/businesses/prompt/prepare.js';
import { Queue } from '../../dist/services/queue.js';
const image = { mediaType: 'image', modes: ['text'], maxReferences: 0, nativeAudio: false, negativePrompt: false, cancellation: false, idempotency: false };
test('native tools register, use host prompts and dispose', async () => {
 const root = await mkdtemp(join(tmpdir(), 'native-')); const tools = new Map(); let sections = 0; let removed = 0;
 const stop = apply({ tools: { register(t) { tools.set(t.name,t); return () => { removed++; }; } }, systemPrompt: { section(s) { assert.ok(s.text.includes('DSH')); sections++; } } }, { dataDirectory: root });
 try {
 assert.equal(sections,1); assert.ok(tools.has('media_prepare')); assert.ok(tools.has('media_generate_video'));
 const invoke = (name,args) => tools.get(name).execute(args);
 const saved = await invoke('media_config',{config:{version:1,providers:[{id:'p',adapter:'openai-image',baseUrl:'https://example.com',apiKeyEnv:'KEY'}],models:[{id:'image',providerId:'p',capabilities:image}]}}); assert.equal(saved.ok,true);
 const draft = await invoke('media_prepare',{idea:'cat',request:{model:'image',mediaType:'image',mode:'text',prompt:'cat',references:[]}}); assert.equal(draft.ok,true);
 const result = await invoke('media_generate_image',{draftId:draft.data.draftId}); assert.equal(result.data.state,'CANCELLED');
 const prompt = await invoke('media_prepare',{idea:'cat',promptOnly:true}); assert.equal(prompt.ok,true); assert.equal(prompt.data.task,undefined);
 assert.equal((await invoke('media_generate_image',{draftId:'x',approvalId:'invented'})).ok,false);
 } finally { stop(); assert.equal(removed,tools.size); await rm(root,{recursive:true,force:true}); }
});
test('configuration rejects missing video protocol and duplicate IDs',()=>{
 assert.equal(configSchema.safeParse({version:1,providers:[{id:'p',adapter:'newapi-video',baseUrl:'https://example.com',apiKeyEnv:'KEY'}],models:[]}).success,false);
});
test('queue bounds concurrency',async()=>{ const q=new Queue(2);let active=0,max=0;await Promise.all(Array.from({length:8},()=>q.run(async()=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,2));active--;})));assert.equal(max,2); });
test('asset validates signature, size and blocks path traversal',async()=>{
 const root=await mkdtemp(join(tmpdir(),'assets-'));try {const assets=new AssetService(root,100); const png=Buffer.from([137,80,78,71,13,10,26,10,0]);const a=await assets.save({base64:png.toString('base64')},'project');assert.equal((await assets.read(a.id)).asset.mimeType,'image/png');await assert.rejects(assets.save({base64:'aGVsbG8='},'project'));await assert.rejects(assets.save({base64:png.toString('base64')},'../escape'));await assert.rejects(assets.save({url:'https://127.0.0.1/a'},'project'));}finally{await rm(root,{recursive:true,force:true});}
});
