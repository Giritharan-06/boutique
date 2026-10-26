import ts from 'typescript';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
export async function fashionRuntime({directory='.local/fashion-runtime',environment=true}={}){
  if(environment)try{process.loadEnvFile('.env.local');}catch(e){if(e.code!=='ENOENT')throw e;}
  const root=resolve(directory);mkdirSync(root,{recursive:true});
  const modules={model:'app/fashion-studio/model.ts',database:'lib/local/database.ts',auth:'lib/local/auth.ts',security:'lib/local/security.ts',access:'lib/fashion-studio/access.ts',store:'lib/fashion-studio/store.ts',images:'lib/fashion-studio/images.ts',providers:'lib/fashion-studio/providers.ts',jobs:'lib/fashion-studio/jobs.ts',http:'lib/fashion-studio/http.ts'};
  for(const [name,file] of Object.entries(modules)){
    let source=readFileSync(file,'utf8');source=source.replace(/(['"])([^'"]+)\1/g,(all,quote,value)=>{
      const target=value==='../../app/fashion-studio/model'?'model':value.startsWith('../local/')?value.slice(9):value.startsWith('./')?value.slice(2):null;
      return target&&modules[target]?quote+'./'+target+'.mjs'+quote:all;
    });
    writeFileSync(join(root,name+'.mjs'),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
  }
  return async name=>import(pathToFileURL(join(root,name+'.mjs')).href);
}
