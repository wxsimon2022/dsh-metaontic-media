import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ConfigManager } from '../../dist/config/config-manager.js';
import { defaultConfig } from '../../dist/config/defaults.js';
import { ModelSelector } from '../../dist/models/model-selector.js';
import { ModelDiscovery } from '../../dist/models/model-discovery.js';
const cap = {mediaType:'image',modes:['text'],maxReferences:0,nativeAudio:false,negativePrompt:false,cancellation:false,idempotency:false};
function config(){const c=defaultConfig(); c.providers=[{id:'p',name:'Provider',enabled:true,baseUrl:'https://example.com',apiKeyRef:'env:TEST_KEY',adapters:{image:'openai-image'},timeoutMs:60000,allowPrivateService:false}];c.models=[{id:'local',name:'Image',providerId:'p',model:'same-remote-id',enabled:true,capabilities:cap,capabilitySource:'manual'}]; c.settings.defaults.image.modelId='local';return c;}
test('configuration versions are atomic, persistent and reject stale updates or default deletion', async()=>{
 const root=await mkdtemp(join(tmpdir(),'config-'));try{const manager=new ConfigManager(root);const first=await manager.save(config(),null);assert.equal((await new ConfigManager(root).load()).revision,first.revision);await assert.rejects(manager.save(config(),null));const bad=config();bad.models=[];await assert.rejects(manager.save(bad,first.revision));assert.equal((await manager.load()).revision,first.revision);const current=JSON.parse(await readFile(join(root,'config/current.json'),'utf8'));assert.equal(current.revision,first.revision);}finally{await rm(root,{recursive:true,force:true});}
});
test('provider deletion is blocked for unfinished tasks',async()=>{const root=await mkdtemp(join(tmpdir(),'config-'));try{const manager=new ConfigManager(root);const first=await manager.save(config(),null);const {Repository}=await import('../../dist/index.js');await new Repository(join(root,'tasks')).write('task',{providerId:'p',state:'RUNNING'});await assert.rejects(manager.save(defaultConfig(),first.revision));}finally{await rm(root,{recursive:true,force:true});}});
test('same upstream ID across providers is valid; explicit disabled selection never falls back',()=>{const c=config();c.providers.push({...c.providers[0],id:'other'});c.models.push({...c.models[0],id:'other-local',providerId:'other',enabled:false});const selector=new ModelSelector(c);assert.equal(selector.resolve('image','text').id,'local');assert.throws(()=>selector.resolve('image','text','other-local'));selector.setSession('s','image','local');assert.equal(selector.resolve('image','text',undefined,'s').id,'local');});
test('discovery additions stay disabled and never replace manual capabilities',async()=>{const d=new ModelDiscovery(undefined,async()=>Response.json({data:[{id:'new'},{id:'same-remote-id'}]}));const c=config();const p={...c.providers[0],allowPrivateService:true,discoveryPath:'/v1/models'};process.env.TEST_KEY='secret';try{const found=await d.discover(p);const additions=d.additions('p',c.models,found);assert.equal(additions.length,1);assert.equal(additions[0].enabled,false);assert.equal(additions[0].capabilities,undefined);assert.equal((await d.testConnection(p)).ok,true);}finally{delete process.env.TEST_KEY;}});
