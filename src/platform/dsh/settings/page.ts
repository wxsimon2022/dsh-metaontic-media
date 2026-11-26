export function createSettingsPage(React: any, form: any) {
  const h = React.createElement;
  return function SettingsPage() {
    const snapshot = React.useSyncExternalStore(React.useCallback((listener: any) => form.subscribe(listener), []), React.useCallback(() => form.getSnapshot(), []));
    const [draft, setDraft] = React.useState(() => structuredClone(snapshot.value ?? {}));
    const [message, setMessage] = React.useState('');
    const [saving, setSaving] = React.useState(false);
    React.useEffect(() => { setDraft(structuredClone(snapshot.value ?? {})); }, [snapshot.revision]);
    const update = (key: string, value: any) => setDraft((old: any) => ({ ...old, [key]: value }));
    const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid var(--border-color, #9995)', borderRadius: 6, background: 'transparent', color: 'inherit', boxSizing: 'border-box' };
    const field = (label: string, value: any, change: (v: any) => void, type = 'text', hint = '') => h('label', { style: { display: 'grid', gap: 5, margin: '10px 0' } }, h('span', {}, label), h('input', { type, value: value ?? '', style: inputStyle, onChange: (e: any) => change(type === 'number' ? e.target.value === '' ? undefined : Number(e.target.value) : e.target.value) }), hint && h('small', { style: { opacity: .65 } }, hint));
    const check = (label: string, value: boolean, change: (v: boolean) => void) => h('label', { style: { display: 'inline-flex', gap: 8, margin: '8px 16px 8px 0' } }, h('input', { type: 'checkbox', checked: !!value, onChange: (e: any) => change(e.target.checked) }), label);
    const select = (label: string, value: string, values: any[], change: (v: string) => void) => h('label', { style: { display: 'grid', gap: 5, margin: '10px 0' } }, label, h('select', { value: value ?? '', style: inputStyle, onChange: (e: any) => change(e.target.value) }, h('option', { value: '' }, '请选择'), ...values.map(v => h('option', { key: v.id, value: v.id }, v.name || v.id))));
    const button = (label: string, onClick: () => void) => h('button', { type: 'button', onClick, style: { padding: '7px 12px', margin: '6px 8px 6px 0', cursor: 'pointer' } }, label);
    const collection = (key: string, title: string, isProvider = false) => {
      const list = draft[key] ?? [];
      const patch = (index: number, values: any) => update(key, list.map((item: any, i: number) => i === index ? { ...item, ...values } : item));
      return h('section', { style: { borderTop: '1px solid #8884', padding: '16px 0' } }, h('h3', {}, title), ...list.map((item: any, index: number) => h('fieldset', { key: index, style: { border: '1px solid #8885', borderRadius: 8, padding: 16, margin: '12px 0' } },
        h('legend', {}, item.name || `${isProvider ? '服务商' : '模型'} ${index + 1}`),
        field(isProvider ? '服务商标识' : '本地模型标识', item.id, v => patch(index, { id: v }), 'text', '唯一标识，使用字母、数字、横线或下划线'),
        field('显示名称', item.name, v => patch(index, { name: v })),
        ...(isProvider ? [
          field('API 服务地址', item.baseUrl, v => patch(index, { baseUrl: v }), 'url', '填写渠道提供的 HTTPS 地址'),
          field('密钥环境变量引用', item.apiKeyRef, v => patch(index, { apiKeyRef: v }), 'text', '例如 env:MEDIA_API_KEY；此处不填写密钥原文'),
          check('图片接口', item.imageEnabled, v => patch(index, { imageEnabled: v })), check('视频接口', item.videoEnabled, v => patch(index, { videoEnabled: v })),
          field('模型列表接口（可选）', item.discoveryPath, v => patch(index, { discoveryPath: v }), 'text', '仅填写渠道已验证的非生成路径，例如 /v1/models'),
          item.videoEnabled && h('label', { style: { display: 'grid', gap: 8 } }, '视频协议（高级）', h('textarea', { value: item.videoProtocol ?? '', rows: 5, style: inputStyle, onChange: (e: any) => patch(index, { videoProtocol: e.target.value }) })),
        ] : [
          select('所属服务商', item.providerId, draft.providers ?? [], v => patch(index, { providerId: v })),
          field('上游模型 ID', item.model, v => patch(index, { model: v }), 'text', '填写 API 渠道实际提供的模型 ID'),
          ...['text', 'image', ...(key === 'videoModels' ? ['first-last-frame'] : ['edit'])].map(mode => check(({ text: '文生', image: '参考图', edit: '图片编辑', 'first-last-frame': '首尾帧' } as any)[mode], item.modes?.includes(mode), v => patch(index, { modes: v ? [...(item.modes ?? []), mode] : item.modes.filter((m: string) => m !== mode) }))),
          field('支持画幅', (item.aspectRatios ?? []).join(', '), v => patch(index, { aspectRatios: v.split(',').map((x: string) => x.trim()).filter(Boolean) }), 'text', '例如 16:9, 9:16'),
          field('支持分辨率', (item.resolutions ?? []).join(', '), v => patch(index, { resolutions: v.split(',').map((x: string) => x.trim()).filter(Boolean) })),
          field('最多参考图数量', item.maxReferences ?? 0, v => patch(index, { maxReferences: v }), 'number'),
          key === 'videoModels' && field('支持时长（秒）', (item.durations ?? []).join(', '), v => patch(index, { durations: v.split(',').map((x: string) => x.trim()).filter(Boolean).map(Number) }), 'text', '例如 5, 10, 15'),
          key === 'videoModels' && check('支持原生音频', item.nativeAudio, v => patch(index, { nativeAudio: v })),
        ]),
        check(isProvider ? '启用服务商' : '已核验能力，启用模型', item.enabled, v => patch(index, { enabled: v })),
        button('删除', () => update(key, list.filter((_: any, i: number) => i !== index))),
      )), !list.length && h('p', { style: { opacity: .65 } }, '尚未添加'), button(isProvider ? '添加服务商' : '添加模型', () => update(key, [...list, isProvider ? { id: '', name: '', baseUrl: '', apiKeyRef: '', enabled: true, imageEnabled: true, videoEnabled: false, timeoutMs: 60000 } : { id: '', name: '', providerId: '', model: '', enabled: false, modes: ['text'], aspectRatios: [], resolutions: [], durations: [], maxReferences: 0 }])));
    };
    async function save() {
      setSaving(true); setMessage('');
      try {
        if (snapshot.status !== 'ready' || snapshot.writable === false) throw Error('设置尚未就绪或不可写');
        const keys = ['scopeMode', 'providers', 'imageModels', 'videoModels', 'defaults'];
        const ops = keys.map(key => ({ op: 'set', path: [key], value: draft[key] ?? (key === 'scopeMode' ? 'global' : key === 'defaults' ? {} : []) }));
        if (!await form.mutate(ops, snapshot.revision)) throw Error('保存冲突，请重新打开设置页后再试');
        setMessage('已保存设置。');
      } catch (error) { setMessage(error instanceof Error ? error.message : '保存失败'); }
      finally { setSaving(false); }
    }
    return h('div', { style: { padding: 20, maxWidth: 860, lineHeight: 1.5 } }, h('h2', {}, 'MetaOntic Media · 模型设置'), h('p', {}, '先添加服务商，再添加图片或视频模型，最后选择默认模型。文本推理使用 DSH 当前模型。'), h('section', {}, h('h3', {}, '数据作用域'), select('作用域模式', draft.scopeMode ?? 'global', [{id:'global',name:'全局共享'},{id:'project',name:'按项目隔离'},{id:'session',name:'按会话隔离'}], v => update('scopeMode', v)), h('p', {}, '隔离草稿、任务、素材和用量；服务商及模型配置共享。切换模式不会搬移已有数据，切回原模式可继续查看。')), collection('providers', '① 服务商', true), collection('imageModels', '② 图片模型'), collection('videoModels', '③ 视频模型'),
      h('section', {}, h('h3', {}, '④ 默认模型'), select('默认图片模型', draft.defaults?.imageModelId, (draft.imageModels ?? []).filter((m: any) => m.enabled), v => update('defaults', { ...draft.defaults, imageModelId: v })), select('默认视频模型', draft.defaults?.videoModelId, (draft.videoModels ?? []).filter((m: any) => m.enabled), v => update('defaults', { ...draft.defaults, videoModelId: v }))),
      h('button', { type: 'button', disabled: saving || snapshot.status !== 'ready', onClick: save, style: { padding: '10px 18px', cursor: 'pointer' } }, saving ? '保存中…' : '保存模型设置'), h('p', { role: 'status' }, message));
  };
}
