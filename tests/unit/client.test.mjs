import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
test('installed client registers actual bundle settings slot and renders model fields', async () => {
 let plugin; let page; let operations;
 const form={getSnapshot:()=>({status:'ready',writable:true,revision:3,value:{}}),subscribe:()=>()=>{},mutate:async(ops,revision)=>{assert.equal(revision,3);operations=ops;return true;}};
 const React={createElement:(tag,props,...children)=>({tag,props,children}),useCallback:f=>f,useSyncExternalStore:(_s,get)=>get(),useState:value=>[typeof value==='function'?value():value,()=>{}],useEffect:()=>{}};
 vm.runInNewContext(await readFile('dist/client.js','utf8'),{structuredClone,window:{__ModuleLoader__:{load:value=>plugin=value}}});
 const client=plugin.factory(id=>{assert.equal(id,'react');return React;});
 assert.deepEqual([...client.inject],['slots','configForms']);
 client.apply({configForms:{get:id=>{assert.equal(id,'dsh-metaontic-media');return form;}},effect:run=>run(),slots:{inject:(name,run)=>{assert.equal(name,'plugins.bundle.config');return run();},register:(definition,component)=>{assert.equal(definition.key,'dsh-metaontic-media');page=component;}}});
 const tree=page();const serialized=JSON.stringify(tree);for(const text of ['① 服务商','② 图片模型','③ 视频模型','④ 默认模型'])assert.ok(serialized.includes(text));assert.ok(!serialized.includes('README'));
 function find(node){if(!node||typeof node!=='object')return; if(node.tag==='button'&&node.children.includes('保存模型设置'))return node;for(const child of (node.children??[]).flat(Infinity)){const result=find(child);if(result)return result;}}
 await find(tree).props.onClick();assert.deepEqual(Array.from(operations,x=>x.path[0]),['scopeMode','providers','imageModels','videoModels','defaults']);
});
