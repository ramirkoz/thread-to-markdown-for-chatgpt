'use strict';

(() => {
  const MAX_ITEMS = 500;
  const MAX_TOTAL_BYTES = 96 * 1024 * 1024;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'workspace-bulk-export') return false;
    exportWorkspaceItems(message.items).then((result)=>sendResponse({ok:true,...result})).catch((error)=>sendResponse({ok:false,error:String(error?.message||error)}));
    return true;
  });

  async function exportWorkspaceItems(rawItems) {
    if (typeof createStoredZip !== 'function' || typeof encodeText !== 'function' || typeof bytesToDataUrl !== 'function') throw new Error('ZIP export engine is unavailable.');
    const items=Array.isArray(rawItems)?rawItems.slice(0,MAX_ITEMS).map(cleanItem):[];if(!items.length)throw new Error('No saved chats were selected.');
    let totalBytes=0;const entries=[];const manifestItems=[];const usedPaths=new Set();
    for(const item of items){const markdownBytes=encodeText(item.markdown);totalBytes+=markdownBytes.length;if(totalBytes>MAX_TOTAL_BYTES)throw new Error('The selected Workspace exceeds the 96 MB export limit. Select fewer chats.');
      const project=safeName(item.project||'No project');const folder=safeName(item.folder||'Unfiled');const base=safeName(item.title||'ChatGPT conversation');const path=uniquePath(`projects/${project}/${folder}/${base}.md`,usedPaths);entries.push({name:path,data:markdownBytes});manifestItems.push({...item,file:path,markdown:undefined,searchText:undefined});}
    const manifest={schema:'chatextra-workspace-export',version:3,exportedAt:new Date().toISOString(),count:manifestItems.length,items:manifestItems};
    entries.unshift({name:'library.json',data:encodeText(JSON.stringify(manifest,null,2))},{name:'README.txt',data:encodeText('GPT Project & Memory Tools local Workspace export.\nChats are stored as Markdown under projects/<project>/<folder>/.\nMetadata is stored in library.json.\nProject memory stays local and is not uploaded as ChatGPT Project sources.\n')});
    const bytes=createStoredZip(entries);const stamp=new Date().toISOString().slice(0,10);const filename=`chatextra-workspace-${stamp}.zip`;const downloadId=await chrome.downloads.download({url:bytesToDataUrl(bytes,'application/zip'),filename,saveAs:false,conflictAction:'uniquify'});return{filename,count:manifestItems.length,downloadId};
  }
  function cleanItem(item){return{id:String(item?.id||''),title:String(item?.title||'ChatGPT conversation').slice(0,240),url:String(item?.url||''),project:String(item?.project||'').slice(0,120),projectId:String(item?.projectId||'').slice(0,180),folder:String(item?.folder||'').slice(0,80),tags:Array.isArray(item?.tags)?item.tags.map((tag)=>String(tag).slice(0,48)).slice(0,30):[],note:String(item?.note||'').slice(0,16000),markdown:String(item?.markdown||''),searchText:String(item?.searchText||''),messageCount:Number(item?.messageCount||0),savedAt:String(item?.savedAt||''),updatedAt:String(item?.updatedAt||''),autoSaved:Boolean(item?.autoSaved)};}
  function safeName(value){return String(value||'item').normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f]/g,' ').replace(/\s+/g,' ').trim().slice(0,100)||'item';}
  function uniquePath(path,used){if(!used.has(path)){used.add(path);return path;}const dot=path.lastIndexOf('.');const stem=dot>-1?path.slice(0,dot):path;const ext=dot>-1?path.slice(dot):'';let index=2;while(used.has(`${stem}-${index}${ext}`))index+=1;const unique=`${stem}-${index}${ext}`;used.add(unique);return unique;}
})();
