import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {ScopeRouter} from '../../dist/platform/dsh/scope.js';
import {apply} from '../../dist/index.js';
import {ConfigManager} from '../../dist/config/config-manager.js';
import {defaultConfig} from '../../dist/config/defaults.js';
test('scope identities come from host; concurrent requests retain isolated context',async()=>{
 const root=await mkdtemp(join(tmpdir(),'scope-'));try{
 const router=new ScopeRouter({tools:{}},root,'session');
 const roots=await Promise.all(['one','two'].map(id=>router.run({agent:{session:{id}}},async()=>{const first=router.currentRoot();await new Promise(r=>setTimeout(r,2));assert.equal(router.currentRoot(),first);return first;})));
 assert.notEqual(roots[0],roots[1]);await assert.rejects(router.run(undefined,async()=>{}));
 const project=new ScopeRouter({tools:{}},root,'project');assert.equal(await project.run({agent:{session:{cwd:root}}},async()=>project.currentRoot()),await project.run({agent:{session:{cwd:join(root,'.')}}},async()=>project.currentRoot()));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('session tools cannot read another session task even with its ID',async()=>{
 const root=await mkdtemp(join(tmpdir(),'scope-tools-'));let stop;try{
 const config=defaultConfig();config.providers=[{id:'p',name:'P',enabled:true,baseUrl:'https://example.com',apiKeyRef:'env:KEY',adapters:{image:'openai-image'},timeoutMs:60000,allowPrivateService:false}];config.models=[{id:'m',name:'M',providerId:'p',model:'remote',enabled:true,capabilitySource:'manual',capabilities:{mediaType:'image',modes:['text'],maxReferences:0,nativeAudio:false,negativePrompt:false,cancellation:false,idempotency:false}}];await new ConfigManager(root).save(config,null);
 const tools=new Map();stop=apply({tools:{register(t){tools.set(t.name,t);return()=>{};}},logger:{warn(){}}},{dataDirectory:root,scopeMode:'session'});
 const invoke=(id,name,args)=>tools.get(name).execute(args,{agent:{session:{id}}});
 const draft=await invoke('one','media_prepare',{idea:'cat',request:{model:'m',mediaType:'image',mode:'text',prompt:'cat'}});assert.equal(draft.ok,true);
 assert.equal((await invoke('one','media_tasks',{})).data.length,1);assert.equal((await invoke('two','media_tasks',{})).data.length,0);
 assert.equal((await invoke('two','media_task_status',{taskId:draft.data.draftId})).ok,false);
 assert.equal((await invoke('two','media_models',{})).data.models.length,1);
 }finally{stop?.();await rm(root,{recursive:true,force:true});}
});
